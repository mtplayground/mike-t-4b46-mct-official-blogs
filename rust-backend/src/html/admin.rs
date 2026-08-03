use askama::Template;
use chrono::{Datelike, NaiveDateTime, Timelike};

use super::{
    layout::{render_layout, LayoutContext, NavLink},
    seo::SeoMetadata,
};
use crate::{models::PostStatus, posts, subscribers};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Notice {
    pub(crate) message: String,
}

impl Notice {
    pub(crate) fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DashboardPostRow {
    id: String,
    title: String,
    slug: String,
    status_label: String,
    category_name: String,
    updated_at_label: String,
    views: i32,
    is_published: bool,
}

impl From<&posts::admin::AdminPost> for DashboardPostRow {
    fn from(post: &posts::admin::AdminPost) -> Self {
        Self {
            id: post.id.clone(),
            title: post.title.clone(),
            slug: post.slug.clone(),
            status_label: status_label(post.status).to_owned(),
            category_name: post.category_name.clone(),
            updated_at_label: format_datetime(post.updated_at),
            views: post.views,
            is_published: post.status == PostStatus::Published,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CategoryOption {
    id: String,
    name: String,
    is_selected: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SubscriberRow {
    email: String,
    created_at_label: String,
}

impl From<&subscribers::AdminSubscriber> for SubscriberRow {
    fn from(subscriber: &subscribers::AdminSubscriber) -> Self {
        Self {
            email: subscriber.email.clone(),
            created_at_label: format_datetime(subscriber.created_at),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct PostFormContext {
    pub(crate) seo: SeoMetadata,
    pub(crate) notice: Option<Notice>,
    pub(crate) title: String,
    pub(crate) action: String,
    pub(crate) submit_label: String,
    pub(crate) is_edit: bool,
    pub(crate) post_id: String,
    pub(crate) post_title: String,
    pub(crate) slug: String,
    pub(crate) excerpt: String,
    pub(crate) body: String,
    pub(crate) author_name: String,
    pub(crate) author_intro: String,
    pub(crate) company_name: String,
    pub(crate) company_intro: String,
    pub(crate) company_website_url: String,
    pub(crate) is_featured: bool,
    pub(crate) is_published: bool,
    pub(crate) has_cover_image: bool,
    pub(crate) has_square_cover_image: bool,
    pub(crate) has_author_avatar: bool,
    pub(crate) has_company_logo: bool,
    categories: Vec<CategoryOption>,
}

impl PostFormContext {
    pub(crate) fn new(
        seo: SeoMetadata,
        categories: Vec<posts::admin::AdminCategory>,
        notice: Option<Notice>,
    ) -> Self {
        Self {
            seo,
            notice,
            title: "New post".to_owned(),
            action: "/admin/posts".to_owned(),
            submit_label: "Create post".to_owned(),
            is_edit: false,
            post_id: String::new(),
            post_title: String::new(),
            slug: String::new(),
            excerpt: String::new(),
            body: String::new(),
            author_name: String::new(),
            author_intro: String::new(),
            company_name: posts::DEFAULT_COMPANY_NAME.to_owned(),
            company_intro: String::new(),
            company_website_url: posts::DEFAULT_COMPANY_WEBSITE_URL.to_owned(),
            is_featured: false,
            is_published: false,
            has_cover_image: false,
            has_square_cover_image: false,
            has_author_avatar: false,
            has_company_logo: false,
            categories: category_options(categories, None),
        }
    }

    pub(crate) fn edit(
        seo: SeoMetadata,
        post: &posts::admin::AdminPost,
        categories: Vec<posts::admin::AdminCategory>,
        notice: Option<Notice>,
    ) -> Self {
        Self {
            seo,
            notice,
            title: format!("Edit {}", post.title),
            action: format!("/admin/posts/{}/update", post.id),
            submit_label: "Save post".to_owned(),
            is_edit: true,
            post_id: post.id.clone(),
            post_title: post.title.clone(),
            slug: post.slug.clone(),
            excerpt: post.excerpt.clone(),
            body: post.body.clone(),
            author_name: post.author_name.clone(),
            author_intro: post.author_intro.clone(),
            company_name: post.company_name.clone(),
            company_intro: post.company_intro.clone(),
            company_website_url: post.company_website_url.clone(),
            is_featured: post.is_featured,
            is_published: post.status == PostStatus::Published,
            has_cover_image: post.cover_image_key.is_some(),
            has_square_cover_image: post.square_cover_image_key.is_some(),
            has_author_avatar: post.author_avatar_key.is_some(),
            has_company_logo: post.company_logo_key.is_some(),
            categories: category_options(categories, Some(&post.category_id)),
        }
    }
}

#[derive(Template)]
#[template(path = "admin/login.html")]
struct LoginTemplate {
    has_error: bool,
    next: String,
}

#[derive(Template)]
#[template(path = "admin/dashboard.html")]
struct DashboardTemplate {
    has_notice: bool,
    notice: String,
    has_posts: bool,
    posts: Vec<DashboardPostRow>,
}

#[derive(Template)]
#[template(path = "admin/post_form.html")]
struct PostFormTemplate {
    has_notice: bool,
    notice: String,
    title: String,
    action: String,
    submit_label: String,
    is_edit: bool,
    post_id: String,
    post_title: String,
    slug: String,
    excerpt: String,
    body: String,
    author_name: String,
    author_intro: String,
    company_name: String,
    company_intro: String,
    company_website_url: String,
    is_featured: bool,
    is_published: bool,
    has_cover_image: bool,
    has_square_cover_image: bool,
    has_author_avatar: bool,
    has_company_logo: bool,
    categories: Vec<CategoryOption>,
}

#[derive(Template)]
#[template(path = "admin/subscribers.html")]
struct SubscribersTemplate {
    has_subscribers: bool,
    subscribers: Vec<SubscriberRow>,
}

pub(crate) fn render_login_page(
    seo: SeoMetadata,
    has_error: bool,
    next: impl Into<String>,
) -> Result<String, askama::Error> {
    let body = LoginTemplate {
        has_error,
        next: next.into(),
    }
    .render()?;
    render_layout(LayoutContext::public(seo), body)
}

pub(crate) fn render_dashboard_page(
    seo: SeoMetadata,
    notice: Option<Notice>,
    posts: &[posts::admin::AdminPost],
) -> Result<String, askama::Error> {
    let rows = posts.iter().map(DashboardPostRow::from).collect::<Vec<_>>();
    let notice_message = notice.map(|notice| notice.message).unwrap_or_default();
    let body = DashboardTemplate {
        has_notice: !notice_message.is_empty(),
        notice: notice_message,
        has_posts: !rows.is_empty(),
        posts: rows,
    }
    .render()?;
    render_layout(admin_layout(seo), body)
}

pub(crate) fn render_post_form_page(context: PostFormContext) -> Result<String, askama::Error> {
    let notice_message = context.notice.map(|notice| notice.message).unwrap_or_default();
    let body = PostFormTemplate {
        has_notice: !notice_message.is_empty(),
        notice: notice_message,
        title: context.title,
        action: context.action,
        submit_label: context.submit_label,
        is_edit: context.is_edit,
        post_id: context.post_id,
        post_title: context.post_title,
        slug: context.slug,
        excerpt: context.excerpt,
        body: context.body,
        author_name: context.author_name,
        author_intro: context.author_intro,
        company_name: context.company_name,
        company_intro: context.company_intro,
        company_website_url: context.company_website_url,
        is_featured: context.is_featured,
        is_published: context.is_published,
        has_cover_image: context.has_cover_image,
        has_square_cover_image: context.has_square_cover_image,
        has_author_avatar: context.has_author_avatar,
        has_company_logo: context.has_company_logo,
        categories: context.categories,
    }
    .render()?;
    render_layout(admin_layout(context.seo), body)
}

pub(crate) fn render_subscribers_page(
    seo: SeoMetadata,
    subscribers: &[subscribers::AdminSubscriber],
) -> Result<String, askama::Error> {
    let rows = subscribers.iter().map(SubscriberRow::from).collect::<Vec<_>>();
    let body = SubscribersTemplate {
        has_subscribers: !rows.is_empty(),
        subscribers: rows,
    }
    .render()?;
    render_layout(admin_layout(seo), body)
}

fn admin_layout(seo: SeoMetadata) -> LayoutContext {
    LayoutContext {
        seo,
        nav_links: admin_nav_links(),
    }
}

fn admin_nav_links() -> Vec<NavLink> {
    vec![
        NavLink {
            href: "/admin".to_owned(),
            label: "Posts".to_owned(),
            opens_new_tab: false,
        },
        NavLink {
            href: "/admin/posts/new".to_owned(),
            label: "New post".to_owned(),
            opens_new_tab: false,
        },
        NavLink {
            href: "/admin/subscribers".to_owned(),
            label: "Subscribers".to_owned(),
            opens_new_tab: false,
        },
        NavLink {
            href: "/".to_owned(),
            label: "View blog".to_owned(),
            opens_new_tab: false,
        },
    ]
}

fn category_options(
    categories: Vec<posts::admin::AdminCategory>,
    selected: Option<&str>,
) -> Vec<CategoryOption> {
    categories
        .into_iter()
        .map(|category| CategoryOption {
            is_selected: selected == Some(category.id.as_str()),
            id: category.id,
            name: category.name,
        })
        .collect()
}

fn status_label(status: PostStatus) -> &'static str {
    match status {
        PostStatus::Published => "Published",
        PostStatus::Draft => "Draft",
    }
}

fn format_datetime(value: NaiveDateTime) -> String {
    format!(
        "{:04}-{:02}-{:02} {:02}:{:02} UTC",
        value.year(),
        value.month(),
        value.day(),
        value.hour(),
        value.minute()
    )
}
