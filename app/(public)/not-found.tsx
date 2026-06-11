import { BlogLink, HomeLink, StatusPanel } from "@/components/feedback/status-panel";

export default function PublicNotFound() {
  return (
    <StatusPanel
      actions={
        <>
          <BlogLink />
          <HomeLink />
        </>
      }
      description="The requested myClawTeam official blog page does not exist or is no longer published."
      eyebrow="Not found"
      title="We could not find that page."
    />
  );
}
