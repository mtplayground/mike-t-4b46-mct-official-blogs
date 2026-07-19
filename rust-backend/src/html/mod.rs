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
            heading: String::new(),
            intro: String::new(),
            newsletter_notice: Some(public::NewsletterNotice::success("You are on the list.")),
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
        assert!(html.contains(r#"src="https://ideavibes.ai/logo.png""#));
        assert!(html.contains(r#"alt="Ideavibes""#));
        assert!(html.contains("From idea to product."));
        assert!(!html.contains(r#"<p class="eyebrow">Official Blog</p>"#));
        assert!(!html.contains(r#"<h1 class="text-heading-lg">Official Blog</h1>"#));
        assert!(!html.contains(r#"<p class="max-w-2xl text-lead text-editorial-muted">Latest product and engineering updates.</p>"#));
        assert!(html.contains("You are on the list."));
        assert!(html.contains("From Vibe Coding to Vibe Shipping"));
        assert!(html.contains(r#"href="/blog/from-vibe-coding-to-vibe-shipping""#));
    }


    #[test]
    fn public_post_page_renders_author_and_company_cards() {
        let page = public::PostPageContext {
            seo: SeoMetadata::with_canonical_url(
                "Article title",
                "Article excerpt.",
                "https://example.test/blog/article-title",
            ),
            title: "Article title".to_owned(),
            excerpt: "Article excerpt.".to_owned(),
            category_name: "Engineering".to_owned(),
            published_at_label: "July 17, 2026".to_owned(),
            author_name: "Alex Writer".to_owned(),
            author_intro: "Writes about shipping reliable software.".to_owned(),
            author_avatar_url: Some("/assets/author.png".to_owned()),
            body_html: "<p>Rendered body</p>".to_owned(),
            cover_image_url: Some("/assets/cover.png".to_owned()),
            company_name: "Acme Labs".to_owned(),
            company_intro: "Builds tools for teams.".to_owned(),
            company_logo_url: "/assets/company.png".to_owned(),
            company_website_url: "https://example.test/company".to_owned(),
            views: 42,
        };

        let html = public::render_post_page(page).expect("post page should render");

        assert!(html.contains("Author"));
        assert!(html.contains("Alex Writer"));
        assert!(html.contains("Company"));
        assert!(html.contains("Acme Labs"));
        assert!(html.contains("42 views"));
        assert!(html.contains("<p>Rendered body</p>"));
    }

    #[test]
    fn markdown_helpers_escape_and_sanitize_html() {
        let escaped = markdown::escape_text("<script>alert('x')</script>");
        let sanitized = markdown::sanitize_html_fragment("<p>Safe</p><script>bad()</script>");

        assert_eq!(escaped, "&lt;script&gt;alert('x')&lt;/script&gt;");
        assert_eq!(sanitized.as_str(), "<p>Safe</p>");
    }
}
