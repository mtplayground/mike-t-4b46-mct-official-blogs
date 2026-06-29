mod config;
mod db;
mod error;
mod models;
mod newsletter;
mod posts;
mod storage;
mod subscribers;
mod views;

use axum::{
    extract::State,
    routing::{get, post},
    Json, Router,
};
use config::AppConfig;
use db::DbPool;
use error::AppError;
use serde::Serialize;
use storage::StorageClient;
use tokio::net::TcpListener;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) pool: DbPool,
    pub(crate) storage: StorageClient,
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
    let app = build_router(AppState { pool, storage });
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
        .route("/health", get(health))
        .route("/api/posts", get(posts::list_posts))
        .route("/api/newsletter", post(newsletter::subscribe))
        .route("/api/posts/:slug", get(posts::get_post))
        .route(
            "/api/posts/:slug/views",
            get(views::get_views).post(views::increment_views),
        )
        .route("/api/image/*key", get(storage::image_redirect))
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}

async fn health(State(state): State<AppState>) -> Result<Json<HealthResponse<'static>>, AppError> {
    let _pool = state.pool.clone();

    Ok(Json(HealthResponse { status: "ok" }))
}
