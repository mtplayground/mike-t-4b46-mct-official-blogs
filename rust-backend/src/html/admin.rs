use super::layout::NavLink;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AdminPageChrome {
    pub(crate) title: String,
    pub(crate) active_path: String,
    pub(crate) nav_links: Vec<NavLink>,
}

impl AdminPageChrome {
    pub(crate) fn new(title: impl Into<String>, active_path: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            active_path: active_path.into(),
            nav_links: admin_nav_links(),
        }
    }
}

fn admin_nav_links() -> Vec<NavLink> {
    vec![
        NavLink {
            href: "/admin".to_owned(),
            label: "Posts".to_owned(),
        },
        NavLink {
            href: "/admin/posts/new".to_owned(),
            label: "New post".to_owned(),
        },
        NavLink {
            href: "/admin/subscribers".to_owned(),
            label: "Subscribers".to_owned(),
        },
    ]
}
