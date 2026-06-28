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
    NotFound(&'static str),
    #[error("storage error: {0}")]
    Storage(String),
    #[error(transparent)]
    Config(#[from] crate::config::ConfigError),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

#[derive(Serialize)]
struct ErrorBody<'a> {
    message: &'a str,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        tracing::error!(error = ?self, "request failed");

        let (status, message) = match self {
            AppError::BadRequest(message) => (StatusCode::BAD_REQUEST, message),
            AppError::NotFound(message) => (StatusCode::NOT_FOUND, message),
            AppError::Config(_)
            | AppError::Database(_)
            | AppError::Io(_)
            | AppError::Storage(_) => (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error"),
        };

        (status, Json(ErrorBody { message })).into_response()
    }
}
