import { PostStatus, type Category, type Post } from "@prisma/client";
import Link from "next/link";

import { prisma } from "@/lib/db/prisma";
import { buildPageMetadata } from "@/lib/metadata";
import { getSignedPostImageUrl } from "@/lib/storage/object-storage";

export const revalidate = 300;

export const metadata = buildPageMetadata({
  title: "Official myClawTeam updates and practical AI engineering notes",
  description:
    "Official updates, product progress, announcements, and engineering notes from myClawTeam.",
  path: "/",
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

type PublishedPost = Post & {
  category: Category;
};

type HomepagePost = PublishedPost & {
  coverImageUrl: string | null;
};

function publishedPostWhere() {
  return {
    publishedAt: {
      not: null,
    },
    status: PostStatus.PUBLISHED,
  };
}

function formatPublishedDate(post: Pick<Post, "publishedAt">) {
  return post.publishedAt ? dateFormatter.format(post.publishedAt) : "Unscheduled";
}

async function withSignedCoverImage(post: PublishedPost): Promise<HomepagePost> {
  if (!post.coverImageKey) {
    return {
      ...post,
      coverImageUrl: null,
    };
  }

  return {
    ...post,
    coverImageUrl: await getSignedPostImageUrl(post.coverImageKey),
  };
}

async function getHomepagePosts() {
  const where = publishedPostWhere();
  const [featuredPost, latestPost, posts] = await Promise.all([
    prisma.post.findFirst({
      include: {
        category: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      where: {
        ...where,
        isFeatured: true,
      },
    }),
    prisma.post.findFirst({
      include: {
        category: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      where,
    }),
    prisma.post.findMany({
      include: {
        category: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      where,
    }),
  ]);
  const heroPost = featuredPost ?? latestPost;

  return {
    heroPost: heroPost ? await withSignedCoverImage(heroPost) : null,
    posts: await Promise.all(posts.map(withSignedCoverImage)),
  };
}

function PostImage({ alt, src }: { alt: string; src: string | null }) {
  if (!src) {
    return (
      <div className="flex min-h-[260px] items-center justify-center bg-editorial-cream px-6 text-center text-sm font-bold uppercase tracking-[0.18em] text-editorial-muted">
        Cover image pending
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Private object storage images are signed server-side before render.
    <img alt={alt} className="h-full w-full object-cover" src={src} />
  );
}

function PostMeta({ post }: { post: HomepagePost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-editorial-muted">
      <span className="font-bold uppercase text-editorial-red">{post.category.name}</span>
      <span aria-hidden="true">/</span>
      <time dateTime={post.publishedAt?.toISOString()}>{formatPublishedDate(post)}</time>
    </div>
  );
}

function ArticleCard({ post }: { post: HomepagePost }) {
  return (
    <article className="group grid overflow-hidden rounded-card border border-editorial-line bg-editorial-white shadow-editorial transition hover:-translate-y-1 hover:shadow-lg">
      <Link className="grid h-full" href={`/blog/${post.slug}`}>
        <figure className="h-64 overflow-hidden bg-editorial-cream">
          <PostImage alt="" src={post.coverImageUrl} />
        </figure>
        <div className="grid content-between gap-8 p-6">
          <div className="grid gap-4">
            <PostMeta post={post} />
            <h2 className="text-[1.55rem] leading-8 transition group-hover:text-editorial-red">
              {post.title}
            </h2>
            <p className="leading-7 text-editorial-muted">{post.excerpt}</p>
          </div>
          <span className="w-fit text-sm font-bold text-editorial-ink underline decoration-editorial-red decoration-2 underline-offset-8 transition group-hover:text-editorial-red">
            Read article
          </span>
        </div>
      </Link>
    </article>
  );
}

export default async function HomePage() {
  const { heroPost, posts } = await getHomepagePosts();

  return (
    <main>
      <section className="section section-cream overflow-hidden">
        <div className="page-shell grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          {heroPost ? (
            <>
              <div className="stack max-w-3xl">
                <p className="eyebrow">myClawTeam Official Blogs / Featured Article</p>
                <PostMeta post={heroPost} />
                <h1 className="text-[3rem] font-display font-semibold leading-[3.2rem] text-editorial-ink md:text-heading-lg">
                  {heroPost.title}
                </h1>
                <p className="text-lead text-editorial-muted">{heroPost.excerpt}</p>
                <Link className="editorial-button w-fit" href={`/blog/${heroPost.slug}`}>
                  Read featured article
                </Link>
              </div>
              <Link
                aria-label={`Read ${heroPost.title}`}
                className="group overflow-hidden rounded-card border border-editorial-line bg-editorial-white shadow-editorial"
                href={`/blog/${heroPost.slug}`}
              >
                <figure className="h-[420px] overflow-hidden bg-editorial-cream md:h-[560px]">
                  <PostImage alt="" src={heroPost.coverImageUrl} />
                </figure>
              </Link>
            </>
          ) : (
            <div className="stack max-w-3xl lg:col-span-2">
              <p className="eyebrow">myClawTeam Official Blogs</p>
              <h1 className="text-[3rem] font-display font-semibold leading-[3.2rem] text-editorial-ink md:text-heading-lg">
                Official myClawTeam updates, product progress, and engineering notes.
              </h1>
              <p className="text-lead text-editorial-muted">
                Official myClawTeam articles will appear here once the editorial archive has a live
                post.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="section section-white" id="articles">
        <div className="page-shell grid gap-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="stack max-w-3xl">
              <p className="eyebrow">Official Journal</p>
              <h2 className="text-heading-md">Read the latest from myClawTeam Official Blogs.</h2>
              <p className="text-lead text-editorial-muted">
                Official updates, product progress, announcements, and engineering notes from
                myClawTeam.
              </p>
            </div>
            <Link className="editorial-button" href="#articles">
              Browse articles
            </Link>
          </div>

          {posts.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <ArticleCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-editorial-line bg-editorial-cream p-8 text-editorial-muted">
              Official myClawTeam posts will appear here after the archive is seeded.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
