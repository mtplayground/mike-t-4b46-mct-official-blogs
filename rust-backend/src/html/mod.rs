#![allow(dead_code)]

pub(crate) mod admin;
pub(crate) mod layout;
pub(crate) mod markdown;
pub(crate) mod public;
pub(crate) mod seo;

#[cfg(test)]
mod tests {
    use super::{markdown, public, seo::SeoMetadata};

    #[test]
    fn public_home_page_renders_inside_shared_layout() {
        let page = public::HomePageContext {
            seo: SeoMetadata::with_canonical_url(
                "Official Blog",
                "Latest product and engineering updates.",
                "https://example.test/",
            ),
            heading: "Official Blog".to_owned(),
            intro: "Latest product and engineering updates.".to_owned(),
            hero_post: None,
            posts: vec![public::PostCardContext {
                title: "From Vibe Coding to Vibe Shipping".to_owned(),
                slug: "from-vibe-coding-to-vibe-shipping".to_owned(),
                excerpt: "A field note on moving from prototype to production.".to_owned(),
                category_name: "Engineering".to_owned(),
                published_at_label: "July 17, 2026".to_owned(),
                cover_image_url: Some("/assets/example.png".to_owned()),
            }],
        };

        let html = public::render_home_page(page).expect("home page should render");

        assert!(html.contains(r#"<link rel="stylesheet" href="/assets/app.css">"#));
        assert!(html.contains("From Vibe Coding to Vibe Shipping"));
        assert!(html.contains(r#"href="/blog/from-vibe-coding-to-vibe-shipping""#));
    }

    #[test]
    fn markdown_helpers_escape_and_sanitize_html() {
        let escaped = markdown::escape_text("<script>alert('x')</script>");
        let sanitized = markdown::sanitize_html_fragment("<p>Safe</p><script>bad()</script>");

        assert_eq!(escaped, "&lt;script&gt;alert('x')&lt;/script&gt;");
        assert_eq!(sanitized.as_str(), "<p>Safe</p>");
    }
}
