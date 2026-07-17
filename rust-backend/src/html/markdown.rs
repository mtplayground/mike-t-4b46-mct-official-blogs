use ammonia::Builder;
use pulldown_cmark::{html, Options, Parser};

use crate::storage::StorageClient;

const ARTICLE_PROSE_CLASSES: &str =
    "article-prose grid gap-6 text-lead leading-8 text-editorial-ink";

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SanitizedHtml(String);

impl SanitizedHtml {
    pub(crate) fn as_str(&self) -> &str {
        &self.0
    }

    pub(crate) fn into_inner(self) -> String {
        self.0
    }
}

pub(crate) fn escape_text(value: &str) -> String {
    html_escape::encode_text(value).into_owned()
}

pub(crate) fn render_markdown_to_html(markdown: &str, storage: &StorageClient) -> SanitizedHtml {
    let signed_markdown = storage.sign_markdown_storage_references(markdown);
    let untrusted_html = markdown_to_untrusted_html(&signed_markdown);
    let sanitized_html = sanitize_markdown_html(&untrusted_html);

    SanitizedHtml(format!(
        r#"<div class="{ARTICLE_PROSE_CLASSES}">{sanitized_html}</div>"#
    ))
}

pub(crate) fn sanitize_html_fragment(fragment: &str) -> SanitizedHtml {
    SanitizedHtml(sanitize_markdown_html(fragment))
}

pub(crate) fn markdown_to_untrusted_html(markdown: &str) -> String {
    let parser = Parser::new_ext(markdown, markdown_options());
    let mut html = String::new();
    html::push_html(&mut html, parser);
    html
}

fn markdown_options() -> Options {
    Options::ENABLE_TABLES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_SMART_PUNCTUATION
}

fn sanitize_markdown_html(fragment: &str) -> String {
    let mut builder = Builder::default();
    builder
        .add_tags([
            "table", "thead", "tbody", "tr", "th", "td", "del", "input",
        ])
        .add_tag_attributes("input", ["checked", "disabled", "type"]);

    builder.clean(fragment).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn storage() -> StorageClient {
        StorageClient::for_tests("https://blog.example.com")
    }

    #[test]
    fn render_markdown_to_html_supports_gfm_and_wraps_editorial_prose() {
        let markdown = "| A | B |\n| - | - |\n| **strong** | ~~old~~ |";
        let html = render_markdown_to_html(markdown, &storage()).into_inner();

        assert!(html.starts_with(r#"<div class="article-prose grid gap-6"#));
        assert!(html.contains("<table>"));
        assert!(html.contains("<strong>strong</strong>"));
        assert!(html.contains("<del>old</del>"));
    }

    #[test]
    fn render_markdown_to_html_rewrites_storage_images_before_sanitizing() {
        let markdown = "![Cover](storage:post-images/2026/07/cover.png)";
        let html = render_markdown_to_html(markdown, &storage()).into_inner();

        assert!(html.contains("https://blog.example.com/api/image/post%2Dimages/2026/07/cover%2Epng"));
        assert!(!html.contains("storage:post-images"));
    }

    #[test]
    fn render_markdown_to_html_removes_unsafe_html() {
        let markdown = "# Safe\n\n<script>alert('x')</script><p onclick=\"bad()\">Copy</p>";
        let html = render_markdown_to_html(markdown, &storage()).into_inner();

        assert!(html.contains("<h1>Safe</h1>"));
        assert!(html.contains("<p>Copy</p>"));
        assert!(!html.contains("<script"));
        assert!(!html.contains("onclick"));
    }
}
