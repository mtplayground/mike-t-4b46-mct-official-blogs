import {
  BlogListing,
  getAllPostPageStaticParams,
  parsePageParam,
} from "../../_components/blog-listing";
import { buildPageMetadata } from "@/lib/metadata";

export const revalidate = 300;

type PaginatedBlogPageProps = {
  params: Promise<{
    page: string;
  }>;
};

export function generateStaticParams() {
  return getAllPostPageStaticParams();
}

export async function generateMetadata({ params }: PaginatedBlogPageProps) {
  const { page } = await params;
  const currentPage = parsePageParam(page);
  const pageLabel = currentPage ?? Number.MAX_SAFE_INTEGER;

  return buildPageMetadata({
    title: `Blog - Page ${pageLabel}`,
    description:
      "Browse published thoughts, product progress, and announcements from the myClawTeam official blog.",
    path: `/blog/page/${page}`,
  });
}

export default async function PaginatedBlogPage({ params }: PaginatedBlogPageProps) {
  const { page } = await params;
  const currentPage = parsePageParam(page);

  if (!currentPage) {
    return <BlogListing currentPage={Number.MAX_SAFE_INTEGER} />;
  }

  return <BlogListing currentPage={currentPage} />;
}
