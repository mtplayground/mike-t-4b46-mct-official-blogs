use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "PostStatus", rename_all = "SCREAMING_SNAKE_CASE")]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum PostStatus {
    Draft,
    Published,
}

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, sqlx::FromRow)]
pub struct Post {
    pub id: String,
    pub title: String,
    pub slug: String,
    pub excerpt: String,
    pub body: String,
    pub cover_image_key: Option<String>,
    pub square_cover_image_key: Option<String>,
    pub is_featured: bool,
    pub views: i32,
    pub author_name: String,
    pub author_intro: String,
    pub author_avatar_key: Option<String>,
    pub company_name: Option<String>,
    pub company_intro: Option<String>,
    pub company_logo_key: Option<String>,
    pub company_website_url: Option<String>,
    pub status: PostStatus,
    pub published_at: Option<NaiveDateTime>,
    pub category_id: String,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}
