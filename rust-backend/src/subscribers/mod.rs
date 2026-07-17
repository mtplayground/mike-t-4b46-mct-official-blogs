use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

const EMAIL_MAX_LENGTH: usize = 320;

pub fn normalize_subscriber_email(value: Option<&Value>) -> Option<String> {
    normalize_subscriber_email_text(value.as_ref()?.as_str()?)
}

pub fn normalize_subscriber_email_text(value: &str) -> Option<String> {
    let email = value.trim().to_lowercase();

    if email.is_empty() || email.len() > EMAIL_MAX_LENGTH || email.chars().any(char::is_whitespace)
    {
        return None;
    }

    let (local_part, domain_part) = email.split_once('@')?;

    let Some((domain_prefix, domain_suffix)) = domain_part.split_once('.') else {
        return None;
    };

    if local_part.is_empty()
        || domain_part.is_empty()
        || local_part.contains('@')
        || domain_part.contains('@')
        || domain_prefix.is_empty()
        || domain_suffix.is_empty()
    {
        return None;
    }

    Some(email)
}

pub async fn subscriber_exists(pool: &PgPool, email: &str) -> Result<bool, sqlx::Error> {
    let exists =
        sqlx::query_scalar::<_, bool>("SELECT EXISTS(SELECT 1 FROM subscribers WHERE email = $1)")
            .bind(email)
            .fetch_one(pool)
            .await?;

    Ok(exists)
}

pub async fn create_subscriber(pool: &PgPool, email: &str) -> Result<(), sqlx::Error> {
    sqlx::query("INSERT INTO subscribers (id, email) VALUES ($1, $2)")
        .bind(Uuid::new_v4().to_string())
        .bind(email)
        .execute(pool)
        .await?;

    Ok(())
}

pub fn is_unique_violation(error: &sqlx::Error) -> bool {
    match error {
        sqlx::Error::Database(database_error) => database_error.code().as_deref() == Some("23505"),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::{normalize_subscriber_email, normalize_subscriber_email_text};
    use serde_json::json;

    #[test]
    fn normalize_subscriber_email_trims_and_lowercases() {
        assert_eq!(
            normalize_subscriber_email(Some(&json!("  Reader@Example.COM  "))),
            Some("reader@example.com".to_string())
        );
        assert_eq!(
            normalize_subscriber_email_text("  Reader@Example.COM  "),
            Some("reader@example.com".to_string())
        );
    }

    #[test]
    fn normalize_subscriber_email_rejects_invalid_values() {
        assert_eq!(
            normalize_subscriber_email(Some(&json!("not-an-email"))),
            None
        );
        assert_eq!(normalize_subscriber_email(Some(&json!("a@b"))), None);
        assert_eq!(normalize_subscriber_email(Some(&json!("a@example."))), None);
        assert_eq!(normalize_subscriber_email(Some(&json!("a@.example"))), None);
        assert_eq!(
            normalize_subscriber_email(Some(&json!("a b@example.com"))),
            None
        );
        assert_eq!(
            normalize_subscriber_email(Some(&json!("a@@example.com"))),
            None
        );
        assert_eq!(normalize_subscriber_email(Some(&json!(42))), None);
        assert_eq!(normalize_subscriber_email(None), None);
    }

    #[test]
    fn normalize_subscriber_email_enforces_max_length() {
        let too_long = format!("{}@example.com", "a".repeat(309));

        assert_eq!(too_long.len(), 321);
        assert_eq!(normalize_subscriber_email(Some(&json!(too_long))), None);
    }
}

use axum::{extract::State, http::HeaderMap, Json};
use chrono::NaiveDateTime;
use serde::Serialize;

use crate::{auth, error::AppError, AppState};

#[derive(Debug, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminSubscriber {
    pub(crate) id: String,
    pub(crate) email: String,
    pub(crate) created_at: NaiveDateTime,
}

pub(crate) async fn fetch_admin_subscribers(
    state: &AppState,
) -> Result<Vec<AdminSubscriber>, AppError> {
    Ok(sqlx::query_as::<_, AdminSubscriber>(
        "SELECT id, email, created_at FROM subscribers ORDER BY created_at DESC",
    )
    .fetch_all(&state.pool)
    .await?)
}

pub async fn list_admin_subscribers(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminSubscriber>>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;

    Ok(Json(fetch_admin_subscribers(&state).await?))
}
