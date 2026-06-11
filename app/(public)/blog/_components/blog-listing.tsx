import { CategorySlug } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { publishedPostWhere } from "@/lib/content/posts";
import { prisma } from "@/lib/db/prisma";

export const POSTS_PER_PAGE = 6;

export const categoryUrlSlugByEnum = {
  [CategorySlug.THOUGHTS]: "thoughts",
  [CategorySlug.PRODUCT_PROGRESS]: "product-progress",
  [CategorySlug.ANNOUNCEMENTS]: "announcements",
} as const satisfies Record<CategorySlug, string>;

export const categoryLabelByEnum = {
  [CategorySlug.THOUGHTS]: "Thoughts",
  [CategorySlug.PRODUCT_PROGRESS]: "Product Progress",
  [CategorySlug.ANNOUNCEMENTS]: "Announcements",
} as const satisfies Record<CategorySlug, string>;

const categoryOrder = [
  CategorySlug.THOUGHTS,
  CategorySlug.PRODUCT_PROGRESS,
  CategorySlug.ANNOUNCEMENTS,
] as const;

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

type BlogListingProps = {
  activeCategory?: CategorySlug;
  currentPage?: number;
};

function getBlogHref(category: CategorySlug | null, page = 1) {
  if (category && page > 1) {
    return `/blog/category/${categoryUrlSlugByEnum[category]}/page/${page}`;
  }

  if (category) {
    return `/blog/category/${categoryUrlSlugByEnum[category]}`;
  }

  if (page > 1) {
    return `/blog/page/${page}`;
  }

  return "/blog";
}

function getPageNumbers(currentPage: number, totalPages: number) {
  const firstPage = Math.max(1, currentPage - 1);
  const lastPage = Math.min(totalPages, currentPage + 1);

  return Array.from({ length: lastPage - firstPage + 1 }, (_, index) => firstPage + index);
}

export function parseCategoryUrlSlug(value: string): CategorySlug | null {
  const categorySlug = Object.entries(categoryUrlSlugByEnum).find(
    ([, urlSlug]) => urlSlug === value,
  )?.[0] as CategorySlug | undefined;

  return categorySlug ?? null;
}

export function parsePageParam(value: string) {
  const page = Number.parseInt(value, 10);

  return Number.isFinite(page) && page > 0 ? page : null;
}

export async function getAllPostPageStaticParams() {
  const totalPosts = await prisma.post.count({
    where: publishedPostWhere(undefined),
  });
  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));

  return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
    page: (index + 2).toString(),
  }));
}

export async function getCategoryStaticParams() {
  return Object.values(categoryUrlSlugByEnum).map((category) => ({
    category,
  }));
}

export async function getCategoryPageStaticParams() {
  const params = await Promise.all(
    Object.entries(categoryUrlSlugByEnum).map(async ([slug, category]) => {
      const totalPosts = await prisma.post.count({
        where: publishedPostWhere(slug as CategorySlug),
      });
      const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));

      return Array.from({ length: Math.max(0, totalPages - 1) }, (_, index) => ({
        category,
        page: (index + 2).toString(),
      }));
    }),
  );

  return params.flat();
}

export async function BlogListing({ activeCategory, currentPage = 1 }: BlogListingProps) {
  const where = publishedPostWhere(activeCategory);
  const [categories, totalPosts] = await Promise.all([
    prisma.category.findMany(),
    prisma.post.count({ where }),
  ]);
  const orderedCategories = categories.sort(
    (first, second) => categoryOrder.indexOf(first.slug) - categoryOrder.indexOf(second.slug),
  );
  const totalPages = Math.max(1, Math.ceil(totalPosts / POSTS_PER_PAGE));

  if (currentPage > totalPages) {
    notFound();
  }

  const posts = await prisma.post.findMany({
    include: {
      category: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    skip: (currentPage - 1) * POSTS_PER_PAGE,
    take: POSTS_PER_PAGE,
    where,
  });
  const activeCategoryLabel =
    orderedCategories.find((category) => category.slug === activeCategory)?.name ?? "All Posts";
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <main>
      <section className="section section-cream">
        <div className="page-shell grid gap-8">
          <div className="stack max-w-3xl">
            <p className="eyebrow">Blog</p>
            <h1 className="text-heading-lg">Read the official journal.</h1>
            <p className="text-lead text-editorial-muted">
              Published thoughts, product progress, and announcements from myClawTeam, organized for
              steady reading and quick filtering.
            </p>
          </div>
          <nav aria-label="Post categories" className="flex flex-wrap gap-3">
            <Link
              aria-current={activeCategory ? undefined : "page"}
              className={`rounded-button border px-5 py-3 text-sm font-bold transition ${
                activeCategory
                  ? "border-editorial-line bg-editorial-white text-editorial-muted hover:border-editorial-red hover:text-editorial-red"
                  : "border-editorial-red bg-editorial-red text-editorial-white"
              }`}
              href="/blog"
            >
              All Posts
            </Link>
            {orderedCategories.map((category) => (
              <Link
                aria-current={activeCategory === category.slug ? "page" : undefined}
                className={`rounded-button border px-5 py-3 text-sm font-bold transition ${
                  activeCategory === category.slug
                    ? "border-editorial-red bg-editorial-red text-editorial-white"
                    : "border-editorial-line bg-editorial-white text-editorial-muted hover:border-editorial-red hover:text-editorial-red"
                }`}
                href={getBlogHref(category.slug)}
                key={category.id}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="section section-white">
        <div className="page-shell grid gap-8">
          <div className="flex flex-col justify-between gap-3 border-b border-editorial-line pb-6 md:flex-row md:items-end">
            <div>
              <p className="eyebrow">{activeCategoryLabel}</p>
              <h2 className="mt-3 text-heading-md">
                {totalPosts === 1 ? "1 published post" : `${totalPosts} published posts`}
              </h2>
            </div>
            <p className="text-sm font-bold uppercase text-editorial-muted">
              Page {currentPage} of {totalPages}
            </p>
          </div>

          {posts.length > 0 ? (
            <div className="grid gap-5">
              {posts.map((post) => (
                <article
                  className="grid gap-6 rounded-card border border-editorial-line bg-editorial-white p-6 shadow-editorial md:grid-cols-[1fr_auto] md:items-end"
                  key={post.id}
                >
                  <div className="grid gap-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-editorial-muted">
                      <span className="font-bold uppercase text-editorial-red">
                        {post.category.name}
                      </span>
                      <span aria-hidden="true">/</span>
                      <time dateTime={post.publishedAt?.toISOString()}>
                        {post.publishedAt ? dateFormatter.format(post.publishedAt) : "Unscheduled"}
                      </time>
                    </div>
                    <div className="grid gap-3">
                      <h3 className="text-[1.75rem] leading-9">{post.title}</h3>
                      <p className="max-w-3xl leading-7 text-editorial-muted">{post.excerpt}</p>
                    </div>
                  </div>
                  <Link
                    className="w-fit text-sm font-bold text-editorial-ink underline decoration-editorial-red decoration-2 underline-offset-8 transition hover:text-editorial-red"
                    href={`/blog/${post.slug}`}
                  >
                    Read post
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-editorial-line bg-editorial-cream p-8 text-editorial-muted">
              No published posts match this category yet.
            </div>
          )}

          <nav
            aria-label="Pagination"
            className="flex flex-col gap-4 border-t border-editorial-line pt-6 md:flex-row md:items-center md:justify-between"
          >
            {currentPage > 1 ? (
              <Link
                className="editorial-button"
                href={getBlogHref(activeCategory ?? null, currentPage - 1)}
              >
                Previous
              </Link>
            ) : (
              <span className="inline-flex w-fit items-center justify-center rounded-button border border-editorial-line px-6 py-3 text-sm font-bold text-editorial-muted">
                Previous
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              {pageNumbers.map((pageNumber) => (
                <Link
                  aria-current={pageNumber === currentPage ? "page" : undefined}
                  className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full border px-4 text-sm font-bold transition ${
                    pageNumber === currentPage
                      ? "border-editorial-red bg-editorial-red text-editorial-white"
                      : "border-editorial-line bg-editorial-white text-editorial-muted hover:border-editorial-red hover:text-editorial-red"
                  }`}
                  href={getBlogHref(activeCategory ?? null, pageNumber)}
                  key={pageNumber}
                >
                  {pageNumber}
                </Link>
              ))}
            </div>
            {currentPage < totalPages ? (
              <Link
                className="editorial-button"
                href={getBlogHref(activeCategory ?? null, currentPage + 1)}
              >
                Next
              </Link>
            ) : (
              <span className="inline-flex w-fit items-center justify-center rounded-button border border-editorial-line px-6 py-3 text-sm font-bold text-editorial-muted md:ml-auto">
                Next
              </span>
            )}
          </nav>
        </div>
      </section>
    </main>
  );
}
