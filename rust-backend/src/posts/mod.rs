pub mod admin;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::NaiveDateTime;
use serde::Serialize;
use sqlx::FromRow;

use crate::{
    error::AppError,
    models::{CategorySlug, PostStatus},
    AppState,
};

const DEFAULT_COMPANY_LOGO_URL: &str = "https://myclawteam.ai/logo.png";

#[derive(Debug, Clone, FromRow)]
struct PostRow {
    id: String,
    title: String,
    slug: String,
    excerpt: String,
    body: String,
    cover_image_key: Option<String>,
    square_cover_image_key: Option<String>,
    is_featured: bool,
    views: i32,
    author_name: String,
    author_intro: String,
    author_avatar_key: Option<String>,
    company_name: String,
    company_intro: String,
    company_logo_key: Option<String>,
    company_website_url: String,
    status: PostStatus,
    published_at: Option<NaiveDateTime>,
    category_id: String,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    category_slug: CategorySlug,
    category_name: String,
    category_description: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategorySummary {
    pub id: String,
    pub slug: CategorySlug,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicPost {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub excerpt: String,
    pub body: String,
    pub cover_image_key: Option<String>,
    pub cover_image_url: Option<String>,
    pub square_cover_image_key: Option<String>,
    pub square_cover_image_url: Option<String>,
    pub is_featured: bool,
    pub views: i32,
    pub author_name: String,
    pub author_intro: String,
    pub author_avatar_key: Option<String>,
    pub author_avatar_url: Option<String>,
    pub company_name: String,
    pub company_intro: String,
    pub company_logo_key: Option<String>,
    pub company_logo_url: String,
    pub company_website_url: String,
    pub status: PostStatus,
    pub published_at: Option<NaiveDateTime>,
    pub category_id: String,
    pub category: CategorySummary,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PostListResponse {
    pub hero_post: Option<PublicPost>,
    pub posts: Vec<PublicPost>,
}

const PUBLISHED_POST_SELECT: &str = r#"
    SELECT
        p.id,
        p.title,
        p.slug,
        p.excerpt,
        p.body,
        p.cover_image_key,
        p.square_cover_image_key,
        p.is_featured,
        p.views,
        p.author_name,
        p.author_intro,
        p.author_avatar_key,
        p.company_name,
        p.company_intro,
        p.company_logo_key,
        p.company_website_url,
        p.status,
        p.published_at,
        p.category_id,
        p.created_at,
        p.updated_at,
        c.slug AS category_slug,
        c.name AS category_name,
        c.description AS category_description
    FROM posts p
    INNER JOIN categories c ON c.id = p.category_id
    WHERE p.status = 'PUBLISHED'::"PostStatus"
      AND p.published_at IS NOT NULL
"#;

pub async fn list_posts(State(state): State<AppState>) -> Result<Json<PostListResponse>, AppError> {
    let rows = sqlx::query_as::<_, PostRow>(&format!(
        "{} ORDER BY p.is_featured DESC, p.published_at DESC, p.created_at DESC",
        PUBLISHED_POST_SELECT
    ))
    .fetch_all(&state.pool)
    .await?;
    let posts = rows
        .into_iter()
        .map(|row| row.into_public_post(&state))
        .collect::<Result<Vec<_>, _>>()?;
    let hero_post = posts
        .iter()
        .find(|post| post.is_featured)
        .cloned()
        .or_else(|| posts.first().cloned());

    Ok(Json(PostListResponse { hero_post, posts }))
}

pub async fn get_post(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPost>, AppError> {
    let row = sqlx::query_as::<_, PostRow>(&format!(
        "{} AND p.slug = $1 ORDER BY p.published_at DESC LIMIT 1",
        PUBLISHED_POST_SELECT
    ))
    .bind(slug)
    .fetch_optional(&state.pool)
    .await?;
    let post = row.ok_or(AppError::NotFound("Post not found."))?;

    Ok(Json(post.into_public_post(&state)?))
}

impl PostRow {
    fn into_public_post(self, state: &AppState) -> Result<PublicPost, AppError> {
        let body = state.storage.sign_markdown_storage_references(&self.body);
        let cover_image_url = self
            .cover_image_key
            .as_deref()
            .map(|key| state.storage.proxied_image_url(key))
            .transpose()?;
        let square_cover_image_url = self
            .square_cover_image_key
            .as_deref()
            .map(|key| state.storage.proxied_image_url(key))
            .transpose()?;
        let author_avatar_url = self
            .author_avatar_key
            .as_deref()
            .map(|key| state.storage.proxied_image_url(key))
            .transpose()?;
        let company_logo_url = self
            .company_logo_key
            .as_deref()
            .map(|key| state.storage.proxied_image_url(key))
            .transpose()?
            .unwrap_or_else(|| DEFAULT_COMPANY_LOGO_URL.to_owned());

        Ok(PublicPost {
            id: self.id,
            title: self.title,
            slug: self.slug,
            excerpt: self.excerpt,
            body,
            cover_image_key: self.cover_image_key,
            cover_image_url,
            square_cover_image_key: self.square_cover_image_key,
            square_cover_image_url,
            is_featured: self.is_featured,
            views: self.views,
            author_name: self.author_name,
            author_intro: self.author_intro,
            author_avatar_key: self.author_avatar_key,
            author_avatar_url,
            company_name: self.company_name,
            company_intro: self.company_intro,
            company_logo_key: self.company_logo_key,
            company_logo_url,
            company_website_url: self.company_website_url,
            status: self.status,
            published_at: self.published_at,
            category_id: self.category_id.clone(),
            category: CategorySummary {
                id: self.category_id,
                slug: self.category_slug,
                name: self.category_name,
                description: self.category_description,
            },
            created_at: self.created_at,
            updated_at: self.updated_at,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn public_post_select_only_returns_published_visible_posts() {
        assert!(PUBLISHED_POST_SELECT.contains("status = 'PUBLISHED'"));
        assert!(PUBLISHED_POST_SELECT.contains("published_at IS NOT NULL"));
        assert!(PUBLISHED_POST_SELECT.contains("INNER JOIN categories"));
        assert!(PUBLISHED_POST_SELECT.contains("p.company_name"));
        assert!(PUBLISHED_POST_SELECT.contains("p.company_intro"));
        assert!(PUBLISHED_POST_SELECT.contains("p.company_logo_key"));
        assert!(PUBLISHED_POST_SELECT.contains("p.company_website_url"));
    }
}
