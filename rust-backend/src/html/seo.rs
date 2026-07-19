use chrono::NaiveDateTime;
use serde_json::{json, Map, Value};

use crate::posts::PublicPost;

pub(crate) const SITE_NAME: &str = "Ideavibes";
const DEFAULT_SOCIAL_IMAGE_PATH: &str = "/images/editorial-hero.png";
const DEFAULT_DESCRIPTION: &str = "From idea to product.";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SeoMetadata {
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) canonical_url: Option<String>,
    pub(crate) og_type: String,
    pub(crate) site_name: String,
    pub(crate) social_image_url: Option<String>,
    pub(crate) twitter_card: String,
    pub(crate) article_published_time: Option<String>,
    pub(crate) article_modified_time: Option<String>,
    pub(crate) json_ld: Vec<String>,
}

impl SeoMetadata {
    pub(crate) fn new(title: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            description: description.into(),
            canonical_url: None,
            og_type: "website".to_owned(),
            site_name: SITE_NAME.to_owned(),
            social_image_url: None,
            twitter_card: "summary_large_image".to_owned(),
            article_published_time: None,
            article_modified_time: None,
            json_ld: Vec::new(),
        }
    }

    pub(crate) fn with_canonical_url(
        title: impl Into<String>,
        description: impl Into<String>,
        canonical_url: impl Into<String>,
    ) -> Self {
        Self {
            canonical_url: Some(canonical_url.into()),
            social_image_url: None,
            ..Self::new(title, description)
        }
    }

    pub(crate) fn with_social_image(mut self, image_url: impl Into<String>) -> Self {
        self.social_image_url = Some(image_url.into());
        self
    }

    pub(crate) fn with_json_ld(mut self, graph: Value) -> Self {
        self.json_ld.push(serialize_json_ld(&graph));
        self
    }

    pub(crate) fn article(
        base_url: &str,
        post: &PublicPost,
        canonical_url: impl Into<String>,
    ) -> Self {
        let canonical_url = canonical_url.into();
        let image_url = post
            .cover_image_url
            .clone()
            .unwrap_or_else(|| absolute_url(base_url, DEFAULT_SOCIAL_IMAGE_PATH));
        let published_time = post.published_at.map(format_datetime_iso8601);
        let modified_time = format_datetime_iso8601(post.updated_at);
        let article_json = article_json_ld(base_url, post, &canonical_url);
        let breadcrumb_json = breadcrumb_json_ld(
            base_url,
            &[
                ("Home", absolute_url(base_url, "/")),
                ("Blog", absolute_url(base_url, "/blog")),
                (post.title.as_str(), canonical_url.clone()),
            ],
        );

        Self {
            og_type: "article".to_owned(),
            social_image_url: Some(image_url),
            article_published_time: published_time,
            article_modified_time: Some(modified_time),
            json_ld: vec![serialize_json_ld(&article_json), serialize_json_ld(&breadcrumb_json)],
            ..Self::with_canonical_url(post.title.clone(), post.excerpt.clone(), canonical_url)
        }
    }

    pub(crate) fn home(base_url: &str) -> Self {
        let canonical_url = absolute_url(base_url, "/");
        Self::with_canonical_url(
            SITE_NAME,
            DEFAULT_DESCRIPTION,
            canonical_url,
        )
        .with_social_image(absolute_url(base_url, DEFAULT_SOCIAL_IMAGE_PATH))
        .with_json_ld(blog_json_ld(base_url))
        .with_json_ld(breadcrumb_json_ld(
            base_url,
            &[("Home", absolute_url(base_url, "/"))],
        ))
    }

    pub(crate) fn not_found(base_url: &str, path: &str) -> Self {
        Self::with_canonical_url(
            "Post not found",
            "The requested article could not be found.",
            absolute_url(base_url, path),
        )
        .with_social_image(absolute_url(base_url, DEFAULT_SOCIAL_IMAGE_PATH))
    }
}

pub(crate) fn absolute_url(base_url: &str, path: &str) -> String {
    format!("{}{}", base_url.trim_end_matches('/'), path)
}

pub(crate) fn render_sitemap_xml(base_url: &str, posts: &[PublicPost]) -> String {
    let mut xml = String::from(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
"#,
    );
    let homepage_lastmod = posts.iter().map(|post| post.updated_at).max();
    push_sitemap_url(&mut xml, &absolute_url(base_url, "/"), homepage_lastmod, "weekly", "1.0");

    for post in posts {
        push_sitemap_url(
            &mut xml,
            &absolute_url(base_url, &format!("/blog/{}", post.slug)),
            Some(post.updated_at),
            "monthly",
            "0.8",
        );
    }

    xml.push_str("</urlset>\n");
    xml
}

pub(crate) fn render_robots_txt(base_url: &str) -> String {
    format!(
        "User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: {}\nHost: {}\n",
        absolute_url(base_url, "/sitemap.xml"),
        absolute_url(base_url, "/")
    )
}

fn push_sitemap_url(
    xml: &mut String,
    loc: &str,
    lastmod: Option<NaiveDateTime>,
    changefreq: &str,
    priority: &str,
) {
    xml.push_str("  <url>\n");
    xml.push_str("    <loc>");
    xml.push_str(&escape_xml_text(loc));
    xml.push_str("</loc>\n");
    if let Some(lastmod) = lastmod {
        xml.push_str("    <lastmod>");
        xml.push_str(&format_date(lastmod));
        xml.push_str("</lastmod>\n");
    }
    xml.push_str("    <changefreq>");
    xml.push_str(changefreq);
    xml.push_str("</changefreq>\n");
    xml.push_str("    <priority>");
    xml.push_str(priority);
    xml.push_str("</priority>\n");
    xml.push_str("  </url>\n");
}

fn article_json_ld(base_url: &str, post: &PublicPost, canonical_url: &str) -> Value {
    let mut article = Map::new();
    article.insert("@context".to_owned(), json!("https://schema.org"));
    article.insert("@type".to_owned(), json!("Article"));
    article.insert("headline".to_owned(), json!(&post.title));
    article.insert("description".to_owned(), json!(&post.excerpt));
    if let Some(published_at) = post.published_at {
        article.insert("datePublished".to_owned(), json!(format_datetime_iso8601(published_at)));
    }
    article.insert("dateModified".to_owned(), json!(format_datetime_iso8601(post.updated_at)));
    article.insert("articleSection".to_owned(), json!(&post.category.name));
    if let Some(image_url) = &post.cover_image_url {
        article.insert("image".to_owned(), json!([image_url]));
    }
    article.insert(
        "mainEntityOfPage".to_owned(),
        json!({ "@type": "WebPage", "@id": canonical_url }),
    );

    let mut author = Map::new();
    author.insert("@type".to_owned(), json!("Person"));
    author.insert("name".to_owned(), json!(&post.author_name));
    if let Some(avatar_url) = &post.author_avatar_url {
        author.insert("image".to_owned(), json!(avatar_url));
    }
    article.insert("author".to_owned(), Value::Object(author));

    article.insert(
        "publisher".to_owned(),
        json!({
            "@type": "Organization",
            "name": &post.company_name,
            "url": &post.company_website_url,
            "logo": { "@type": "ImageObject", "url": &post.company_logo_url }
        }),
    );
    article.insert(
        "isPartOf".to_owned(),
        json!({ "@type": "Blog", "name": SITE_NAME, "url": absolute_url(base_url, "/blog") }),
    );

    Value::Object(article)
}

fn blog_json_ld(base_url: &str) -> Value {
    json!({
        "@context": "https://schema.org",
        "@type": "Blog",
        "name": SITE_NAME,
        "description": DEFAULT_DESCRIPTION,
        "url": absolute_url(base_url, "/"),
        "publisher": { "@type": "Organization", "name": "Ideavibes", "url": absolute_url(base_url, "/") }
    })
}

fn breadcrumb_json_ld(base_url: &str, items: &[(&str, String)]) -> Value {
    let item_list = items
        .iter()
        .enumerate()
        .map(|(index, (name, url))| {
            json!({
                "@type": "ListItem",
                "position": index + 1,
                "name": name,
                "item": url
            })
        })
        .collect::<Vec<_>>();

    json!({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": item_list,
        "url": absolute_url(base_url, "/")
    })
}

fn serialize_json_ld(value: &Value) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "{}".to_owned())
}

fn format_datetime_iso8601(value: NaiveDateTime) -> String {
    value.format("%Y-%m-%dT%H:%M:%SZ").to_string()
}

fn format_date(value: NaiveDateTime) -> String {
    value.format("%Y-%m-%d").to_string()
}

fn escape_xml_text(value: &str) -> String {
    html_escape::encode_text(value).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{models::{CategorySlug, PostStatus}, posts::{CategorySummary, PublicPost}};

    fn published_post() -> PublicPost {
        let published_at = NaiveDateTime::parse_from_str("2026-07-17 13:45:00", "%Y-%m-%d %H:%M:%S")
            .expect("valid published date");
        let updated_at = NaiveDateTime::parse_from_str("2026-07-18 08:30:00", "%Y-%m-%d %H:%M:%S")
            .expect("valid updated date");

        PublicPost {
            id: "post-1".to_owned(),
            title: "From Vibe Coding to Vibe Shipping".to_owned(),
            slug: "from-vibe-coding-to-vibe-shipping".to_owned(),
            excerpt: "A field note on moving from prototype to production.".to_owned(),
            body: "Body".to_owned(),
            cover_image_key: None,
            cover_image_url: Some("https://example.test/cover.png".to_owned()),
            square_cover_image_key: None,
            square_cover_image_url: None,
            is_featured: true,
            views: 10,
            author_name: "Alex Writer".to_owned(),
            author_intro: "Writes about shipping reliable software.".to_owned(),
            author_avatar_key: None,
            author_avatar_url: Some("https://example.test/author.png".to_owned()),
            company_name: "Example Company".to_owned(),
            company_intro: "Builds tools for teams.".to_owned(),
            company_logo_key: None,
            company_logo_url: "https://example.test/logo.png".to_owned(),
            company_website_url: "https://example.test".to_owned(),
            status: PostStatus::Published,
            published_at: Some(published_at),
            category_id: "cat-engineering".to_owned(),
            category: CategorySummary {
                id: "cat-engineering".to_owned(),
                slug: CategorySlug::Thoughts,
                name: "Engineering".to_owned(),
                description: Some("Engineering notes".to_owned()),
            },
            created_at: published_at,
            updated_at,
        }
    }

    #[test]
    fn article_metadata_includes_open_graph_dates_and_json_ld() {
        let post = published_post();
        let metadata = SeoMetadata::article(
            "https://blog.example.com",
            &post,
            "https://blog.example.com/blog/from-vibe-coding-to-vibe-shipping",
        );

        assert_eq!(metadata.og_type, "article");
        assert_eq!(metadata.article_published_time.as_deref(), Some("2026-07-17T13:45:00Z"));
        assert_eq!(metadata.article_modified_time.as_deref(), Some("2026-07-18T08:30:00Z"));
        let json_ld = metadata.json_ld.join("\n");
        assert!(json_ld.contains(r#""@type":"Article""#));
        assert!(json_ld.contains(r#""@type":"BreadcrumbList""#));
        assert!(json_ld.contains(r#""mainEntityOfPage""#));
    }

    #[test]
    fn home_metadata_uses_ideavibes_branding() {
        let metadata = SeoMetadata::home("https://blog.example.com");
        let json_ld = metadata.json_ld.join("\n");

        assert_eq!(metadata.site_name, "Ideavibes");
        assert_eq!(metadata.title, "Ideavibes");
        assert_eq!(metadata.description, "From idea to product.");
        assert!(json_ld.contains(r#""name":"Ideavibes""#));
        assert!(json_ld.contains(r#""publisher":{"@type":"Organization","name":"Ideavibes""#));
        assert!(!json_ld.contains("myClawTeam"));
    }

    #[test]
    fn sitemap_xml_contains_home_and_published_posts_with_lastmod() {
        let post = published_post();
        let xml = render_sitemap_xml("https://blog.example.com/", &[post]);

        assert!(xml.contains("<loc>https://blog.example.com/</loc>"));
        assert!(xml.contains("<loc>https://blog.example.com/blog/from-vibe-coding-to-vibe-shipping</loc>"));
        assert!(xml.contains("<lastmod>2026-07-18</lastmod>"));
    }

    #[test]
    fn robots_txt_points_to_rust_sitemap_and_blocks_admin() {
        let robots = render_robots_txt("https://blog.example.com/");

        assert!(robots.contains("Allow: /"));
        assert!(robots.contains("Disallow: /admin/"));
        assert!(robots.contains("Sitemap: https://blog.example.com/sitemap.xml"));
    }
}
