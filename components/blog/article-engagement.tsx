"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ArticleEngagementProps = {
  slug: string;
  title: string;
  url: string;
};

type ViewsResponse = {
  views?: unknown;
};

const shareButtonClassName =
  "inline-flex items-center justify-center rounded-button border border-editorial-line bg-editorial-white px-4 py-2 text-sm font-bold text-editorial-ink transition hover:border-editorial-red hover:text-editorial-red";

function getViewedStorageKey(slug: string) {
  return `article-viewed:${slug}`;
}

function readStoredView(slug: string) {
  try {
    return window.sessionStorage.getItem(getViewedStorageKey(slug)) === "yes";
  } catch {
    return false;
  }
}

function storeViewed(slug: string) {
  try {
    window.sessionStorage.setItem(getViewedStorageKey(slug), "yes");
  } catch {
    // Ignore storage failures; view counting still works without the dedupe hint.
  }
}

async function fetchViews(slug: string, method: "GET" | "POST") {
  const response = await fetch(`/api/posts/${encodeURIComponent(slug)}/views`, {
    method,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Post views request failed with status ${response.status}`);
  }

  const data = (await response.json()) as ViewsResponse;

  if (typeof data.views !== "number") {
    throw new Error("Post views response did not include a numeric views value.");
  }

  return data.views;
}

export function ArticleEngagement({ slug, title, url }: ArticleEngagementProps) {
  const [views, setViews] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const hasTrackedView = useRef(false);

  const shareLinks = useMemo(() => {
    const encodedTitle = encodeURIComponent(title);
    const encodedUrl = encodeURIComponent(url);

    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    };
  }, [title, url]);

  useEffect(() => {
    let isMounted = true;

    const nativeShareTimer = window.setTimeout(() => {
      setCanNativeShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    }, 0);

    if (hasTrackedView.current) {
      return () => {
        isMounted = false;
        window.clearTimeout(nativeShareTimer);
      };
    }

    hasTrackedView.current = true;

    async function updateViews() {
      try {
        const alreadyViewed = readStoredView(slug);
        const nextViews = await fetchViews(slug, alreadyViewed ? "GET" : "POST");

        if (!alreadyViewed) {
          storeViewed(slug);
        }

        if (isMounted) {
          setViews(nextViews);
        }
      } catch (error) {
        console.error("Failed to update article views:", error);
      }
    }

    updateViews();

    return () => {
      isMounted = false;
      window.clearTimeout(nativeShareTimer);
    };
  }, [slug]);

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      return;
    }

    try {
      await navigator.share({
        title,
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Failed to share article:", error);
    }
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy article link:", error);
    }
  }

  return (
    <aside className="rounded-card border border-editorial-line bg-editorial-cream p-5 shadow-editorial">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-editorial-red">
          {views === null ? "Loading views…" : `${views.toLocaleString()} views`}
        </p>

        <div className="flex flex-wrap gap-2" aria-label="Share this article">
          {canNativeShare ? (
            <button className={shareButtonClassName} onClick={handleNativeShare} type="button">
              Share
            </button>
          ) : null}
          <a className={shareButtonClassName} href={shareLinks.x} rel="noreferrer" target="_blank">
            X
          </a>
          <a
            className={shareButtonClassName}
            href={shareLinks.linkedin}
            rel="noreferrer"
            target="_blank"
          >
            LinkedIn
          </a>
          <a
            className={shareButtonClassName}
            href={shareLinks.facebook}
            rel="noreferrer"
            target="_blank"
          >
            Facebook
          </a>
          <button className={shareButtonClassName} onClick={handleCopyLink} type="button">
            {copied ? "Copied" : "Copy link"}
          </button>
        </div>
      </div>
    </aside>
  );
}
