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

const GET_VIEWS_SQL: &str = r#"
        SELECT views
        FROM posts
        WHERE slug = $1
          AND status = 'PUBLISHED'::"PostStatus"
          AND published_at IS NOT NULL
        LIMIT 1
        "#;

const INCREMENT_VIEWS_SQL: &str = r#"
        UPDATE posts
        SET views = views + 1
        WHERE slug = $1
          AND status = 'PUBLISHED'::"PostStatus"
          AND published_at IS NOT NULL
        RETURNING views
        "#;

pub async fn get_views(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<ViewsResponse>, AppError> {
    let row = sqlx::query_as::<_, (i32,)>(GET_VIEWS_SQL)
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
    let row = sqlx::query_as::<_, (i32,)>(INCREMENT_VIEWS_SQL)
        .bind(slug)
        .fetch_optional(&state.pool)
        .await?;
    let (views,) = row.ok_or(AppError::NotFound("Post not found."))?;

    Ok(Json(ViewsResponse { views }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn view_queries_only_target_published_posts() {
        for query in [GET_VIEWS_SQL, INCREMENT_VIEWS_SQL] {
            assert!(query.contains("status = 'PUBLISHED'"));
            assert!(query.contains("published_at IS NOT NULL"));
            assert!(query.contains("slug = $1"));
        }
    }

    #[test]
    fn increment_views_query_is_atomic() {
        assert!(INCREMENT_VIEWS_SQL.contains("UPDATE posts"));
        assert!(INCREMENT_VIEWS_SQL.contains("SET views = views + 1"));
        assert!(INCREMENT_VIEWS_SQL.contains("RETURNING views"));
    }
}
