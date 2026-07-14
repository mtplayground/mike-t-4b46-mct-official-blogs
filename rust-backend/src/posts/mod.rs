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
    storage::StorageClient,
    AppState,
};

const DEFAULT_COMPANY_NAME: &str = "myClawTeam";
const DEFAULT_COMPANY_INTRO: &str = "";
const DEFAULT_COMPANY_LOGO_URL: &str = "https://myclawteam.ai/logo.png";
const DEFAULT_COMPANY_WEBSITE_URL: &str = "https://myclawteam.ai";

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
    company_name: Option<String>,
    company_intro: Option<String>,
    company_logo_key: Option<String>,
    company_website_url: Option<String>,
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
    Ok(Json(post_list_response_from_rows(rows, &state.storage)?))
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

    Ok(Json(post.into_public_post(&state.storage)?))
}

fn post_list_response_from_rows(
    rows: Vec<PostRow>,
    storage: &StorageClient,
) -> Result<PostListResponse, AppError> {
    let posts = rows
        .into_iter()
        .map(|row| row.into_public_post(storage))
        .collect::<Result<Vec<_>, _>>()?;
    let hero_post = posts
        .iter()
        .find(|post| post.is_featured)
        .cloned()
        .or_else(|| posts.first().cloned());

    Ok(PostListResponse { hero_post, posts })
}

impl PostRow {
    fn into_public_post(self, storage: &StorageClient) -> Result<PublicPost, AppError> {
        let body = storage.sign_markdown_storage_references(&self.body);
        let cover_image_url = self
            .cover_image_key
            .as_deref()
            .map(|key| storage.proxied_image_url(key))
            .transpose()?;
        let square_cover_image_url = self
            .square_cover_image_key
            .as_deref()
            .map(|key| storage.proxied_image_url(key))
            .transpose()?;
        let author_avatar_url = self
            .author_avatar_key
            .as_deref()
            .map(|key| storage.proxied_image_url(key))
            .transpose()?;
        let company_logo_url = self
            .company_logo_key
            .as_deref()
            .map(|key| storage.proxied_image_url(key))
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
            company_name: self
                .company_name
                .unwrap_or_else(|| DEFAULT_COMPANY_NAME.to_owned()),
            company_intro: self
                .company_intro
                .unwrap_or_else(|| DEFAULT_COMPANY_INTRO.to_owned()),
            company_logo_key: self.company_logo_key,
            company_logo_url,
            company_website_url: self
                .company_website_url
                .unwrap_or_else(|| DEFAULT_COMPANY_WEBSITE_URL.to_owned()),
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
    use crate::storage::StorageClient;

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

    #[test]
    fn post_list_response_includes_legacy_published_posts_without_company_fields() {
        let published_at =
            NaiveDateTime::parse_from_str("2026-07-01 12:00:00", "%Y-%m-%d %H:%M:%S")
                .expect("valid test datetime");
        let storage = StorageClient::for_tests("https://blog.example.com");
        let legacy_row = PostRow {
            id: "post-legacy".to_owned(),
            title: "Legacy published post".to_owned(),
            slug: "legacy-published-post".to_owned(),
            excerpt: "A post created before company fields were populated.".to_owned(),
            body: "Legacy body".to_owned(),
            cover_image_key: None,
            square_cover_image_key: None,
            is_featured: false,
            views: 42,
            author_name: "Mike".to_owned(),
            author_intro: "Author intro".to_owned(),
            author_avatar_key: None,
            company_name: None,
            company_intro: None,
            company_logo_key: None,
            company_website_url: None,
            status: PostStatus::Published,
            published_at: Some(published_at),
            category_id: "cat-thoughts".to_owned(),
            created_at: published_at,
            updated_at: published_at,
            category_slug: CategorySlug::Thoughts,
            category_name: "Thoughts".to_owned(),
            category_description: Some("Long-form notes".to_owned()),
        };

        let response = post_list_response_from_rows(vec![legacy_row], &storage)
            .expect("legacy row should serialize as a public post");

        assert_eq!(response.posts.len(), 1);
        assert_eq!(
            response
                .hero_post
                .as_ref()
                .expect("first post becomes fallback hero")
                .slug,
            "legacy-published-post"
        );
        let post = &response.posts[0];
        assert_eq!(post.company_name, DEFAULT_COMPANY_NAME);
        assert_eq!(post.company_intro, DEFAULT_COMPANY_INTRO);
        assert_eq!(post.company_logo_url, DEFAULT_COMPANY_LOGO_URL);
        assert_eq!(post.company_website_url, DEFAULT_COMPANY_WEBSITE_URL);
    }

}
