"use client";

import { useEffect } from "react";

import { BlogLink, HomeLink, StatusPanel } from "@/components/feedback/status-panel";

type PublicErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function PublicError({ error, reset }: PublicErrorProps) {
  useEffect(() => {
    console.error("Public route failed:", error);
  }, [error]);

  return (
    <StatusPanel
      actions={
        <>
          <button className="editorial-button" onClick={reset} type="button">
            Try again
          </button>
          <BlogLink />
          <HomeLink />
        </>
      }
      description="The page could not be rendered. Try again, or continue from the blog index."
      eyebrow="Page error"
      title="This page hit a problem."
    />
  );
}
