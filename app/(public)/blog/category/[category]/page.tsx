import {
  BlogListing,
  getCategoryStaticParams,
  parseCategoryUrlSlug,
} from "../../_components/blog-listing";

export const revalidate = 300;

type CategoryBlogPageProps = {
  params: Promise<{
    category: string;
  }>;
};

export function generateStaticParams() {
  return getCategoryStaticParams();
}

export default async function CategoryBlogPage({ params }: CategoryBlogPageProps) {
  const { category } = await params;
  const activeCategory = parseCategoryUrlSlug(category);

  if (!activeCategory) {
    return <BlogListing currentPage={Number.MAX_SAFE_INTEGER} />;
  }

  return <BlogListing activeCategory={activeCategory} />;
}
