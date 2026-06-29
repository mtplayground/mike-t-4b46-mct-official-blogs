use axum::{
    extract::{Form, State},
    http::{header, HeaderMap, HeaderValue, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::time::{SystemTime, UNIX_EPOCH};
use subtle::ConstantTimeEq;

use crate::{config::AdminCredentials, error::AppError, AppState};

pub const ADMIN_SESSION_COOKIE: &str = "mct_admin_session";
pub const ADMIN_SESSION_MAX_AGE_SECONDS: i64 = 8 * 60 * 60;
const ADMIN_SESSION_MAX_AGE_MILLIS: i64 = ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
const ADMIN_LOGIN_PATH: &str = "/admin/login";
const ADMIN_HOME_PATH: &str = "/admin";

type HmacSha256 = Hmac<Sha256>;

#[derive(Deserialize)]
pub struct LoginForm {
    username: Option<String>,
    password: Option<String>,
    next: Option<String>,
}

#[derive(Serialize)]
pub struct SessionResponse {
    authenticated: bool,
}

pub async fn login(
    State(state): State<AppState>,
    Form(form): Form<LoginForm>,
) -> Result<Response, AppError> {
    let next_path = safe_admin_next(form.next.as_deref());
    let valid_credentials = match (form.username.as_deref(), form.password.as_deref()) {
        (Some(username), Some(password)) => admin_credentials_match(
            username,
            password,
            &state.admin.username,
            &state.admin.password,
        ),
        _ => false,
    };

    if !valid_credentials {
        return redirect_to_login(&state.self_url);
    }

    let session = create_admin_session(&state.admin.password, now_millis())
        .ok_or(AppError::PublicInternal("Could not create admin session."))?;
    let location = absolute_url(&state.self_url, next_path)?;
    let cookie = session_cookie(
        &session,
        ADMIN_SESSION_MAX_AGE_SECONDS,
        state.self_url.starts_with("https://"),
    );

    redirect_with_cookie(location, cookie)
}

pub async fn logout(State(state): State<AppState>) -> Result<Response, AppError> {
    let location = absolute_url(&state.self_url, ADMIN_LOGIN_PATH)?;
    let cookie = session_cookie("", 0, state.self_url.starts_with("https://"));

    redirect_with_cookie(location, cookie)
}

pub fn ensure_admin_headers(state: &AppState, headers: &HeaderMap) -> Result<(), AppError> {
    let authenticated = admin_session_from_headers(headers)
        .map(|session| verify_admin_session(session, &state.admin.password, now_millis()))
        .unwrap_or(false);

    if authenticated {
        Ok(())
    } else {
        Err(AppError::Unauthorized("Admin session is required."))
    }
}

pub async fn verify_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<(StatusCode, Json<SessionResponse>), AppError> {
    let authenticated = admin_session_from_headers(&headers)
        .map(|session| verify_admin_session(session, &state.admin.password, now_millis()))
        .unwrap_or(false);

    Ok((StatusCode::OK, Json(SessionResponse { authenticated })))
}

#[allow(dead_code)]
pub async fn require_admin_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, AppError> {
    let authenticated = admin_session_from_headers(&headers)
        .map(|session| verify_admin_session(session, &state.admin.password, now_millis()))
        .unwrap_or(false);

    if authenticated {
        Ok(next.run(request).await)
    } else {
        Ok(StatusCode::UNAUTHORIZED.into_response())
    }
}

pub fn create_admin_session(secret: &str, now: i64) -> Option<String> {
    let expires_at = now.checked_add(ADMIN_SESSION_MAX_AGE_MILLIS)?;
    let signature = sign_message(&session_message(expires_at), secret)?;

    Some(format!("v1.{expires_at}.{signature}"))
}

pub fn verify_admin_session(value: &str, secret: &str, now: i64) -> bool {
    let mut parts = value.split('.');
    let version = parts.next();
    let expires_at = parts.next().and_then(|value| value.parse::<i64>().ok());
    let signature = parts.next();

    if parts.next().is_some() {
        return false;
    }

    let (Some("v1"), Some(expires_at), Some(signature)) = (version, expires_at, signature) else {
        return false;
    };

    if expires_at <= now {
        return false;
    }

    let Some(expected_signature) = sign_message(&session_message(expires_at), secret) else {
        return false;
    };

    constant_time_equal(signature, &expected_signature)
}

pub fn admin_credentials_match(
    input_username: &str,
    input_password: &str,
    expected_username: &str,
    expected_password: &str,
) -> bool {
    constant_time_equal(input_username.trim(), expected_username.trim())
        && constant_time_equal(input_password.trim(), expected_password.trim())
}

fn session_message(expires_at: i64) -> String {
    format!("admin:{expires_at}")
}

fn sign_message(message: &str, secret: &str) -> Option<String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).ok()?;
    mac.update(message.as_bytes());
    let signature = mac.finalize().into_bytes();

    Some(URL_SAFE_NO_PAD.encode(signature))
}

fn constant_time_equal(first: &str, second: &str) -> bool {
    let first = first.as_bytes();
    let second = second.as_bytes();
    let max_len = first.len().max(second.len());
    let mut mismatch = if first.len() == second.len() { 0 } else { 1 };

    for index in 0..max_len {
        let first_byte = first.get(index).copied().unwrap_or(0);
        let second_byte = second.get(index).copied().unwrap_or(0);
        mismatch |= first_byte ^ second_byte;
    }

    mismatch.ct_eq(&0).into()
}

fn safe_admin_next(value: Option<&str>) -> &str {
    match value {
        Some(value)
            if value.starts_with(ADMIN_HOME_PATH) && !value.starts_with(ADMIN_LOGIN_PATH) =>
        {
            value
        }
        _ => ADMIN_HOME_PATH,
    }
}

fn redirect_to_login(self_url: &str) -> Result<Response, AppError> {
    let mut login_url = absolute_url(self_url, ADMIN_LOGIN_PATH)?;
    login_url.push_str("?error=invalid");

    redirect(login_url)
}

fn absolute_url(self_url: &str, path: &str) -> Result<String, AppError> {
    let base = self_url
        .parse::<axum::http::Uri>()
        .map_err(|_| AppError::BadRequest("SELF_URL is invalid."))?;
    let Some(scheme) = base.scheme_str() else {
        return Err(AppError::BadRequest("SELF_URL is invalid."));
    };
    let Some(authority) = base.authority() else {
        return Err(AppError::BadRequest("SELF_URL is invalid."));
    };

    Ok(format!("{scheme}://{authority}{path}"))
}

fn redirect(location: String) -> Result<Response, AppError> {
    let location = HeaderValue::from_str(&location)
        .map_err(|_| AppError::BadRequest("Redirect location is invalid."))?;

    Ok((StatusCode::SEE_OTHER, [(header::LOCATION, location)]).into_response())
}

fn redirect_with_cookie(location: String, cookie: String) -> Result<Response, AppError> {
    let location = HeaderValue::from_str(&location)
        .map_err(|_| AppError::BadRequest("Redirect location is invalid."))?;
    let cookie = HeaderValue::from_str(&cookie)
        .map_err(|_| AppError::BadRequest("Session cookie is invalid."))?;

    Ok((
        StatusCode::SEE_OTHER,
        [(header::LOCATION, location), (header::SET_COOKIE, cookie)],
    )
        .into_response())
}

fn session_cookie(value: &str, max_age: i64, secure: bool) -> String {
    let secure = if secure { "; Secure" } else { "" };

    format!(
        "{ADMIN_SESSION_COOKIE}={value}; Max-Age={max_age}; Path=/admin; HttpOnly; SameSite=Lax{secure}"
    )
}

fn admin_session_from_headers(headers: &HeaderMap) -> Option<&str> {
    let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;

    cookie_header.split(';').find_map(|cookie| {
        let (name, value) = cookie.trim().split_once('=')?;
        (name == ADMIN_SESSION_COOKIE).then_some(value)
    })
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().try_into().unwrap_or(i64::MAX))
        .unwrap_or(0)
}

#[allow(dead_code)]
pub fn credentials_from_config(credentials: &AdminCredentials) -> (&str, &str) {
    (&credentials.username, &credentials.password)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn admin_session_format_matches_next_hmac_implementation() {
        let now = 1_700_000_000_000;
        let session = create_admin_session("test-secret", now).expect("session should sign");

        assert_eq!(
            session,
            "v1.1700028800000.uVorheJv1fc6jCGyh5Qxlsi9OLQczBKS0U7IXfkG2XA"
        );
    }

    #[test]
    fn admin_sessions_verify_with_same_secret() {
        let now = 1_700_000_000_000;
        let session = create_admin_session("test-secret", now).expect("session should sign");

        assert!(verify_admin_session(&session, "test-secret", now));
    }

    #[test]
    fn admin_sessions_reject_tampering_missing_secret_and_expiration() {
        let now = 1_700_000_000_000;
        let session = create_admin_session("test-secret", now).expect("session should sign");
        let tampered_session = session.replacen("v1.", "v1x.", 1);
        let expired_session =
            create_admin_session("test-secret", now - ADMIN_SESSION_MAX_AGE_MILLIS - 1)
                .expect("session should sign");

        assert!(!verify_admin_session(&tampered_session, "test-secret", now));
        assert!(!verify_admin_session(&session, "wrong-secret", now));
        assert!(!verify_admin_session(&expired_session, "test-secret", now));
    }

    #[test]
    fn admin_credentials_match_trims_and_compares_constant_path() {
        assert!(admin_credentials_match(
            " editor ",
            "  correct horse battery staple\n",
            "editor",
            "correct horse battery staple  ",
        ));
        assert!(!admin_credentials_match(
            "editor",
            "wrong horse battery staple",
            "editor",
            "correct horse battery staple",
        ));
    }

    #[test]
    fn safe_admin_next_rejects_non_admin_or_login_paths() {
        assert_eq!(safe_admin_next(Some("/admin/posts")), "/admin/posts");
        assert_eq!(safe_admin_next(Some("/admin/login")), "/admin");
        assert_eq!(safe_admin_next(Some("/blog")), "/admin");
        assert_eq!(safe_admin_next(None), "/admin");
    }
}
