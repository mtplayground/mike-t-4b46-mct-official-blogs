import { BlogListing } from "./_components/blog-listing";

export const revalidate = 300;

export default function BlogIndexPage() {
  return <BlogListing />;
}
