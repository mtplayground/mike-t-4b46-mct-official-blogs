use askama::Template;

use super::seo::SeoMetadata;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NavLink {
    pub(crate) href: String,
    pub(crate) label: String,
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
    body_html: String,
    nav_links: Vec<NavLink>,
}

pub(crate) fn render_layout(
    context: LayoutContext,
    body_html: impl Into<String>,
) -> Result<String, askama::Error> {
    let canonical_url = context.seo.canonical_url.unwrap_or_default();
    let template = LayoutTemplate {
        title: context.seo.title,
        description: context.seo.description,
        has_canonical_url: !canonical_url.is_empty(),
        canonical_url,
        body_html: body_html.into(),
        nav_links: context.nav_links,
    };

    template.render()
}

fn public_nav_links() -> Vec<NavLink> {
    vec![
        NavLink {
            href: "/".to_owned(),
            label: "Blog".to_owned(),
        },
        NavLink {
            href: "/admin/login".to_owned(),
            label: "Admin".to_owned(),
        },
    ]
}
