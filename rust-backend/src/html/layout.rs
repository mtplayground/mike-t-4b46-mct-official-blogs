use askama::Template;

use super::seo::SeoMetadata;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NavLink {
    pub(crate) href: String,
    pub(crate) label: String,
    pub(crate) opens_new_tab: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct LayoutContext {
    pub(crate) seo: SeoMetadata,
    pub(crate) nav_links: Vec<NavLink>,
}

impl LayoutContext {
    pub(crate) fn public(seo: SeoMetadata) -> Self {
        Self {
            seo,
            nav_links: public_nav_links(),
        }
    }
}

#[derive(Template)]
#[template(path = "layout.html")]
struct LayoutTemplate {
    title: String,
    description: String,
    canonical_url: String,
    has_canonical_url: bool,
    og_type: String,
    site_name: String,
    social_image_url: String,
    has_social_image_url: bool,
    twitter_card: String,
    article_published_time: String,
    has_article_published_time: bool,
    article_modified_time: String,
    has_article_modified_time: bool,
    json_ld: Vec<String>,
    body_html: String,
    nav_links: Vec<NavLink>,
}

pub(crate) fn render_layout(
    context: LayoutContext,
    body_html: impl Into<String>,
) -> Result<String, askama::Error> {
    let canonical_url = context.seo.canonical_url.unwrap_or_default();
    let social_image_url = context.seo.social_image_url.unwrap_or_default();
    let article_published_time = context.seo.article_published_time.unwrap_or_default();
    let article_modified_time = context.seo.article_modified_time.unwrap_or_default();
    let template = LayoutTemplate {
        title: context.seo.title,
        description: context.seo.description,
        has_canonical_url: !canonical_url.is_empty(),
        canonical_url,
        og_type: context.seo.og_type,
        site_name: context.seo.site_name,
        has_social_image_url: !social_image_url.is_empty(),
        social_image_url,
        twitter_card: context.seo.twitter_card,
        has_article_published_time: !article_published_time.is_empty(),
        article_published_time,
        has_article_modified_time: !article_modified_time.is_empty(),
        article_modified_time,
        json_ld: context.seo.json_ld,
        body_html: body_html.into(),
        nav_links: context.nav_links,
    };

    template.render()
}

fn public_nav_links() -> Vec<NavLink> {
    vec![
        NavLink {
            href: "https://ideavibes.ai".to_owned(),
            label: "Home".to_owned(),
            opens_new_tab: true,
        },
        NavLink {
            href: "/admin/login".to_owned(),
            label: "Admin".to_owned(),
            opens_new_tab: false,
        },
    ]
}
