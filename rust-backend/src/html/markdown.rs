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

pub(crate) fn sanitize_html_fragment(fragment: &str) -> SanitizedHtml {
    SanitizedHtml(ammonia::clean(fragment))
}

pub(crate) fn markdown_to_untrusted_html(markdown: &str) -> String {
    let parser = pulldown_cmark::Parser::new_ext(markdown, pulldown_cmark::Options::empty());
    let mut html = String::new();
    pulldown_cmark::html::push_html(&mut html, parser);
    html
}
