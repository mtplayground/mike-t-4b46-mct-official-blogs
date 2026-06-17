"use client";

import { useEffect } from "react";

import { HomeLink, StatusPanel } from "@/components/feedback/status-panel";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error("Root route failed:", error);
  }, [error]);

  return (
    <StatusPanel
      actions={
        <>
          <button className="editorial-button" onClick={reset} type="button">
            Try again
          </button>
          <HomeLink />
        </>
      }
      description="myClawTeam Official Blogs could not render this request. Retry the page or return home."
      eyebrow="Application error"
      title="Something went wrong."
    />
  );
}
