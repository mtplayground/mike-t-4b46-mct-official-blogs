use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

use crate::config::RevalidationConfig;

#[derive(Debug, Error)]
pub enum RevalidationError {
    #[error("failed to send revalidation request: {0}")]
    Request(#[from] reqwest::Error),
    #[error("revalidation route returned HTTP {status}: {body}")]
    Status { status: reqwest::StatusCode, body: String },
}

#[derive(Debug, Serialize, Deserialize)]
struct RevalidationPayload {
    slugs: Vec<String>,
}

pub async fn trigger_public_revalidation<I, S>(
    config: &RevalidationConfig,
    slugs: I,
) -> Result<(), RevalidationError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let slugs = normalize_slugs(slugs);
    let response = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()?
        .post(&config.url)
        .bearer_auth(&config.secret)
        .json(&RevalidationPayload { slugs })
        .send()
        .await?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();

        return Err(RevalidationError::Status { status, body });
    }

    Ok(())
}

fn normalize_slugs<I, S>(slugs: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut normalized = Vec::new();

    for slug in slugs {
        let slug = slug.as_ref().trim().trim_matches('/');
        if slug.is_empty()
            || !slug.chars().all(|character| {
                character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
            })
        {
            continue;
        }

        if !normalized.iter().any(|existing| existing == slug) {
            normalized.push(slug.to_owned());
        }
    }

    normalized
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{extract::State, http::HeaderMap, routing::post, Json, Router};
    use std::sync::Arc;
    use tokio::{net::TcpListener, sync::Mutex};

    #[test]
    fn normalize_slugs_deduplicates_and_rejects_invalid_values() {
        assert_eq!(
            normalize_slugs([
                "welcome-post",
                "/welcome-post/",
                "",
                "../secret",
                "Second",
                "another-post",
            ]),
            vec!["welcome-post".to_owned(), "another-post".to_owned()]
        );
    }

    #[derive(Clone, Default)]
    struct Capture {
        authorization: Arc<Mutex<Option<String>>>,
        payload: Arc<Mutex<Option<RevalidationPayload>>>,
    }

    async fn capture_revalidation(
        State(capture): State<Capture>,
        headers: HeaderMap,
        Json(payload): Json<RevalidationPayload>,
    ) -> &'static str {
        *capture.authorization.lock().await = headers
            .get("authorization")
            .and_then(|value| value.to_str().ok())
            .map(ToOwned::to_owned);
        *capture.payload.lock().await = Some(payload);

        "ok"
    }

    #[tokio::test]
    async fn trigger_posts_slugs_with_shared_secret() {
        let capture = Capture::default();
        let listener = TcpListener::bind("127.0.0.1:0")
            .await
            .expect("test listener should bind");
        let address = listener
            .local_addr()
            .expect("test listener address should be available");
        let app = Router::new()
            .route("/api/revalidate", post(capture_revalidation))
            .with_state(capture.clone());
        let server = tokio::spawn(async move {
            axum::serve(listener, app)
                .await
                .expect("test revalidation server should run");
        });
        let config = RevalidationConfig {
            url: format!("http://{address}/api/revalidate"),
            secret: "shared-secret".to_owned(),
        };

        trigger_public_revalidation(&config, ["first-post", "first-post", "second-post"])
            .await
            .expect("trigger should post to the revalidation route");

        assert_eq!(
            capture.authorization.lock().await.as_deref(),
            Some("Bearer shared-secret")
        );
        assert_eq!(
            capture
                .payload
                .lock()
                .await
                .as_ref()
                .map(|payload| payload.slugs.clone()),
            Some(vec!["first-post".to_owned(), "second-post".to_owned()])
        );

        server.abort();
    }
}
