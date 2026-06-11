import { StatusPanel } from "@/components/feedback/status-panel";

export default function PublicLoading() {
  return (
    <StatusPanel
      description="The latest myClawTeam official blog content is being prepared."
      eyebrow="Loading"
      title="Getting the page ready."
    />
  );
}
