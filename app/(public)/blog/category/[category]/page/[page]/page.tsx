import {
  BlogListing,
  getCategoryPageStaticParams,
  parseCategoryUrlSlug,
  parsePageParam,
} from "../../../../_components/blog-listing";

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
