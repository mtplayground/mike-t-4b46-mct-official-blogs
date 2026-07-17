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
    extract::{DefaultBodyLimit, Path, State},
    response::{Html, IntoResponse, Redirect, Response},
    routing::{get, post},
    Json, Router,
};
use chrono::Datelike;
use config::{AdminCredentials, AppConfig, RevalidationConfig};
use db::DbPool;
use error::AppError;
use serde::Serialize;
use storage::StorageClient;
use tower_http::{services::ServeDir, trace::TraceLayer};
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

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
        .nest_service("/assets", ServeDir::new("public/assets"))
        .route("/health", get(health))
        .route("/api/posts", get(posts::list_posts))
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

async fn public_home(State(state): State<AppState>) -> Result<Html<String>, AppError> {
    let response = posts::fetch_public_post_list(&state).await?;
    let context = html::public::HomePageContext {
        seo: html::seo::SeoMetadata::with_canonical_url(
            "myClawTeam Blog",
            "Practical notes on shipping software with AI-assisted teams.",
            public_url(&state.self_url, "/"),
        ),
        heading: "Official Blog".to_owned(),
        intro: "Practical notes on shipping software with AI-assisted teams.".to_owned(),
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
            seo: html::seo::SeoMetadata::with_canonical_url(
                "Post not found",
                "The requested article could not be found.",
                public_url(&state.self_url, &format!("/blog/{slug}")),
            ),
            heading: "Article not found".to_owned(),
            message: "The article may have moved, been unpublished, or never existed.".to_owned(),
        };
        let html = html::public::render_not_found_page(context)?;

        return Ok((axum::http::StatusCode::NOT_FOUND, Html(html)).into_response());
    };

    let markdown_html = html::markdown::markdown_to_untrusted_html(&post.body);
    let body_html = html::markdown::sanitize_html_fragment(&markdown_html).into_inner();
    let title = post.title.clone();
    let context = html::public::PostPageContext {
        seo: html::seo::SeoMetadata::with_canonical_url(
            title.clone(),
            post.excerpt.clone(),
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
        views: post.views,
    };

    Ok(Html(html::public::render_post_page(context)?).into_response())
}

fn post_card_context_from_post(post: &posts::PublicPost) -> html::public::PostCardContext {
    html::public::PostCardContext {
        title: post.title.clone(),
        slug: post.slug.clone(),
        excerpt: post.excerpt.clone(),
        category_name: post.category.name.clone(),
        published_at_label: post.published_at.map(format_date).unwrap_or_default(),
        cover_image_url: post
            .square_cover_image_url
            .clone()
            .or_else(|| post.cover_image_url.clone()),
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
        body::Body,
        extract::Multipart,
        http::{header, Request, StatusCode},
        routing::post,
        Router,
    };
    use chrono::NaiveDateTime;
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
}
