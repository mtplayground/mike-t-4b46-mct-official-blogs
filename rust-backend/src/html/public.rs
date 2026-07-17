use askama::Template;

use super::{
    layout::{render_layout, LayoutContext},
    seo::SeoMetadata,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PostCardContext {
    pub(crate) title: String,
    pub(crate) slug: String,
    pub(crate) excerpt: String,
    pub(crate) category_name: String,
    pub(crate) published_at_label: String,
    pub(crate) cover_image_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct HomePageContext {
    pub(crate) seo: SeoMetadata,
    pub(crate) heading: String,
    pub(crate) intro: String,
    pub(crate) hero_post: Option<PostCardContext>,
    pub(crate) posts: Vec<PostCardContext>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PostPageContext {
    pub(crate) seo: SeoMetadata,
    pub(crate) title: String,
    pub(crate) excerpt: String,
    pub(crate) category_name: String,
    pub(crate) published_at_label: String,
    pub(crate) author_name: String,
    pub(crate) author_intro: String,
    pub(crate) author_avatar_url: Option<String>,
    pub(crate) body_html: String,
    pub(crate) cover_image_url: Option<String>,
    pub(crate) company_name: String,
    pub(crate) company_intro: String,
    pub(crate) company_logo_url: String,
    pub(crate) company_website_url: String,
    pub(crate) views: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct NotFoundPageContext {
    pub(crate) seo: SeoMetadata,
    pub(crate) heading: String,
    pub(crate) message: String,
}

#[derive(Template)]
#[template(path = "public/home.html")]
struct HomeTemplate {
    heading: String,
    intro: String,
    has_hero_post: bool,
    hero_posts: Vec<PostCardContext>,
    has_posts: bool,
    posts: Vec<PostCardContext>,
}

#[derive(Template)]
#[template(path = "public/post.html")]
struct PostTemplate {
    title: String,
    excerpt: String,
    category_name: String,
    published_at_label: String,
    author_name: String,
    author_intro: String,
    has_author_avatar: bool,
    author_avatar_url: String,
    body_html: String,
    has_cover_image: bool,
    cover_image_url: String,
    company_name: String,
    company_intro: String,
    company_logo_url: String,
    company_website_url: String,
    views: i32,
}

#[derive(Template)]
#[template(path = "public/not_found.html")]
struct NotFoundTemplate {
    heading: String,
    message: String,
}

pub(crate) fn render_home_page(context: HomePageContext) -> Result<String, askama::Error> {
    let hero_posts = context.hero_post.clone().into_iter().collect::<Vec<_>>();
    let body = HomeTemplate {
        heading: context.heading,
        intro: context.intro,
        has_hero_post: context.hero_post.is_some(),
        hero_posts,
        has_posts: !context.posts.is_empty(),
        posts: context.posts,
    }
    .render()?;

    render_layout(LayoutContext::public(context.seo), body)
}

pub(crate) fn render_post_page(context: PostPageContext) -> Result<String, askama::Error> {
    let cover_image_url = context.cover_image_url.unwrap_or_default();
    let author_avatar_url = context.author_avatar_url.unwrap_or_default();
    let body = PostTemplate {
        title: context.title,
        excerpt: context.excerpt,
        category_name: context.category_name,
        published_at_label: context.published_at_label,
        author_name: context.author_name,
        author_intro: context.author_intro,
        has_author_avatar: !author_avatar_url.is_empty(),
        author_avatar_url,
        body_html: context.body_html,
        has_cover_image: !cover_image_url.is_empty(),
        cover_image_url,
        company_name: context.company_name,
        company_intro: context.company_intro,
        company_logo_url: context.company_logo_url,
        company_website_url: context.company_website_url,
        views: context.views,
    }
    .render()?;

    render_layout(LayoutContext::public(context.seo), body)
}

pub(crate) fn render_not_found_page(
    context: NotFoundPageContext,
) -> Result<String, askama::Error> {
    let body = NotFoundTemplate {
        heading: context.heading,
        message: context.message,
    }
    .render()?;

    render_layout(LayoutContext::public(context.seo), body)
}
