"use client";

import { useEffect } from "react";

import { StatusPanel } from "@/components/feedback/status-panel";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("Admin route failed:", error);
  }, [error]);

  return (
    <StatusPanel
      actions={
        <button className="editorial-button" onClick={reset} type="button">
          Try again
        </button>
      }
      description="The admin view could not be loaded. Check the server logs and retry the request."
      eyebrow="Admin error"
      title="The admin area hit a problem."
    />
  );
}
