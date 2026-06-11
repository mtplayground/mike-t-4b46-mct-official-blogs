import {
  BlogListing,
  getAllPostPageStaticParams,
  parsePageParam,
} from "../../_components/blog-listing";

export const revalidate = 300;

type PaginatedBlogPageProps = {
  params: Promise<{
    page: string;
  }>;
};

export function generateStaticParams() {
  return getAllPostPageStaticParams();
}

export default async function PaginatedBlogPage({ params }: PaginatedBlogPageProps) {
  const { page } = await params;
  const currentPage = parsePageParam(page);

  if (!currentPage) {
    return <BlogListing currentPage={Number.MAX_SAFE_INTEGER} />;
  }

  return <BlogListing currentPage={currentPage} />;
}
