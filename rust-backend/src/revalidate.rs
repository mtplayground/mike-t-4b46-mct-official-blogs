use thiserror::Error;

use crate::config::RevalidationConfig;

#[derive(Debug, Error)]
#[error("public revalidation is disabled because Axum renders pages directly")]
pub struct RevalidationError;

pub async fn trigger_public_revalidation<I, S>(
    _config: &RevalidationConfig,
    slugs: I,
) -> Result<(), RevalidationError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let slugs = normalize_slugs(slugs);
    tracing::debug!(
        ?slugs,
        "skipping Next.js revalidation because Axum renders public pages directly"
    );
    Ok(())
}

fn normalize_slugs<I, S>(slugs: I) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut normalized = Vec::new();

    for slug in slugs {
        let slug = slug.as_ref().trim().trim_matches('/');
        if slug.is_empty()
            || !slug.chars().all(|character| {
                character.is_ascii_lowercase() || character.is_ascii_digit() || character == '-'
            })
        {
            continue;
        }

        if !normalized.iter().any(|existing| existing == slug) {
            normalized.push(slug.to_owned());
        }
    }

    normalized
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_slugs_deduplicates_and_rejects_invalid_values() {
        assert_eq!(
            normalize_slugs([
                "welcome-post",
                "/welcome-post/",
                "",
                "../secret",
                "Second",
                "another-post",
            ]),
            vec!["welcome-post".to_owned(), "another-post".to_owned()]
        );
    }

    #[tokio::test]
    async fn trigger_skips_external_revalidation_when_axum_serves_pages_directly() {
        let config = RevalidationConfig {
            url: "https://example.com/api/revalidate".to_owned(),
            secret: "shared-secret".to_owned(),
        };

        trigger_public_revalidation(&config, ["first-post", "second-post"])
            .await
            .expect("direct Axum rendering should not require external revalidation");
    }
}
