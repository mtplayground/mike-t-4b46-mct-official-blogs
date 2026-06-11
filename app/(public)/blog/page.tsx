import { BlogListing } from "./_components/blog-listing";
import { buildPageMetadata } from "@/lib/metadata";

export const revalidate = 300;

export const metadata = buildPageMetadata({
  title: "Blog",
  description:
    "Published thoughts, product progress, and announcements from myClawTeam, organized for steady reading.",
  path: "/blog",
});

export default function BlogIndexPage() {
  return <BlogListing />;
}
