import {
  BlogListing,
  categoryLabelByEnum,
  getCategoryStaticParams,
  parseCategoryUrlSlug,
} from "../../_components/blog-listing";
import { buildPageMetadata } from "@/lib/metadata";

export const revalidate = 300;

type CategoryBlogPageProps = {
  params: Promise<{
    category: string;
  }>;
};

export function generateStaticParams() {
  return getCategoryStaticParams();
}

export async function generateMetadata({ params }: CategoryBlogPageProps) {
  const { category } = await params;
  const activeCategory = parseCategoryUrlSlug(category);
  const categoryLabel = activeCategory ? categoryLabelByEnum[activeCategory] : "Category";

  return buildPageMetadata({
    title: `${categoryLabel} Posts`,
    description: `Read ${categoryLabel.toLowerCase()} from the myClawTeam official blog.`,
    path: `/blog/category/${category}`,
  });
}

export default async function CategoryBlogPage({ params }: CategoryBlogPageProps) {
  const { category } = await params;
  const activeCategory = parseCategoryUrlSlug(category);

  if (!activeCategory) {
    return <BlogListing currentPage={Number.MAX_SAFE_INTEGER} />;
  }

  return <BlogListing activeCategory={activeCategory} />;
}
