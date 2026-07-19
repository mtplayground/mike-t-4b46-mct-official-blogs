mod auth;
mod config;
mod db;
mod error;
mod html;
mod models;
mod newsletter;
mod posts;
mod revalidate;
mod storage;
mod subscribers;
mod views;

use axum::{
    extract::{DefaultBodyLimit, Multipart, Path, Query, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Datelike;
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use config::{AdminCredentials, AppConfig, RevalidationConfig};
use db::DbPool;
use error::AppError;
use serde::{Deserialize, Serialize};
use storage::StorageClient;
use tower_http::{
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};
use std::{
    env,
    io::{self, Write},
    path::PathBuf,
    thread,
    time::Duration,
};

const ADMIN_MULTIPART_BODY_LIMIT_BYTES: usize = 50 * 1024 * 1024;

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) pool: DbPool,
    pub(crate) storage: StorageClient,
    pub(crate) admin: AdminCredentials,
    pub(crate) revalidation: RevalidationConfig,
    pub(crate) self_url: String,
}

#[derive(Serialize)]
struct HealthResponse<'a> {
    status: &'a str,
}

#[derive(Debug, Default, Deserialize)]
struct HomeQuery {
    newsletter: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
struct AdminQuery {
    notice: Option<String>,
    error: Option<String>,
    next: Option<String>,
}

#[tokio::main]
async fn main() -> Result<(), AppError> {
    init_tracing();

    let config = AppConfig::from_env()?;
    let listen_addr = config.listen_addr;
    tracing::info!(
        self_url = %config.self_url,
        object_storage_bucket = %config.object_storage.bucket,
        object_storage_prefix = %config.object_storage.prefix,
        object_storage_endpoint = %config.object_storage.endpoint,
        object_storage_region = %config.object_storage.region,
        object_storage_force_path_style = config.object_storage.force_path_style,
        admin_username = %config.admin.username,
        "Runtime configuration loaded"
    );
    let pool = db::connect(&config.database_url)?;
    let storage = StorageClient::from_config(&config.object_storage, &config.self_url).await;
    let app = build_router(AppState {
        pool,
        storage,
        admin: config.admin,
        revalidation: config.revalidation,
        self_url: config.self_url,
    });
    let listener = TcpListener::bind(listen_addr).await?;

    tracing::info!(%listen_addr, "Rust backend listening");
    emit_startup_log_flush_if_requested();
    axum::serve(listener, app).await?;

    Ok(())
}

fn init_tracing() {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer())
        .init();
}

fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/", get(public_home))
        .route("/blog", get(public_blog_redirect))
        .route("/blog/:slug", get(public_post))
        .route("/sitemap.xml", get(sitemap_xml))
        .route("/robots.txt", get(robots_txt))
        .route_service("/favicon.ico", ServeFile::new(app_path("public/favicon.ico")))
        .route_service("/favicon.svg", ServeFile::new(app_path("public/favicon.svg")))
        .nest_service("/assets", ServeDir::new(app_path("public/assets")))
        .nest_service("/images", ServeDir::new(app_path("public/images")))
        .route("/health", get(health))
        .route("/api/posts", get(posts::list_posts))
        .route("/newsletter", post(newsletter::subscribe_html))
        .route("/admin/login", get(admin_login_page).post(auth::login))
        .route("/admin/logout", post(auth::logout))
        .route("/admin", get(admin_dashboard_page))
        .route("/admin/posts/new", get(admin_new_post_page))
        .route("/admin/posts", post(admin_create_post_html))
        .route("/admin/posts/:id/edit", get(admin_edit_post_page))
        .route("/admin/posts/:id/update", post(admin_update_post_html))
        .route("/admin/posts/:id/publish", post(admin_publish_post_html))
        .route("/admin/posts/:id/unpublish", post(admin_unpublish_post_html))
        .route("/admin/posts/:id/delete", post(admin_delete_post_html))
        .route("/admin/subscribers", get(admin_subscribers_page))
        .route("/api/newsletter", post(newsletter::subscribe))
        .route("/api/admin/login", post(auth::login))
        .route("/api/admin/logout", post(auth::logout))
        .route("/api/admin/session", get(auth::verify_session))
        .route("/api/admin/categories", get(posts::admin::list_categories))
        .route(
            "/api/admin/posts",
            get(posts::admin::list_admin_posts).post(posts::admin::create_admin_post),
        )
        .route(
            "/api/admin/posts/:id",
            get(posts::admin::get_admin_post)
                .put(posts::admin::update_admin_post)
                .delete(posts::admin::delete_admin_post),
        )
        .route(
            "/api/admin/posts/:id/update",
            post(posts::admin::update_admin_post),
        )
        .route(
            "/api/admin/posts/:id/publish",
            post(posts::admin::publish_admin_post),
        )
        .route(
            "/api/admin/posts/:id/unpublish",
            post(posts::admin::unpublish_admin_post),
        )
        .route(
            "/api/admin/subscribers",
            get(subscribers::list_admin_subscribers),
        )
        .route("/api/posts/:slug", get(posts::get_post))
        .route(
            "/api/posts/:slug/views",
            get(views::get_views).post(views::increment_views),
        )
        .route("/api/image/*key", get(storage::image_redirect))
        .layer(DefaultBodyLimit::max(ADMIN_MULTIPART_BODY_LIMIT_BYTES))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

fn app_path(relative_path: &str) -> PathBuf {
    let root = env::var("APP_ROOT")
        .map(PathBuf::from)
        .ok()
        .or_else(|| env::current_dir().ok().filter(|path| path.join("public").is_dir()))
        .or_else(discover_app_root_from_exe)
        .unwrap_or_else(|| PathBuf::from("."));

    root.join(relative_path)
}

fn discover_app_root_from_exe() -> Option<PathBuf> {
    let mut path = env::current_exe().ok()?;
    while path.pop() {
        if path.join("public").is_dir() && path.join("rust-backend").is_dir() {
            return Some(path);
        }
    }
    None
}

fn emit_startup_log_flush_if_requested() {
    if env::var("MCT_VERIFY_LOG_FLUSH").as_deref() != Ok("1") {
        return;
    }

    for index in 1..=240 {
        println!("startup verification log baseline index={index}");
        let _ = io::stdout().flush();
        thread::sleep(Duration::from_millis(5));
    }
}

async fn admin_login_page(
    Query(query): Query<AdminQuery>,
) -> Result<Html<String>, AppError> {
    let html = html::admin::render_login_page(
        html::seo::SeoMetadata::with_canonical_url(
            "Admin sign in",
            "Sign in to manage Ideavibes posts.",
            "/admin/login",
        ),
        query.error.as_deref() == Some("invalid"),
        query.next.unwrap_or_else(|| "/admin".to_owned()),
    )?;

    Ok(Html(html))
}

async fn admin_dashboard_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AdminQuery>,
) -> Result<Response, AppError> {
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login("/admin");
    }

    let posts = posts::admin::fetch_admin_posts(&state).await?;
    let html = html::admin::render_dashboard_page(
        html::seo::SeoMetadata::with_canonical_url(
            "Admin posts",
            "Manage Ideavibes posts.",
            "/admin",
        ),
        query.notice.map(html::admin::Notice::new),
        &posts,
    )?;

    Ok(Html(html).into_response())
}

async fn admin_new_post_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<AdminQuery>,
) -> Result<Response, AppError> {
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login("/admin/posts/new");
    }

    let categories = posts::admin::fetch_admin_categories(&state).await?;
    let context = html::admin::PostFormContext::new(
        html::seo::SeoMetadata::with_canonical_url(
            "New post",
            "Create an Ideavibes post.",
            "/admin/posts/new",
        ),
        categories,
        query.notice.map(html::admin::Notice::new),
    );
    Ok(Html(html::admin::render_post_form_page(context)?).into_response())
}

async fn admin_edit_post_page(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(query): Query<AdminQuery>,
) -> Result<Response, AppError> {
    let next = format!("/admin/posts/{id}/edit");
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login(&next);
    }

    let post = posts::admin::fetch_admin_post(&state, &id)
        .await?
        .ok_or(AppError::NotFound("Post not found."))?;
    let categories = posts::admin::fetch_admin_categories(&state).await?;
    let context = html::admin::PostFormContext::edit(
        html::seo::SeoMetadata::with_canonical_url(
            format!("Edit {}", post.title),
            "Edit an Ideavibes post.",
            next.clone(),
        ),
        &post,
        categories,
        query.notice.map(html::admin::Notice::new),
    );
    Ok(Html(html::admin::render_post_form_page(context)?).into_response())
}

async fn admin_subscribers_page(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Response, AppError> {
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login("/admin/subscribers");
    }

    let subscribers = subscribers::fetch_admin_subscribers(&state).await?;
    let html = html::admin::render_subscribers_page(
        html::seo::SeoMetadata::with_canonical_url(
            "Admin subscribers",
            "Review Ideavibes newsletter subscribers.",
            "/admin/subscribers",
        ),
        &subscribers,
    )?;
    Ok(Html(html).into_response())
}

async fn admin_create_post_html(
    State(state): State<AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Response, AppError> {
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login("/admin/posts/new");
    }

    match posts::admin::create_admin_post(State(state), headers, multipart).await {
        Ok(response) => Ok(response),
        Err(error) => redirect_with_notice("/admin/posts/new", app_error_notice(&error)),
    }
}

async fn admin_update_post_html(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    multipart: Multipart,
) -> Result<Response, AppError> {
    let edit_path = format!("/admin/posts/{id}/edit");
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login(&edit_path);
    }

    match posts::admin::update_admin_post(State(state), headers, Path(id), multipart).await {
        Ok(response) => Ok(response),
        Err(error) => redirect_with_notice(&edit_path, app_error_notice(&error)),
    }
}

async fn admin_publish_post_html(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login("/admin");
    }

    match posts::admin::publish_admin_post(State(state), headers, Path(id)).await {
        Ok(response) => Ok(response),
        Err(error) => redirect_with_notice("/admin", app_error_notice(&error)),
    }
}

async fn admin_unpublish_post_html(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login("/admin");
    }

    match posts::admin::unpublish_admin_post(State(state), headers, Path(id)).await {
        Ok(response) => Ok(response),
        Err(error) => redirect_with_notice("/admin", app_error_notice(&error)),
    }
}

async fn admin_delete_post_html(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, AppError> {
    if !auth::is_admin_authenticated(&state, &headers) {
        return redirect_to_admin_login("/admin");
    }

    match posts::admin::delete_admin_post(State(state), headers, Path(id)).await {
        Ok(response) => Ok(response),
        Err(error) => redirect_with_notice("/admin", app_error_notice(&error)),
    }
}

fn redirect_to_admin_login(next: &str) -> Result<Response, AppError> {
    redirect_response(&format!("/admin/login?next={}", encode_query_value(next)))
}

fn redirect_with_notice(path: &str, notice: &str) -> Result<Response, AppError> {
    redirect_response(&format!("{path}?notice={}", encode_query_value(notice)))
}

fn redirect_response(location: &str) -> Result<Response, AppError> {
    let location = HeaderValue::from_str(location)
        .map_err(|_| AppError::BadRequest("Redirect location is invalid."))?;
    Ok((StatusCode::SEE_OTHER, [(header::LOCATION, location)]).into_response())
}

fn encode_query_value(value: &str) -> String {
    utf8_percent_encode(value, NON_ALPHANUMERIC).to_string()
}

fn app_error_notice(error: &AppError) -> &'static str {
    match error {
        AppError::BadRequest(message)
        | AppError::PayloadTooLarge(message)
        | AppError::NotFound(message)
        | AppError::Unauthorized(message)
        | AppError::PublicInternal(message) => message,
        AppError::Storage(_)
        | AppError::Config(_)
        | AppError::Database(_)
        | AppError::Io(_)
        | AppError::Template(_) => "Admin action failed. Try again soon.",
    }
}

async fn public_home(
    State(state): State<AppState>,
    Query(query): Query<HomeQuery>,
) -> Result<Html<String>, AppError> {
    let response = posts::fetch_public_post_list(&state).await?;
    let context = html::public::HomePageContext {
        seo: html::seo::SeoMetadata::home(&state.self_url),
        heading: String::new(),
        intro: String::new(),
        newsletter_notice: newsletter_notice_from_query(query.newsletter.as_deref()),
        hero_post: response.hero_post.as_ref().map(post_card_context_from_post),
        posts: response.posts.iter().map(post_card_context_from_post).collect(),
    };

    Ok(Html(html::public::render_home_page(context)?))
}

async fn public_blog_redirect() -> Redirect {
    Redirect::temporary("/")
}

async fn public_post(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Response, AppError> {
    let Some(post) = posts::fetch_public_post_by_slug(&state, &slug).await? else {
        let context = html::public::NotFoundPageContext {
            seo: html::seo::SeoMetadata::not_found(&state.self_url, &format!("/blog/{slug}")),
            heading: "Article not found".to_owned(),
            message: "The article may have moved, been unpublished, or never existed.".to_owned(),
        };
        let html = html::public::render_not_found_page(context)?;

        return Ok((axum::http::StatusCode::NOT_FOUND, Html(html)).into_response());
    };

    let body_html = html::markdown::render_markdown_to_html(&post.body, &state.storage).into_inner();
    let current_views = match views::increment_post_views_by_slug(&state.pool, &post.slug).await {
        Ok(Some(views)) => views,
        Ok(None) => post.views,
        Err(error) => {
            tracing::error!(error = ?error, slug = %post.slug, "failed to increment HTML article view");
            post.views
        }
    };
    let title = post.title.clone();
    let context = html::public::PostPageContext {
        seo: html::seo::SeoMetadata::article(
            &state.self_url,
            &post,
            public_url(&state.self_url, &format!("/blog/{}", post.slug)),
        ),
        title,
        excerpt: post.excerpt.clone(),
        category_name: post.category.name.clone(),
        published_at_label: post
            .published_at
            .map(format_date)
            .unwrap_or_else(|| "Draft".to_owned()),
        author_name: post.author_name.clone(),
        author_intro: post.author_intro.clone(),
        author_avatar_url: post.author_avatar_url.clone(),
        body_html,
        cover_image_url: post.cover_image_url.clone(),
        company_name: post.company_name.clone(),
        company_intro: post.company_intro.clone(),
        company_logo_url: post.company_logo_url.clone(),
        company_website_url: post.company_website_url.clone(),
        views: current_views,
    };

    Ok(Html(html::public::render_post_page(context)?).into_response())
}

async fn sitemap_xml(State(state): State<AppState>) -> Result<Response, AppError> {
    let response = posts::fetch_public_post_list(&state).await?;
    let body = html::seo::render_sitemap_xml(&state.self_url, &response.posts);

    Ok(([(header::CONTENT_TYPE, "application/xml; charset=utf-8")], body).into_response())
}

async fn robots_txt(State(state): State<AppState>) -> Response {
    let body = html::seo::render_robots_txt(&state.self_url);

    ([(header::CONTENT_TYPE, "text/plain; charset=utf-8")], body).into_response()
}

fn newsletter_notice_from_query(value: Option<&str>) -> Option<html::public::NewsletterNotice> {
    match value {
        Some("subscribed") => Some(html::public::NewsletterNotice::success(
            "You are on the list.",
        )),
        Some("duplicate") => Some(html::public::NewsletterNotice::error(
            "That email is already subscribed.",
        )),
        Some("invalid") => Some(html::public::NewsletterNotice::error(
            "Enter a valid email address.",
        )),
        Some("failed") => Some(html::public::NewsletterNotice::error(
            "Newsletter signup failed. Try again soon.",
        )),
        _ => None,
    }
}

fn post_card_context_from_post(post: &posts::PublicPost) -> html::public::PostCardContext {
    html::public::PostCardContext {
        title: post.title.clone(),
        slug: post.slug.clone(),
        excerpt: post.excerpt.clone(),
        category_name: post.category.name.clone(),
        published_at_label: post.published_at.map(format_date).unwrap_or_default(),
        cover_image_url: post
            .cover_image_url
            .clone(),
    }
}

fn public_url(base_url: &str, path: &str) -> String {
    format!("{}{}", base_url.trim_end_matches('/'), path)
}

fn format_date(value: chrono::NaiveDateTime) -> String {
    let date = value.date();
    format!(
        "{} {}, {}",
        month_name(date.month()),
        date.day(),
        date.year()
    )
}

fn month_name(month: u32) -> &'static str {
    match month {
        1 => "January",
        2 => "February",
        3 => "March",
        4 => "April",
        5 => "May",
        6 => "June",
        7 => "July",
        8 => "August",
        9 => "September",
        10 => "October",
        11 => "November",
        12 => "December",
        _ => "Unknown",
    }
}

async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse<'static>>, AppError> {
    let _pool = state.pool.clone();

    Ok(Json(HealthResponse { status: "ok" }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{
        body::{to_bytes, Body},
        extract::Multipart,
        http::{header, Request, StatusCode},
        routing::post,
        Router,
    };
    use chrono::NaiveDateTime;
    use crate::models::{CategorySlug, PostStatus};
    use sqlx::Row;
    use tower::ServiceExt;

    #[test]
    fn public_html_helpers_build_canonical_urls_and_dates() {
        let published_at = NaiveDateTime::parse_from_str(
            "2026-07-17 13:45:00",
            "%Y-%m-%d %H:%M:%S",
        )
        .expect("valid test datetime");

        assert_eq!(
            public_url("https://example.test/", "/blog/post"),
            "https://example.test/blog/post"
        );
        assert_eq!(format_date(published_at), "July 17, 2026");
    }

    #[test]
    fn post_card_context_uses_sixteen_by_nine_cover_when_square_cover_exists() {
        let published_at = NaiveDateTime::parse_from_str(
            "2026-07-17 13:45:00",
            "%Y-%m-%d %H:%M:%S",
        )
        .expect("valid test datetime");
        let post = posts::PublicPost {
            id: "post-1".to_owned(),
            title: "Post title".to_owned(),
            slug: "post-title".to_owned(),
            excerpt: "Post excerpt.".to_owned(),
            body: "Post body.".to_owned(),
            cover_image_key: Some("post-images/2026/07/cover.png".to_owned()),
            cover_image_url: Some("https://example.test/cover-16x9.png".to_owned()),
            square_cover_image_key: Some("post-images/2026/07/square.png".to_owned()),
            square_cover_image_url: Some("https://example.test/cover-1x1.png".to_owned()),
            is_featured: true,
            views: 0,
            author_name: "Alex Writer".to_owned(),
            author_intro: "Writes about shipping.".to_owned(),
            author_avatar_key: None,
            author_avatar_url: None,
            company_name: posts::DEFAULT_COMPANY_NAME.to_owned(),
            company_intro: String::new(),
            company_logo_key: None,
            company_logo_url: posts::DEFAULT_COMPANY_LOGO_URL.to_owned(),
            company_website_url: posts::DEFAULT_COMPANY_WEBSITE_URL.to_owned(),
            status: PostStatus::Published,
            published_at: Some(published_at),
            category_id: "cat-1".to_owned(),
            category: posts::CategorySummary {
                id: "cat-1".to_owned(),
                slug: CategorySlug::Thoughts,
                name: "Thoughts".to_owned(),
                description: None,
            },
            created_at: published_at,
            updated_at: published_at,
        };

        let context = post_card_context_from_post(&post);

        assert_eq!(
            context.cover_image_url.as_deref(),
            Some("https://example.test/cover-16x9.png")
        );
    }

    fn multipart_body(boundary: &str, fields: &[(&str, &str)]) -> String {
        let mut body = String::new();

        for (name, value) in fields {
            body.push_str(&format!("--{boundary}\r\n"));
            body.push_str(&format!(
                "Content-Disposition: form-data; name=\"{name}\"\r\n\r\n"
            ));
            body.push_str(value);
            body.push_str("\r\n");
        }

        body.push_str(&format!("--{boundary}--\r\n"));
        body
    }

    fn multipart_file_body(
        boundary: &str,
        name: &str,
        content_type: &str,
        bytes: &[u8],
    ) -> Vec<u8> {
        let mut body = Vec::new();
        body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
        body.extend_from_slice(
            format!(
                "Content-Disposition: form-data; name=\"{name}\"; filename=\"upload.bin\"\r\n"
            )
            .as_bytes(),
        );
        body.extend_from_slice(format!("Content-Type: {content_type}\r\n\r\n").as_bytes());
        body.extend_from_slice(bytes);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());
        body
    }

    async fn drain_multipart(mut multipart: Multipart) -> Result<&'static str, StatusCode> {
        while let Some(field) = multipart
            .next_field()
            .await
            .map_err(|_| StatusCode::BAD_REQUEST)?
        {
            let _ = field.bytes().await.map_err(|_| StatusCode::BAD_REQUEST)?;
        }

        Ok("ok")
    }

    #[tokio::test]
    async fn configured_multipart_limit_accepts_bodies_above_axum_default() {
        let boundary = "configured-limit-boundary";
        let bytes = vec![b'a'; 2 * 1024 * 1024 + 1];
        let body = multipart_file_body(boundary, "coverImage", "image/png", &bytes);
        assert!(body.len() < ADMIN_MULTIPART_BODY_LIMIT_BYTES);

        let response = Router::new()
            .route("/multipart", post(drain_multipart))
            .layer(DefaultBodyLimit::max(ADMIN_MULTIPART_BODY_LIMIT_BYTES))
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/multipart")
                    .header(
                        header::CONTENT_TYPE,
                        format!("multipart/form-data; boundary={boundary}"),
                    )
                    .body(Body::from(body))
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");

        assert_eq!(response.status(), StatusCode::OK);
    }

    async fn test_storage() -> StorageClient {
        StorageClient::from_config(
            &config::ObjectStorageConfig {
                access_key_id: "access".to_owned(),
                secret_access_key: "secret".to_owned(),
                bucket: "bucket".to_owned(),
                prefix: "tenant-prefix/".to_owned(),
                endpoint: "https://storage.example.com".to_owned(),
                region: "auto".to_owned(),
                force_path_style: true,
            },
            "https://blog.example.com",
        )
        .await
    }

    async fn first_category_id(pool: &DbPool) -> Result<String, sqlx::Error> {
        if let Some(row) = sqlx::query("SELECT id FROM categories ORDER BY created_at ASC LIMIT 1")
            .fetch_optional(pool)
            .await?
        {
            return Ok(row.get("id"));
        }

        let category_id = "route-test-category";
        sqlx::query(
            r#"
            INSERT INTO categories (id, slug, name, description, created_at, updated_at)
            VALUES ($1, 'THOUGHTS'::"CategorySlug", 'Thoughts', NULL, NOW(), NOW())
            ON CONFLICT (slug) DO UPDATE SET updated_at = NOW()
            "#,
        )
        .bind(category_id)
        .execute(pool)
        .await?;

        let row = sqlx::query("SELECT id FROM categories WHERE slug = 'THOUGHTS'::\"CategorySlug\"")
            .fetch_one(pool)
            .await?;
        Ok(row.get("id"))
    }

    #[tokio::test]
    async fn post_admin_update_route_updates_existing_post() {
        let Ok(database_url) = std::env::var("DATABASE_URL") else {
            eprintln!("DATABASE_URL is not set; skipping route-backed update test");
            return;
        };
        let pool = db::connect(&database_url).expect("DATABASE_URL should be valid");
        let db_ready = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            sqlx::query("SELECT 1").execute(&pool),
        )
        .await;
        if !matches!(db_ready, Ok(Ok(_))) {
            eprintln!("DATABASE_URL is not reachable; skipping route-backed update test");
            return;
        }

        let category_id = first_category_id(&pool)
            .await
            .expect("test category should be available");
        let post_id = format!("route-test-post-{}", uuid::Uuid::new_v4());
        let original_slug = format!("route-test-{}", uuid::Uuid::new_v4());

        sqlx::query(
            r#"
            INSERT INTO posts (
                id, title, slug, excerpt, body, status, category_id,
                author_name, author_intro, created_at, updated_at
            )
            VALUES (
                $1, 'Before title', $2, 'Before excerpt', 'Before body',
                'DRAFT'::"PostStatus", $3, '', '', NOW(), NOW()
            )
            "#,
        )
        .bind(&post_id)
        .bind(&original_slug)
        .bind(&category_id)
        .execute(&pool)
        .await
        .expect("test post should be inserted");

        let state = AppState {
            pool: pool.clone(),
            storage: test_storage().await,
            admin: AdminCredentials {
                username: "admin".to_owned(),
                password: "secret".to_owned(),
            },
            revalidation: RevalidationConfig {
                url: "http://127.0.0.1:1/api/revalidate".to_owned(),
                secret: "test-secret".to_owned(),
            },
            self_url: "https://blog.example.com".to_owned(),
        };
        let now_millis = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_millis() as i64;
        let session = auth::create_admin_session(&state.admin.password, now_millis)
            .expect("session should be created");
        let boundary = "route-test-boundary";
        let updated_title = "Updated title from POST route";
        let body = multipart_body(
            boundary,
            &[
                ("title", updated_title),
                ("slug", &original_slug),
                ("excerpt", "Updated excerpt"),
                ("categoryId", &category_id),
                ("status", "DRAFT"),
                ("authorName", ""),
                ("authorIntro", ""),
                ("body", "Updated body"),
            ],
        );

        let response = build_router(state)
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri(format!("/api/admin/posts/{post_id}/update"))
                    .header(
                        header::CONTENT_TYPE,
                        format!("multipart/form-data; boundary={boundary}"),
                    )
                    .header(
                        header::COOKIE,
                        format!("{}={session}", auth::ADMIN_SESSION_COOKIE),
                    )
                    .body(Body::from(body))
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");

        assert_eq!(response.status(), StatusCode::SEE_OTHER);

        let row = sqlx::query("SELECT title, excerpt, body FROM posts WHERE id = $1")
            .bind(&post_id)
            .fetch_one(&pool)
            .await
            .expect("updated post should be fetched");
        assert_eq!(row.get::<String, _>("title"), updated_title);
        assert_eq!(row.get::<String, _>("excerpt"), "Updated excerpt");
        assert_eq!(row.get::<String, _>("body"), "Updated body");

        sqlx::query("DELETE FROM posts WHERE id = $1")
            .bind(&post_id)
            .execute(&pool)
            .await
            .expect("test post should be cleaned up");
    }

    async fn optional_db_state(test_name: &str) -> Option<AppState> {
        let Ok(database_url) = std::env::var("DATABASE_URL") else {
            eprintln!("DATABASE_URL is not set; skipping {test_name}");
            return None;
        };
        let pool = db::connect(&database_url).expect("DATABASE_URL should be valid");
        let db_ready = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            sqlx::query("SELECT 1").execute(&pool),
        )
        .await;
        if !matches!(db_ready, Ok(Ok(_))) {
            eprintln!("DATABASE_URL is not reachable; skipping {test_name}");
            return None;
        }

        Some(AppState {
            pool,
            storage: StorageClient::for_tests("https://blog.example.com"),
            admin: AdminCredentials {
                username: "configured_admin".to_owned(),
                password: "configured_secret".to_owned(),
            },
            revalidation: RevalidationConfig {
                url: "http://127.0.0.1:1/api/revalidate".to_owned(),
                secret: "test-secret".to_owned(),
            },
            self_url: "https://blog.example.com".to_owned(),
        })
    }

    async fn response_text(response: Response) -> String {
        let bytes = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body should be readable");
        String::from_utf8(bytes.to_vec()).expect("response body should be utf-8")
    }

    async fn cleanup_issue188_rows(pool: &DbPool, slug_prefix: &str, email_prefix: &str) {
        sqlx::query("DELETE FROM posts WHERE slug LIKE $1")
            .bind(format!("{slug_prefix}%"))
            .execute(pool)
            .await
            .expect("test posts should be cleaned up");
        sqlx::query("DELETE FROM subscribers WHERE email LIKE $1")
            .bind(format!("{email_prefix}%"))
            .execute(pool)
            .await
            .expect("test subscribers should be cleaned up");
    }

    async fn insert_issue188_post(
        pool: &DbPool,
        category_id: &str,
        slug: &str,
        title: &str,
        body: &str,
        published: bool,
        featured: bool,
    ) {
        let status_sql = if published { "'PUBLISHED'::\"PostStatus\"" } else { "'DRAFT'::\"PostStatus\"" };
        let published_at_sql = if published { "NOW()" } else { "NULL" };
        let query = format!(
            r#"
            INSERT INTO posts (
                id, title, slug, excerpt, body, cover_image_key, square_cover_image_key,
                is_featured, views, author_name, author_intro, author_avatar_key,
                company_name, company_intro, company_logo_key, company_website_url,
                status, published_at, category_id, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, $4, $5, 'post-images/2026/07/cover.png',
                'post-images/2026/07/square.png', $6, 7, 'Test Author',
                'Author intro for route tests.', 'post-images/2026/07/avatar.png',
                'Example Company', 'Company intro for route tests.',
                'post-images/2026/07/company.png', 'https://example.test',
                {status_sql}, {published_at_sql}, $7, NOW(), NOW()
            )
            "#,
        );

        sqlx::query(&query)
            .bind(format!("issue188-post-{}", uuid::Uuid::new_v4()))
            .bind(title)
            .bind(slug)
            .bind(format!("Excerpt for {title}"))
            .bind(body)
            .bind(featured)
            .bind(category_id)
            .execute(pool)
            .await
            .expect("issue #188 test post should be inserted");
    }

    #[tokio::test]
    async fn homepage_renders_published_posts_and_hides_unpublished_posts() {
        let Some(state) = optional_db_state("homepage route test").await else {
            return;
        };
        let slug_prefix = format!("issue188-home-{}-", uuid::Uuid::new_v4());
        let email_prefix = format!("issue188-home-{}", uuid::Uuid::new_v4());
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
        let category_id = first_category_id(&state.pool)
            .await
            .expect("test category should exist");
        let published_slug = format!("{slug_prefix}published");
        let draft_slug = format!("{slug_prefix}draft");

        insert_issue188_post(
            &state.pool,
            &category_id,
            &published_slug,
            "Issue 188 Published Homepage Post",
            "Published homepage body.",
            true,
            true,
        )
        .await;
        insert_issue188_post(
            &state.pool,
            &category_id,
            &draft_slug,
            "Issue 188 Draft Homepage Post",
            "Draft homepage body.",
            false,
            false,
        )
        .await;

        let response = build_router(state.clone())
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/")
                    .body(Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(response.status(), StatusCode::OK);
        let body = response_text(response).await;

        assert!(body.contains("Issue 188 Published Homepage Post"));
        assert!(body.contains(&format!("/blog/{published_slug}")));
        assert!(!body.contains("Issue 188 Draft Homepage Post"));
        assert!(!body.contains(&draft_slug));
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
    }

    #[tokio::test]
    async fn article_page_renders_seo_metadata_and_sanitized_markdown() {
        let Some(state) = optional_db_state("article metadata route test").await else {
            return;
        };
        let slug_prefix = format!("issue188-article-{}-", uuid::Uuid::new_v4());
        let email_prefix = format!("issue188-article-{}", uuid::Uuid::new_v4());
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
        let category_id = first_category_id(&state.pool)
            .await
            .expect("test category should exist");
        let slug = format!("{slug_prefix}published");
        let unsafe_markdown = "# Safe Heading\n\n<script>alert('x')</script><p onclick=\"bad()\">Clean copy</p>";

        insert_issue188_post(
            &state.pool,
            &category_id,
            &slug,
            "Issue 188 SEO Article",
            unsafe_markdown,
            true,
            false,
        )
        .await;

        let response = build_router(state.clone())
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(format!("/blog/{slug}"))
                    .body(Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(response.status(), StatusCode::OK);
        let body = response_text(response).await;

        assert!(body.contains("<title>Issue 188 SEO Article</title>"));
        assert!(body.contains("<meta name=\"description\" content=\"Excerpt for Issue 188 SEO Article\">"));
        assert!(body.contains(&format!("<link rel=\"canonical\" href=\"https://blog.example.com/blog/{slug}\">")));
        assert!(body.contains("<meta property=\"og:type\" content=\"article\">"));
        assert!(body.contains("<meta property=\"article:published_time\""));
        assert!(body.contains("\"@type\":\"Article\""));
        assert!(body.contains("\"@type\":\"BreadcrumbList\""));
        assert!(body.contains("article-prose"));
        assert!(body.contains("<h1>Safe Heading</h1>"));
        assert!(body.contains("<p>Clean copy</p>"));
        assert!(!body.contains("<script"));
        assert!(!body.contains("onclick"));
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
    }

    #[tokio::test]
    async fn sitemap_lists_only_published_posts() {
        let Some(state) = optional_db_state("sitemap route test").await else {
            return;
        };
        let slug_prefix = format!("issue188-sitemap-{}-", uuid::Uuid::new_v4());
        let email_prefix = format!("issue188-sitemap-{}", uuid::Uuid::new_v4());
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
        let category_id = first_category_id(&state.pool)
            .await
            .expect("test category should exist");
        let published_slug = format!("{slug_prefix}published");
        let draft_slug = format!("{slug_prefix}draft");

        insert_issue188_post(&state.pool, &category_id, &published_slug, "Issue 188 Sitemap Published", "Body", true, false).await;
        insert_issue188_post(&state.pool, &category_id, &draft_slug, "Issue 188 Sitemap Draft", "Body", false, false).await;

        let response = build_router(state.clone())
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/sitemap.xml")
                    .body(Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(response.status(), StatusCode::OK);
        let body = response_text(response).await;

        assert!(body.contains("https://blog.example.com/</loc>"));
        assert!(body.contains(&format!("https://blog.example.com/blog/{published_slug}")));
        assert!(!body.contains(&draft_slug));
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
    }

    #[tokio::test]
    async fn admin_html_auth_redirects_configured_login_works_and_default_credentials_fail() {
        let Some(state) = optional_db_state("admin auth route test").await else {
            return;
        };
        let app = build_router(state);

        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/admin")
                    .body(Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            response.headers().get(header::LOCATION).and_then(|value| value.to_str().ok()),
            Some("/admin/login?next=%2Fadmin")
        );

        let default_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/login")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .body(Body::from("username=admin&password=change-me&next=%2Fadmin"))
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(default_response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            default_response.headers().get(header::LOCATION).and_then(|value| value.to_str().ok()),
            Some("/admin/login?error=invalid")
        );
        assert!(default_response.headers().get(header::SET_COOKIE).is_none());

        let configured_response = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/admin/login")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .body(Body::from("username=configured_admin&password=configured_secret&next=%2Fadmin"))
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(configured_response.status(), StatusCode::SEE_OTHER);
        assert_eq!(
            configured_response.headers().get(header::LOCATION).and_then(|value| value.to_str().ok()),
            Some("/admin")
        );
        assert!(configured_response
            .headers()
            .get(header::SET_COOKIE)
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.contains(auth::ADMIN_SESSION_COOKIE)));
    }

    #[tokio::test]
    async fn newsletter_html_form_redirects_for_created_duplicate_and_invalid_email() {
        let Some(state) = optional_db_state("newsletter route test").await else {
            return;
        };
        let slug_prefix = format!("issue188-newsletter-{}-", uuid::Uuid::new_v4());
        let email_prefix = format!("issue188-newsletter-{}", uuid::Uuid::new_v4());
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
        let app = build_router(state.clone());
        let email = format!("{email_prefix}@example.com");

        let created = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/newsletter")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .body(Body::from(format!("email={email}")))
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(created.status(), StatusCode::SEE_OTHER);
        assert_eq!(created.headers().get(header::LOCATION).and_then(|value| value.to_str().ok()), Some("/?newsletter=subscribed"));

        let duplicate = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/newsletter")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .body(Body::from(format!("email={email}")))
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(duplicate.status(), StatusCode::SEE_OTHER);
        assert_eq!(duplicate.headers().get(header::LOCATION).and_then(|value| value.to_str().ok()), Some("/?newsletter=duplicate"));

        let invalid = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/newsletter")
                    .header(header::CONTENT_TYPE, "application/x-www-form-urlencoded")
                    .body(Body::from("email=not-an-email"))
                    .expect("request should build"),
            )
            .await
            .expect("router should respond");
        assert_eq!(invalid.status(), StatusCode::SEE_OTHER);
        assert_eq!(invalid.headers().get(header::LOCATION).and_then(|value| value.to_str().ok()), Some("/?newsletter=invalid"));
        cleanup_issue188_rows(&state.pool, &slug_prefix, &email_prefix).await;
    }

}
