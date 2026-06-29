use axum::{
    extract::{Multipart, Path, State},
    http::HeaderMap,
    Json,
};
use chrono::{Datelike, NaiveDateTime, Utc};
use serde::Serialize;
use sqlx::FromRow;
use uuid::Uuid;

use crate::{
    auth,
    error::AppError,
    models::{CategorySlug, PostStatus},
    AppState,
};

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminCategory {
    id: String,
    slug: CategorySlug,
    name: String,
    description: Option<String>,
}

#[derive(Debug, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct AdminPost {
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
    status: PostStatus,
    published_at: Option<NaiveDateTime>,
    category_id: String,
    created_at: NaiveDateTime,
    updated_at: NaiveDateTime,
    category_name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MutationResponse {
    notice: String,
    post: Option<AdminPost>,
}

#[derive(Default)]
struct PostForm {
    post_id: Option<String>,
    title: String,
    slug: String,
    excerpt: String,
    body: String,
    category_id: String,
    author_name: String,
    author_intro: String,
    is_featured: bool,
    status: PostStatus,
    remove_cover: bool,
    remove_square_cover: bool,
    remove_author_avatar: bool,
    cover_image: Option<ImageUpload>,
    square_cover_image: Option<ImageUpload>,
    author_avatar: Option<ImageUpload>,
    inline_image: Option<ImageUpload>,
}

struct ImageUpload {
    body: Vec<u8>,
    content_type: String,
    original_filename: Option<String>,
}

impl Default for PostStatus {
    fn default() -> Self {
        Self::Draft
    }
}

pub async fn list_categories(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminCategory>>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let categories = sqlx::query_as::<_, AdminCategory>(
        "SELECT id, slug, name, description FROM categories ORDER BY name ASC",
    )
    .fetch_all(&state.pool)
    .await?;
    Ok(Json(categories))
}

pub async fn list_admin_posts(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<AdminPost>>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let posts = fetch_admin_posts(&state).await?;
    Ok(Json(posts))
}

pub async fn get_admin_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<AdminPost>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let post = fetch_admin_post(&state, &id)
        .await?
        .ok_or(AppError::NotFound("Post not found."))?;
    Ok(Json(post))
}

pub async fn create_admin_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    multipart: Multipart,
) -> Result<Json<MutationResponse>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let mut form = parse_multipart(multipart).await?;
    validate_form(&mut form, false, None)?;

    let mut uploaded_keys = Vec::new();
    let result = create_post_inner(&state, form, &mut uploaded_keys).await;
    if result.is_err() {
        cleanup_uploaded(&state, &uploaded_keys).await;
    }
    result
}

pub async fn update_admin_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    multipart: Multipart,
) -> Result<Json<MutationResponse>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let existing = fetch_admin_post(&state, &id)
        .await?
        .ok_or(AppError::NotFound("Post not found."))?;
    let mut form = parse_multipart(multipart).await?;
    form.post_id = Some(id.clone());
    validate_form(&mut form, true, Some(&existing))?;

    let mut uploaded_keys = Vec::new();
    let result = update_post_inner(&state, &id, &existing, form, &mut uploaded_keys).await;
    if result.is_err() {
        cleanup_uploaded(&state, &uploaded_keys).await;
    }
    result
}

pub async fn publish_admin_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<MutationResponse>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let existing = fetch_admin_post(&state, &id)
        .await?
        .ok_or(AppError::NotFound("Post not found."))?;
    validate_publishable(&existing)?;

    sqlx::query(
        r#"UPDATE posts SET status = 'PUBLISHED'::"PostStatus", published_at = COALESCE(published_at, NOW()), updated_at = NOW() WHERE id = $1"#,
    )
    .bind(&id)
    .execute(&state.pool)
    .await?;
    let post = fetch_admin_post(&state, &id).await?;
    Ok(Json(MutationResponse {
        notice: format!("\"{}\" is now published.", existing.title),
        post,
    }))
}

pub async fn unpublish_admin_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<MutationResponse>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let existing = fetch_admin_post(&state, &id)
        .await?
        .ok_or(AppError::NotFound("Post not found."))?;

    sqlx::query(
        r#"UPDATE posts SET status = 'DRAFT'::"PostStatus", published_at = NULL, updated_at = NOW() WHERE id = $1"#,
    )
    .bind(&id)
    .execute(&state.pool)
    .await?;
    let post = fetch_admin_post(&state, &id).await?;
    Ok(Json(MutationResponse {
        notice: format!("\"{}\" is now a draft.", existing.title),
        post,
    }))
}

pub async fn delete_admin_post(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<MutationResponse>, AppError> {
    auth::ensure_admin_headers(&state, &headers)?;
    let existing = fetch_admin_post(&state, &id)
        .await?
        .ok_or(AppError::NotFound("Post not found."))?;

    sqlx::query("DELETE FROM posts WHERE id = $1")
        .bind(&id)
        .execute(&state.pool)
        .await?;

    for key in [
        existing.cover_image_key.as_deref(),
        existing.square_cover_image_key.as_deref(),
        existing.author_avatar_key.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        if let Err(error) = state.storage.delete_object(key).await {
            tracing::error!(?error, key, "failed to delete removed post image");
        }
    }

    Ok(Json(MutationResponse {
        notice: format!("\"{}\" was deleted.", existing.title),
        post: None,
    }))
}

async fn create_post_inner(
    state: &AppState,
    mut form: PostForm,
    uploaded_keys: &mut Vec<String>,
) -> Result<Json<MutationResponse>, AppError> {
    let cover_image_key = upload_optional(state, form.cover_image.take(), uploaded_keys).await?;
    let square_cover_image_key =
        upload_optional(state, form.square_cover_image.take(), uploaded_keys).await?;
    let author_avatar_key =
        upload_optional(state, form.author_avatar.take(), uploaded_keys).await?;
    if let Some(inline_image) = form.inline_image.take() {
        let uploaded = upload_image(state, inline_image).await?;
        form.body = append_inline_image(&form.body, &uploaded.0, uploaded.1.as_deref());
        uploaded_keys.push(uploaded.0);
    }

    let post_id = Uuid::new_v4().to_string();
    let status = form.status;
    let published_at_sql = if status == PostStatus::Published {
        "NOW()"
    } else {
        "NULL"
    };
    let query = format!(
        r#"INSERT INTO posts (id, title, slug, excerpt, body, cover_image_key, square_cover_image_key, is_featured, author_name, author_intro, author_avatar_key, status, published_at, category_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::{}, {}, $13, NOW(), NOW())"#,
        "\"PostStatus\"", published_at_sql
    );

    let result = sqlx::query(&query)
        .bind(&post_id)
        .bind(&form.title)
        .bind(&form.slug)
        .bind(&form.excerpt)
        .bind(&form.body)
        .bind(&cover_image_key)
        .bind(&square_cover_image_key)
        .bind(form.is_featured)
        .bind(&form.author_name)
        .bind(&form.author_intro)
        .bind(&author_avatar_key)
        .bind(status_db_value(status))
        .bind(&form.category_id)
        .execute(&state.pool)
        .await;

    if let Err(error) = result {
        return Err(map_db_error(error));
    }

    let post = fetch_admin_post(state, &post_id).await?;
    Ok(Json(MutationResponse {
        notice: format!("\"{}\" was created.", form.title),
        post,
    }))
}

async fn update_post_inner(
    state: &AppState,
    id: &str,
    existing: &AdminPost,
    mut form: PostForm,
    uploaded_keys: &mut Vec<String>,
) -> Result<Json<MutationResponse>, AppError> {
    let old_cover_key = existing.cover_image_key.clone();
    let old_square_key = existing.square_cover_image_key.clone();
    let old_avatar_key = existing.author_avatar_key.clone();
    let mut cover_key = if form.remove_cover {
        None
    } else {
        old_cover_key.clone()
    };
    let mut square_key = if form.remove_cover || form.remove_square_cover {
        None
    } else {
        old_square_key.clone()
    };
    let mut avatar_key = if form.remove_author_avatar {
        None
    } else {
        old_avatar_key.clone()
    };

    if form.cover_image.is_some() {
        cover_key = upload_optional(state, form.cover_image.take(), uploaded_keys).await?;
    }
    if form.square_cover_image.is_some() {
        square_key = upload_optional(state, form.square_cover_image.take(), uploaded_keys).await?;
    }
    if form.author_avatar.is_some() {
        avatar_key = upload_optional(state, form.author_avatar.take(), uploaded_keys).await?;
    }
    if let Some(inline_image) = form.inline_image.take() {
        let uploaded = upload_image(state, inline_image).await?;
        form.body = append_inline_image(&form.body, &uploaded.0, uploaded.1.as_deref());
        uploaded_keys.push(uploaded.0);
    }

    let published_expr = match form.status {
        PostStatus::Published => "COALESCE(published_at, NOW())",
        PostStatus::Draft => "NULL",
    };
    let query = format!(
        r#"UPDATE posts SET title=$1, slug=$2, excerpt=$3, body=$4, cover_image_key=$5, square_cover_image_key=$6, is_featured=$7, author_name=$8, author_intro=$9, author_avatar_key=$10, status=$11::{}, published_at={}, category_id=$12, updated_at=NOW() WHERE id=$13"#,
        "\"PostStatus\"", published_expr
    );

    let result = sqlx::query(&query)
        .bind(&form.title)
        .bind(&form.slug)
        .bind(&form.excerpt)
        .bind(&form.body)
        .bind(&cover_key)
        .bind(&square_key)
        .bind(form.is_featured)
        .bind(&form.author_name)
        .bind(&form.author_intro)
        .bind(&avatar_key)
        .bind(status_db_value(form.status))
        .bind(&form.category_id)
        .bind(id)
        .execute(&state.pool)
        .await;

    if let Err(error) = result {
        return Err(map_db_error(error));
    }

    for key in [
        old_cover_key.as_deref(),
        old_square_key.as_deref(),
        old_avatar_key.as_deref(),
    ]
    .into_iter()
    .flatten()
    .filter(|key| {
        Some(*key) != cover_key.as_deref()
            && Some(*key) != square_key.as_deref()
            && Some(*key) != avatar_key.as_deref()
    }) {
        if let Err(error) = state.storage.delete_object(key).await {
            tracing::error!(?error, key, "failed to delete replaced post image");
        }
    }

    let post = fetch_admin_post(state, id).await?;
    Ok(Json(MutationResponse {
        notice: format!("\"{}\" was updated.", form.title),
        post,
    }))
}

async fn parse_multipart(mut multipart: Multipart) -> Result<PostForm, AppError> {
    let mut form = PostForm::default();
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|_| AppError::BadRequest("Invalid multipart form."))?
    {
        let name = field.name().unwrap_or_default().to_owned();
        match name.as_str() {
            "coverImage" | "squareCoverImage" | "authorAvatar" | "inlineImage" => {
                if let Some(upload) = parse_image_field(field).await? {
                    match name.as_str() {
                        "coverImage" => form.cover_image = Some(upload),
                        "squareCoverImage" => form.square_cover_image = Some(upload),
                        "authorAvatar" => form.author_avatar = Some(upload),
                        "inlineImage" => form.inline_image = Some(upload),
                        _ => {}
                    }
                }
            }
            _ => {
                let text = field
                    .text()
                    .await
                    .map_err(|_| AppError::BadRequest("Invalid multipart form."))?
                    .trim()
                    .to_owned();
                match name.as_str() {
                    "postId" => form.post_id = Some(text),
                    "title" => form.title = text,
                    "slug" => form.slug = slugify(&text),
                    "excerpt" => form.excerpt = text,
                    "body" => form.body = text,
                    "categoryId" => form.category_id = text,
                    "authorName" => form.author_name = text,
                    "authorIntro" => form.author_intro = text,
                    "status" => form.status = parse_status(&text),
                    "isFeatured" => form.is_featured = text == "yes",
                    "removeCover" => form.remove_cover = text == "yes",
                    "removeSquareCover" => form.remove_square_cover = text == "yes",
                    "removeAuthorAvatar" => form.remove_author_avatar = text == "yes",
                    _ => {}
                }
            }
        }
    }
    if form.slug.is_empty() {
        form.slug = slugify(&form.title);
    }
    Ok(form)
}

async fn parse_image_field(
    field: axum::extract::multipart::Field<'_>,
) -> Result<Option<ImageUpload>, AppError> {
    let content_type = field.content_type().unwrap_or_default().to_owned();
    let original_filename = field.file_name().map(ToOwned::to_owned);
    let body = field
        .bytes()
        .await
        .map_err(|_| AppError::BadRequest("Invalid multipart form."))?
        .to_vec();
    if body.is_empty() {
        return Ok(None);
    }
    if body.len() > MAX_IMAGE_BYTES {
        return Err(AppError::BadRequest(
            "Post image uploads cannot exceed 10 MB.",
        ));
    }
    if extension_for_content_type(&content_type).is_none() {
        return Err(AppError::BadRequest(
            "Post image uploads must be JPEG, PNG, WebP, or GIF.",
        ));
    }
    Ok(Some(ImageUpload {
        body,
        content_type,
        original_filename,
    }))
}

fn validate_form(
    form: &mut PostForm,
    is_update: bool,
    existing: Option<&AdminPost>,
) -> Result<(), AppError> {
    if form.title.is_empty() {
        return Err(AppError::BadRequest("Title is required."));
    }
    if form.slug.is_empty() {
        return Err(AppError::BadRequest("Slug is required."));
    }
    if form.excerpt.is_empty() || form.excerpt.len() > 320 {
        return Err(AppError::BadRequest(
            "Excerpt must be between 1 and 320 characters.",
        ));
    }
    if form.body.is_empty() {
        return Err(AppError::BadRequest("Body content is required."));
    }
    if form.category_id.is_empty() {
        return Err(AppError::BadRequest("Category is required."));
    }
    if form.author_intro.len() > 500 {
        return Err(AppError::BadRequest(
            "Author intro must be 500 characters or fewer.",
        ));
    }
    if form.cover_image.is_some() && form.square_cover_image.is_none() {
        return Err(AppError::BadRequest(if is_update {
            "Upload both 16:9 and 1:1 cover images before saving a new cover image."
        } else {
            "Upload both 16:9 and 1:1 cover images before saving."
        }));
    }
    if form.status == PostStatus::Published {
        let has_cover = form.cover_image.is_some()
            || existing.and_then(|p| p.cover_image_key.as_ref()).is_some() && !form.remove_cover;
        let has_square = form.square_cover_image.is_some()
            || existing
                .and_then(|p| p.square_cover_image_key.as_ref())
                .is_some()
                && !form.remove_cover
                && !form.remove_square_cover;
        let has_avatar = form.author_avatar.is_some()
            || existing
                .and_then(|p| p.author_avatar_key.as_ref())
                .is_some()
                && !form.remove_author_avatar;
        if !has_cover {
            return Err(AppError::BadRequest(
                "Cover image is required before publishing.",
            ));
        }
        if !has_square {
            return Err(AppError::BadRequest(
                "Square cover image is required before publishing.",
            ));
        }
        if form.author_name.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Author name is required before publishing.",
            ));
        }
        if form.author_intro.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Author intro is required before publishing.",
            ));
        }
        if !has_avatar {
            return Err(AppError::BadRequest(
                "Author avatar is required before publishing.",
            ));
        }
    }
    Ok(())
}

fn validate_publishable(post: &AdminPost) -> Result<(), AppError> {
    if post.cover_image_key.is_none() {
        return Err(AppError::BadRequest(
            "Cover image is required before publishing.",
        ));
    }
    if post.square_cover_image_key.is_none() {
        return Err(AppError::BadRequest(
            "Square cover image is required before publishing.",
        ));
    }
    if post.author_name.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Author name is required before publishing.",
        ));
    }
    if post.author_intro.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Author intro is required before publishing.",
        ));
    }
    if post.author_avatar_key.is_none() {
        return Err(AppError::BadRequest(
            "Author avatar is required before publishing.",
        ));
    }
    Ok(())
}

async fn upload_optional(
    state: &AppState,
    upload: Option<ImageUpload>,
    uploaded_keys: &mut Vec<String>,
) -> Result<Option<String>, AppError> {
    if let Some(upload) = upload {
        let (key, _) = upload_image(state, upload).await?;
        uploaded_keys.push(key.clone());
        Ok(Some(key))
    } else {
        Ok(None)
    }
}

async fn upload_image(
    state: &AppState,
    upload: ImageUpload,
) -> Result<(String, Option<String>), AppError> {
    let extension = extension_for_content_type(&upload.content_type).ok_or(
        AppError::BadRequest("Post image uploads must be JPEG, PNG, WebP, or GIF."),
    )?;
    let now = Utc::now();
    let key = format!(
        "post-images/{}/{:02}/{}.{}",
        now.year(),
        now.month(),
        Uuid::new_v4(),
        extension
    );
    state
        .storage
        .put_object(
            &key,
            upload.body,
            &upload.content_type,
            upload.original_filename.as_deref(),
        )
        .await?;
    Ok((key, upload.original_filename))
}

async fn cleanup_uploaded(state: &AppState, keys: &[String]) {
    for key in keys {
        if let Err(error) = state.storage.delete_object(key).await {
            tracing::error!(
                ?error,
                key,
                "failed to clean up uploaded image after admin mutation failure"
            );
        }
    }
}

fn append_inline_image(body: &str, image_key: &str, filename: Option<&str>) -> String {
    let alt = filename
        .unwrap_or("Inline image")
        .chars()
        .filter(|c| c.is_ascii_graphic() || *c == ' ')
        .collect::<String>()
        .replace(['[', ']', '(', ')', '.'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    format!(
        "{}\n\n![{}](storage:{})",
        body,
        if alt.is_empty() { "Inline image" } else { &alt },
        image_key
    )
}

fn slugify(value: &str) -> String {
    let mut output = String::new();
    let mut last_dash = false;
    for c in value.to_lowercase().chars() {
        if c.is_ascii_alphanumeric() {
            if output.len() < 120 {
                output.push(c);
            }
            last_dash = false;
        } else if !last_dash && !output.is_empty() && output.len() < 120 {
            output.push('-');
            last_dash = true;
        }
    }
    output.trim_matches('-').to_owned()
}

fn parse_status(value: &str) -> PostStatus {
    if value == "PUBLISHED" {
        PostStatus::Published
    } else {
        PostStatus::Draft
    }
}
fn status_db_value(status: PostStatus) -> &'static str {
    if status == PostStatus::Published {
        "PUBLISHED"
    } else {
        "DRAFT"
    }
}
fn extension_for_content_type(content_type: &str) -> Option<&'static str> {
    match content_type {
        "image/jpeg" => Some("jpg"),
        "image/png" => Some("png"),
        "image/webp" => Some("webp"),
        "image/gif" => Some("gif"),
        _ => None,
    }
}

fn map_db_error(error: sqlx::Error) -> AppError {
    if let sqlx::Error::Database(db) = &error {
        if db.code().as_deref() == Some("23505") && db.message().contains("slug") {
            return AppError::BadRequest("A post with this slug already exists.");
        }
    }
    AppError::Database(error)
}

async fn fetch_admin_posts(state: &AppState) -> Result<Vec<AdminPost>, AppError> {
    Ok(sqlx::query_as::<_, AdminPost>(ADMIN_POST_SELECT_LIST)
        .fetch_all(&state.pool)
        .await?)
}
async fn fetch_admin_post(state: &AppState, id: &str) -> Result<Option<AdminPost>, AppError> {
    Ok(sqlx::query_as::<_, AdminPost>(ADMIN_POST_SELECT_ONE)
        .bind(id)
        .fetch_optional(&state.pool)
        .await?)
}

const ADMIN_POST_SELECT_LIST: &str = r#"
    SELECT p.id, p.title, p.slug, p.excerpt, p.body, p.cover_image_key, p.square_cover_image_key,
           p.is_featured, p.views, p.author_name, p.author_intro, p.author_avatar_key, p.status,
           p.published_at, p.category_id, p.created_at, p.updated_at, c.name AS category_name
    FROM posts p INNER JOIN categories c ON c.id = p.category_id
    ORDER BY p.updated_at DESC, p.created_at DESC
"#;
const ADMIN_POST_SELECT_ONE: &str = r#"
    SELECT p.id, p.title, p.slug, p.excerpt, p.body, p.cover_image_key, p.square_cover_image_key,
           p.is_featured, p.views, p.author_name, p.author_intro, p.author_avatar_key, p.status,
           p.published_at, p.category_id, p.created_at, p.updated_at, c.name AS category_name
    FROM posts p INNER JOIN categories c ON c.id = p.category_id
    WHERE p.id = $1
"#;

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn slugify_matches_admin_rules() {
        assert_eq!(slugify("Hello, Rust CMS!"), "hello-rust-cms");
    }
    #[test]
    fn supported_image_types_map_to_expected_extensions() {
        assert_eq!(extension_for_content_type("image/webp"), Some("webp"));
        assert_eq!(extension_for_content_type("text/plain"), None);
    }
}
