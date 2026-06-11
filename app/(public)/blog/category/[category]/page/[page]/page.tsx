import {
  BlogListing,
  categoryLabelByEnum,
  getCategoryPageStaticParams,
  parseCategoryUrlSlug,
  parsePageParam,
} from "../../../../_components/blog-listing";
import { buildPageMetadata } from "@/lib/metadata";

export const revalidate = 300;

type PaginatedCategoryBlogPageProps = {
  params: Promise<{
    category: string;
    page: string;
  }>;
};

export function generateStaticParams() {
  return getCategoryPageStaticParams();
}

export async function generateMetadata({ params }: PaginatedCategoryBlogPageProps) {
  const { category, page } = await params;
  const activeCategory = parseCategoryUrlSlug(category);
  const currentPage = parsePageParam(page);
  const categoryLabel = activeCategory ? categoryLabelByEnum[activeCategory] : "Category";
  const pageLabel = currentPage ?? Number.MAX_SAFE_INTEGER;

  return buildPageMetadata({
    title: `${categoryLabel} Posts - Page ${pageLabel}`,
    description: `Browse page ${pageLabel} of ${categoryLabel.toLowerCase()} from the myClawTeam official blog.`,
    path: `/blog/category/${category}/page/${page}`,
  });
}

export default async function PaginatedCategoryBlogPage({
  params,
}: PaginatedCategoryBlogPageProps) {
  const { category, page } = await params;
  const activeCategory = parseCategoryUrlSlug(category);
  const currentPage = parsePageParam(page);

  if (!activeCategory || !currentPage) {
    return <BlogListing currentPage={Number.MAX_SAFE_INTEGER} />;
  }

  return <BlogListing activeCategory={activeCategory} currentPage={currentPage} />;
}
