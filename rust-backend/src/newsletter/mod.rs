use axum::{
    extract::{rejection::JsonRejection, State},
    http::StatusCode,
    Json,
};
use serde::Serialize;
use serde_json::Value;

use crate::{error::AppError, subscribers, AppState};

const INVALID_EMAIL_MESSAGE: &str = "Enter a valid email address.";
const DUPLICATE_EMAIL_MESSAGE: &str = "That email is already subscribed.";
const CREATED_MESSAGE: &str = "You are on the list.";
const FAILURE_MESSAGE: &str = "Newsletter signup failed. Try again soon.";

#[derive(Serialize)]
pub struct NewsletterResponse {
    message: &'static str,
}

pub async fn subscribe(
    State(state): State<AppState>,
    payload: Result<Json<Value>, JsonRejection>,
) -> Result<(StatusCode, Json<NewsletterResponse>), AppError> {
    let email = payload
        .ok()
        .and_then(|Json(value)| subscribers::normalize_subscriber_email(value.get("email")));

    let Some(email) = email else {
        return Ok(response(StatusCode::BAD_REQUEST, INVALID_EMAIL_MESSAGE));
    };

    match subscribers::subscriber_exists(&state.pool, &email).await {
        Ok(true) => return Ok(response(StatusCode::CONFLICT, DUPLICATE_EMAIL_MESSAGE)),
        Ok(false) => {}
        Err(error) => {
            tracing::error!(error = ?error, email = %email, "failed to check newsletter subscriber");
            return Err(AppError::PublicInternal(FAILURE_MESSAGE));
        }
    }

    match subscribers::create_subscriber(&state.pool, &email).await {
        Ok(()) => Ok(response(StatusCode::CREATED, CREATED_MESSAGE)),
        Err(error) if subscribers::is_unique_violation(&error) => {
            Ok(response(StatusCode::CONFLICT, DUPLICATE_EMAIL_MESSAGE))
        }
        Err(error) => {
            tracing::error!(error = ?error, email = %email, "failed to create newsletter subscriber");
            Err(AppError::PublicInternal(FAILURE_MESSAGE))
        }
    }
}

fn response(status: StatusCode, message: &'static str) -> (StatusCode, Json<NewsletterResponse>) {
    (status, Json(NewsletterResponse { message }))
}
