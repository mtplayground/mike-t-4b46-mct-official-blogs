use axum::{
    extract::{rejection::JsonRejection, Form, State},
    http::StatusCode,
    response::Redirect,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::PgPool;

use crate::{error::AppError, subscribers, AppState};

const INVALID_EMAIL_MESSAGE: &str = "Enter a valid email address.";
const DUPLICATE_EMAIL_MESSAGE: &str = "That email is already subscribed.";
const CREATED_MESSAGE: &str = "You are on the list.";
const FAILURE_MESSAGE: &str = "Newsletter signup failed. Try again soon.";

#[derive(Serialize)]
pub struct NewsletterResponse {
    message: &'static str,
}

#[derive(Debug, Deserialize)]
pub struct NewsletterForm {
    email: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum NewsletterSignupStatus {
    Created,
    Duplicate,
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

    match subscribe_email(&state.pool, &email).await? {
        NewsletterSignupStatus::Created => Ok(response(StatusCode::CREATED, CREATED_MESSAGE)),
        NewsletterSignupStatus::Duplicate => Ok(response(StatusCode::CONFLICT, DUPLICATE_EMAIL_MESSAGE)),
    }
}

pub async fn subscribe_html(
    State(state): State<AppState>,
    Form(form): Form<NewsletterForm>,
) -> Result<Redirect, AppError> {
    let Some(email) = subscribers::normalize_subscriber_email_text(&form.email) else {
        return Ok(Redirect::to("/?newsletter=invalid"));
    };

    match subscribe_email(&state.pool, &email).await {
        Ok(NewsletterSignupStatus::Created) => Ok(Redirect::to("/?newsletter=subscribed")),
        Ok(NewsletterSignupStatus::Duplicate) => Ok(Redirect::to("/?newsletter=duplicate")),
        Err(error) => {
            tracing::error!(error = ?error, email = %email, "failed to handle HTML newsletter signup");
            Ok(Redirect::to("/?newsletter=failed"))
        }
    }
}

async fn subscribe_email(
    pool: &PgPool,
    email: &str,
) -> Result<NewsletterSignupStatus, AppError> {
    match subscribers::subscriber_exists(pool, email).await {
        Ok(true) => return Ok(NewsletterSignupStatus::Duplicate),
        Ok(false) => {}
        Err(error) => {
            tracing::error!(error = ?error, email = %email, "failed to check newsletter subscriber");
            return Err(AppError::PublicInternal(FAILURE_MESSAGE));
        }
    }

    match subscribers::create_subscriber(pool, email).await {
        Ok(()) => Ok(NewsletterSignupStatus::Created),
        Err(error) if subscribers::is_unique_violation(&error) => Ok(NewsletterSignupStatus::Duplicate),
        Err(error) => {
            tracing::error!(error = ?error, email = %email, "failed to create newsletter subscriber");
            Err(AppError::PublicInternal(FAILURE_MESSAGE))
        }
    }
}

fn response(status: StatusCode, message: &'static str) -> (StatusCode, Json<NewsletterResponse>) {
    (status, Json(NewsletterResponse { message }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn html_newsletter_statuses_map_to_expected_query_values() {
        assert_eq!(NewsletterSignupStatus::Created, NewsletterSignupStatus::Created);
        assert_ne!(NewsletterSignupStatus::Created, NewsletterSignupStatus::Duplicate);
    }
}
