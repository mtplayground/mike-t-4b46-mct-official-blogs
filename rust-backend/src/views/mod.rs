use axum::{
    extract::{Path, State},
    Json,
};
use serde::Serialize;

use crate::{error::AppError, AppState};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewsResponse {
    pub views: i32,
}

pub async fn get_views(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ViewsResponse>, AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        r#"
        SELECT views
        FROM posts
        WHERE slug = $1
          AND status = 'PUBLISHED'::"PostStatus"
          AND published_at IS NOT NULL
        LIMIT 1
        "#,
    )
    .bind(slug)
    .fetch_optional(&state.pool)
    .await?;
    let (views,) = row.ok_or(AppError::NotFound("Post not found."))?;

    Ok(Json(ViewsResponse { views }))
}

pub async fn increment_views(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ViewsResponse>, AppError> {
    let row = sqlx::query_as::<_, (i32,)>(
        r#"
        UPDATE posts
        SET views = views + 1
        WHERE slug = $1
          AND status = 'PUBLISHED'::"PostStatus"
          AND published_at IS NOT NULL
        RETURNING views
        "#,
    )
    .bind(slug)
    .fetch_optional(&state.pool)
    .await?;
    let (views,) = row.ok_or(AppError::NotFound("Post not found."))?;

    Ok(Json(ViewsResponse { views }))
}
