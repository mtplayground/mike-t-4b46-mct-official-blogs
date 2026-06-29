use axum::http::Uri;
use sha2::{Digest, Sha256};
use std::{env, net::SocketAddr};

#[derive(Clone)]
pub struct AppConfig {
    pub database_url: String,
    pub self_url: String,
    pub admin: AdminCredentials,
    pub object_storage: ObjectStorageConfig,
    pub revalidation: RevalidationConfig,
    pub listen_addr: SocketAddr,
}

#[allow(dead_code)]
#[derive(Clone)]
pub struct AdminCredentials {
    pub username: String,
    pub password: String,
}

#[allow(dead_code)]
#[derive(Clone)]
pub struct ObjectStorageConfig {
    pub access_key_id: String,
    pub secret_access_key: String,
    pub bucket: String,
    pub prefix: String,
    pub endpoint: String,
    pub region: String,
    pub force_path_style: bool,
}

#[allow(dead_code)]
#[derive(Clone)]
pub struct RevalidationConfig {
    pub url: String,
    pub secret: String,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{0} is required.")]
    MissingEnv(&'static str),
    #[error("{0} must be a valid absolute URL.")]
    InvalidUrl(&'static str),
    #[error("{0} must be either true or false.")]
    InvalidBoolean(&'static str),
    #[error("ADMIN_USERNAME and ADMIN_PASSWORD must be configured together.")]
    PartialAdminCredentials,
    #[error("OBJECT_STORAGE_PREFIX must include its trailing slash.")]
    ObjectStoragePrefixMissingTrailingSlash,
    #[error("PORT must be a valid u16 port number.")]
    InvalidPort,
    #[error("REVALIDATE_URL must be a valid absolute URL.")]
    InvalidRevalidateUrl,
    #[error("REVALIDATE_SECRET or JWT_SECRET is required.")]
    MissingRevalidateSecret,
    #[error("listen address could not be constructed: {0}")]
    InvalidListenAddress(std::net::AddrParseError),
}

impl AppConfig {
    pub fn from_env() -> Result<Self, ConfigError> {
        let self_url = required_url_env("SELF_URL")?;

        Ok(Self {
            database_url: required_url_env("DATABASE_URL")?.to_string(),
            self_url: self_url.clone(),
            admin: admin_credentials_from_env()?,
            object_storage: object_storage_from_env()?,
            revalidation: revalidation_from_env(&self_url)?,
            listen_addr: listen_addr_from_env()?,
        })
    }
}

fn required_env(name: &'static str) -> Result<String, ConfigError> {
    env::var(name)
        .map_err(|_| ConfigError::MissingEnv(name))
        .and_then(|value| {
            if value.is_empty() {
                Err(ConfigError::MissingEnv(name))
            } else {
                Ok(value)
            }
        })
}

fn optional_env(name: &'static str) -> Option<String> {
    env::var(name).ok().filter(|value| !value.is_empty())
}

fn required_url_env(name: &'static str) -> Result<String, ConfigError> {
    let value = required_env(name)?;
    let parsed = value
        .parse::<Uri>()
        .map_err(|_| ConfigError::InvalidUrl(name))?;
    if parsed.scheme_str().is_some() && parsed.authority().is_some() {
        Ok(value)
    } else {
        Err(ConfigError::InvalidUrl(name))
    }
}

fn required_bool_env(name: &'static str) -> Result<bool, ConfigError> {
    match required_env(name)?.as_str() {
        "true" => Ok(true),
        "false" => Ok(false),
        _ => Err(ConfigError::InvalidBoolean(name)),
    }
}

fn derive_admin_credentials(jwt_secret: &str) -> AdminCredentials {
    let digest = Sha256::digest(format!("admin:{jwt_secret}"));
    let digest = hex::encode(digest);

    AdminCredentials {
        username: format!("admin_{}", &digest[..8]),
        password: digest,
    }
}

fn admin_credentials_from_env() -> Result<AdminCredentials, ConfigError> {
    match (
        optional_env("ADMIN_USERNAME"),
        optional_env("ADMIN_PASSWORD"),
    ) {
        (Some(username), Some(password)) => Ok(AdminCredentials { username, password }),
        (None, None) => Ok(derive_admin_credentials(&required_env("JWT_SECRET")?)),
        _ => Err(ConfigError::PartialAdminCredentials),
    }
}

fn object_storage_from_env() -> Result<ObjectStorageConfig, ConfigError> {
    let prefix = required_env("OBJECT_STORAGE_PREFIX")?;

    if !prefix.ends_with('/') {
        return Err(ConfigError::ObjectStoragePrefixMissingTrailingSlash);
    }

    Ok(ObjectStorageConfig {
        access_key_id: required_env("OBJECT_STORAGE_ACCESS_KEY_ID")?,
        secret_access_key: required_env("OBJECT_STORAGE_SECRET_ACCESS_KEY")?,
        bucket: required_env("OBJECT_STORAGE_BUCKET")?,
        prefix,
        endpoint: required_url_env("OBJECT_STORAGE_ENDPOINT")?,
        region: required_env("OBJECT_STORAGE_REGION")?,
        force_path_style: required_bool_env("OBJECT_STORAGE_FORCE_PATH_STYLE")?,
    })
}

fn revalidation_from_env(self_url: &str) -> Result<RevalidationConfig, ConfigError> {
    let secret = optional_env("REVALIDATE_SECRET")
        .or_else(|| optional_env("JWT_SECRET"))
        .ok_or(ConfigError::MissingRevalidateSecret)?;
    let url = optional_env("REVALIDATE_URL")
        .unwrap_or_else(|| format!("{}/api/revalidate", self_url.trim_end_matches('/')));
    let parsed = url
        .parse::<Uri>()
        .map_err(|_| ConfigError::InvalidRevalidateUrl)?;

    if parsed.scheme_str().is_none() || parsed.authority().is_none() {
        return Err(ConfigError::InvalidRevalidateUrl);
    }

    Ok(RevalidationConfig { url, secret })
}

fn listen_addr_from_env() -> Result<SocketAddr, ConfigError> {
    let port = match optional_env("PORT") {
        Some(value) => value.parse::<u16>().map_err(|_| ConfigError::InvalidPort)?,
        None => 8080,
    };

    format!("0.0.0.0:{port}")
        .parse()
        .map_err(ConfigError::InvalidListenAddress)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serial_test::serial;

    const ENV_KEYS: &[&str] = &[
        "DATABASE_URL",
        "SELF_URL",
        "ADMIN_USERNAME",
        "ADMIN_PASSWORD",
        "JWT_SECRET",
        "OBJECT_STORAGE_ACCESS_KEY_ID",
        "OBJECT_STORAGE_SECRET_ACCESS_KEY",
        "OBJECT_STORAGE_BUCKET",
        "OBJECT_STORAGE_PREFIX",
        "OBJECT_STORAGE_ENDPOINT",
        "OBJECT_STORAGE_REGION",
        "OBJECT_STORAGE_FORCE_PATH_STYLE",
        "REVALIDATE_SECRET",
        "REVALIDATE_URL",
        "PORT",
    ];

    fn clear_env() {
        for key in ENV_KEYS {
            env::remove_var(key);
        }
    }

    fn set_required_env() {
        env::set_var(
            "DATABASE_URL",
            "postgresql://user:pass@example.com:5432/app",
        );
        env::set_var("SELF_URL", "https://blog.example.com");
        env::set_var("ADMIN_USERNAME", "editor");
        env::set_var("ADMIN_PASSWORD", "secret");
        env::set_var("OBJECT_STORAGE_ACCESS_KEY_ID", "access");
        env::set_var("OBJECT_STORAGE_SECRET_ACCESS_KEY", "secret");
        env::set_var("OBJECT_STORAGE_BUCKET", "bucket");
        env::set_var("OBJECT_STORAGE_PREFIX", "tenant-prefix/");
        env::set_var("OBJECT_STORAGE_ENDPOINT", "https://storage.example.com");
        env::set_var("OBJECT_STORAGE_REGION", "auto");
        env::set_var("OBJECT_STORAGE_FORCE_PATH_STYLE", "true");
        env::set_var("REVALIDATE_SECRET", "revalidate-secret");
    }

    #[test]
    #[serial]
    fn explicit_admin_credentials_are_loaded() {
        clear_env();
        set_required_env();

        let config = AppConfig::from_env().expect("config should load");

        assert_eq!(config.admin.username, "editor");
        assert_eq!(config.admin.password, "secret");
        assert_eq!(config.object_storage.prefix, "tenant-prefix/");
        assert_eq!(
            config.revalidation.url,
            "https://blog.example.com/api/revalidate"
        );
        assert_eq!(config.revalidation.secret, "revalidate-secret");
        assert_eq!(config.listen_addr.to_string(), "0.0.0.0:8080");
    }

    #[test]
    #[serial]
    fn revalidation_url_can_be_overridden() {
        clear_env();
        set_required_env();
        env::set_var("REVALIDATE_URL", "http://127.0.0.1:3000/api/revalidate");

        let config = AppConfig::from_env().expect("config should load");

        assert_eq!(
            config.revalidation.url,
            "http://127.0.0.1:3000/api/revalidate"
        );
    }

    #[test]
    #[serial]
    fn revalidation_secret_can_fall_back_to_jwt_secret() {
        clear_env();
        set_required_env();
        env::remove_var("REVALIDATE_SECRET");
        env::set_var("JWT_SECRET", "jwt-fallback-secret");

        let config = AppConfig::from_env().expect("config should load");

        assert_eq!(config.revalidation.secret, "jwt-fallback-secret");
    }

    #[test]
    #[serial]
    fn admin_credentials_can_be_derived_from_jwt_secret() {
        clear_env();
        set_required_env();
        env::remove_var("ADMIN_USERNAME");
        env::remove_var("ADMIN_PASSWORD");
        env::set_var("JWT_SECRET", "test-secret");

        let config = AppConfig::from_env().expect("config should load");

        assert!(config.admin.username.starts_with("admin_"));
        assert_eq!(config.admin.password.len(), 64);
    }

    #[test]
    #[serial]
    fn partial_admin_credentials_are_rejected() {
        clear_env();
        set_required_env();
        env::remove_var("ADMIN_PASSWORD");

        let error = match AppConfig::from_env() {
            Ok(_) => panic!("partial credentials should fail"),
            Err(error) => error,
        };

        assert!(matches!(error, ConfigError::PartialAdminCredentials));
    }

    #[test]
    #[serial]
    fn object_storage_prefix_requires_trailing_slash() {
        clear_env();
        set_required_env();
        env::set_var("OBJECT_STORAGE_PREFIX", "tenant-prefix");

        let error = match AppConfig::from_env() {
            Ok(_) => panic!("invalid prefix should fail"),
            Err(error) => error,
        };

        assert!(matches!(
            error,
            ConfigError::ObjectStoragePrefixMissingTrailingSlash
        ));
    }
}
