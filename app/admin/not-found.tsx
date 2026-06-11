import Link from "next/link";

import { StatusPanel } from "@/components/feedback/status-panel";

export default function AdminNotFound() {
  return (
    <StatusPanel
      actions={
        <Link className="editorial-button" href="/admin">
          Back to dashboard
        </Link>
      }
      description="The requested admin page or post editor target does not exist."
      eyebrow="Admin"
      title="Admin page not found."
    />
  );
}
