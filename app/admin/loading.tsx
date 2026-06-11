import { StatusPanel } from "@/components/feedback/status-panel";

export default function AdminLoading() {
  return (
    <StatusPanel
      description="Admin data is being loaded from PostgreSQL."
      eyebrow="Admin"
      title="Loading the dashboard."
    />
  );
}
