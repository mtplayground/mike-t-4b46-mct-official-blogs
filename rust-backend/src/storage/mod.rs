use aws_config::{BehaviorVersion, Region};
use aws_credential_types::Credentials;
use aws_sdk_s3::{config::Builder as S3ConfigBuilder, presigning::PresigningConfig, Client};
use axum::{
    extract::{Path, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use std::time::Duration;

use crate::{config::ObjectStorageConfig, error::AppError, AppState};

const SIGNED_READ_EXPIRES_SECONDS: u64 = 60 * 60;

#[derive(Clone)]
pub struct StorageClient {
    client: Option<Client>,
    bucket: String,
    prefix: String,
    self_url: String,
}

impl StorageClient {
    pub async fn from_config(config: &ObjectStorageConfig, self_url: &str) -> Self {
        let credentials = Credentials::new(
            config.access_key_id.clone(),
            config.secret_access_key.clone(),
            None,
            None,
            "object-storage-env",
        );
        let shared_config = aws_config::defaults(BehaviorVersion::latest())
            .region(Region::new(config.region.clone()))
            .endpoint_url(config.endpoint.clone())
            .credentials_provider(credentials)
            .load()
            .await;
        let s3_config = S3ConfigBuilder::from(&shared_config)
            .force_path_style(config.force_path_style)
            .build();

        Self {
            client: Some(Client::from_conf(s3_config)),
            bucket: config.bucket.clone(),
            prefix: config.prefix.clone(),
            self_url: self_url.trim_end_matches('/').to_owned(),
        }
    }

    pub fn validate_relative_key(&self, relative_key: &str) -> Result<(), AppError> {
        if relative_key.is_empty()
            || relative_key.starts_with('/')
            || relative_key.contains("..")
            || relative_key.starts_with(&self.prefix)
        {
            return Err(AppError::BadRequest("Invalid image key."));
        }

        Ok(())
    }

    pub fn full_object_key(&self, relative_key: &str) -> Result<String, AppError> {
        self.validate_relative_key(relative_key)?;
        Ok(format!("{}{}", self.prefix, relative_key))
    }

    pub fn proxied_image_url(&self, relative_key: &str) -> Result<String, AppError> {
        self.validate_relative_key(relative_key)?;
        let encoded_key = relative_key
            .split('/')
            .map(|segment| utf8_percent_encode(segment, NON_ALPHANUMERIC).to_string())
            .collect::<Vec<_>>()
            .join("/");

        Ok(format!("{}/api/image/{}", self.self_url, encoded_key))
    }

    pub async fn signed_get_url(&self, relative_key: &str) -> Result<String, AppError> {
        let full_key = self.full_object_key(relative_key)?;
        let presigning_config =
            PresigningConfig::expires_in(Duration::from_secs(SIGNED_READ_EXPIRES_SECONDS))
                .map_err(|error| AppError::Storage(error.to_string()))?;
        let presigned = self
            .client
            .as_ref()
            .ok_or_else(|| AppError::Storage("S3 client is not configured.".to_owned()))?
            .get_object()
            .bucket(&self.bucket)
            .key(full_key)
            .presigned(presigning_config)
            .await
            .map_err(|error| AppError::Storage(error.to_string()))?;

        Ok(presigned.uri().to_string())
    }

    pub fn sign_markdown_storage_references(&self, body: &str) -> String {
        let mut output = String::with_capacity(body.len());
        let mut cursor = 0;

        while let Some(relative_start) = body[cursor..].find("](storage:") {
            let marker_start = cursor + relative_start;
            let key_start = marker_start + "](storage:".len();
            let Some(relative_end) = body[key_start..].find(')') else {
                break;
            };
            let key_end = key_start + relative_end;
            let key_and_suffix = &body[key_start..key_end];
            let key_end_offset = key_and_suffix
                .find(|character: char| character.is_whitespace())
                .unwrap_or(key_and_suffix.len());
            let relative_key = &key_and_suffix[..key_end_offset];
            let suffix = &key_and_suffix[key_end_offset..];

            output.push_str(&body[cursor..key_start - "storage:".len()]);
            match self.proxied_image_url(relative_key) {
                Ok(url) => {
                    output.push_str(&url);
                    output.push_str(suffix);
                }
                Err(error) => {
                    tracing::error!(
                        ?error,
                        relative_key,
                        "Failed to rewrite Markdown storage image"
                    );
                    output.push_str(key_and_suffix);
                }
            }
            cursor = key_end;
        }

        output.push_str(&body[cursor..]);
        output
    }
}

pub async fn image_redirect(
    State(state): State<AppState>,
    Path(relative_key): Path<String>,
) -> Result<Response, AppError> {
    let signed_url = state.storage.signed_get_url(&relative_key).await?;
    let location =
        HeaderValue::from_str(&signed_url).map_err(|error| AppError::Storage(error.to_string()))?;
    let mut response = StatusCode::TEMPORARY_REDIRECT.into_response();
    response.headers_mut().insert(header::LOCATION, location);
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("public, max-age=600"),
    );

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn storage() -> StorageClient {
        StorageClient {
            client: None,
            bucket: "bucket".to_owned(),
            prefix: "tenant-prefix/".to_owned(),
            self_url: "https://blog.example.com".to_owned(),
        }
    }

    #[test]
    fn full_object_key_prepends_prefix() {
        let storage = storage();

        assert_eq!(
            storage
                .full_object_key("post-images/2026/06/a.png")
                .unwrap(),
            "tenant-prefix/post-images/2026/06/a.png"
        );
    }

    #[test]
    fn invalid_relative_keys_are_rejected() {
        let storage = storage();

        assert!(storage.full_object_key("/leading").is_err());
        assert!(storage.full_object_key("../secret").is_err());
        assert!(storage
            .full_object_key("tenant-prefix/already-prefixed")
            .is_err());
    }

    #[test]
    fn markdown_storage_references_are_rewritten_to_proxy_urls() {
        let storage = storage();
        let body = "Before ![Alt](storage:post-images/2026/06/a test) after";

        assert_eq!(
            storage.sign_markdown_storage_references(body),
            "Before ![Alt](https://blog.example.com/api/image/post%2Dimages/2026/06/a test) after"
        );
    }
}
