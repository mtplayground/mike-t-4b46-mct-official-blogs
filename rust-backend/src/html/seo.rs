#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SeoMetadata {
    pub(crate) title: String,
    pub(crate) description: String,
    pub(crate) canonical_url: Option<String>,
}

impl SeoMetadata {
    pub(crate) fn new(title: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            title: title.into(),
            description: description.into(),
            canonical_url: None,
        }
    }

    pub(crate) fn with_canonical_url(
        title: impl Into<String>,
        description: impl Into<String>,
        canonical_url: impl Into<String>,
    ) -> Self {
        Self {
            title: title.into(),
            description: description.into(),
            canonical_url: Some(canonical_url.into()),
        }
    }
}
