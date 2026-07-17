use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    BadRequest(&'static str),
    #[error("{0}")]
    PayloadTooLarge(&'static str),
    #[error("{0}")]
    NotFound(&'static str),
    #[error("{0}")]
    Unauthorized(&'static str),
    #[error("{0}")]
    PublicInternal(&'static str),
    #[error("storage error: {0}")]
    Storage(String),
    #[error(transparent)]
    Config(#[from] crate::config::ConfigError),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Template(#[from] askama::Error),
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    message: &'a str,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let is_client_error = matches!(
            &self,
            AppError::BadRequest(_)
                | AppError::PayloadTooLarge(_)
                | AppError::NotFound(_)
                | AppError::Unauthorized(_)
        );

        let (status, _message) = match &self {
            AppError::BadRequest(message) => (StatusCode::BAD_REQUEST, *message),
            AppError::PayloadTooLarge(message) => (StatusCode::PAYLOAD_TOO_LARGE, *message),
            AppError::NotFound(message) => (StatusCode::NOT_FOUND, *message),
            AppError::Unauthorized(message) => (StatusCode::UNAUTHORIZED, *message),
            AppError::PublicInternal(message) => (StatusCode::INTERNAL_SERVER_ERROR, *message),
            AppError::Config(_)
            | AppError::Database(_)
            | AppError::Io(_)
            | AppError::Storage(_)
            | AppError::Template(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
        };

        if is_client_error {
            tracing::warn!(error = ?self, status = status.as_u16(), "request rejected");
        } else {
            tracing::error!(error = ?self, status = status.as_u16(), "request failed");
        }

        let (status, message) = match self {
            AppError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            AppError::PayloadTooLarge(message) => (StatusCode::PAYLOAD_TOO_LARGE, message),
            AppError::NotFound(message) => (StatusCode::NOT_FOUND, message),
            AppError::Unauthorized(message) => (StatusCode::UNAUTHORIZED, message),
            AppError::PublicInternal(message) => (StatusCode::INTERNAL_SERVER_ERROR, message),
            AppError::Config(_)
            | AppError::Database(_)
            | AppError::Io(_)
            | AppError::Storage(_)
            | AppError::Template(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
        };

        (status, Json(ErrorBody { message })).into_response()
    }
}
