import Link from "next/link";

import { getRustPostList, type RustPost } from "@/lib/api/rust-blog";
import { coverMediaFrameClassName, coverMediaImageClassName } from "@/lib/content/cover-media";
import { buildPageMetadata } from "@/lib/metadata";

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

function formatPublishedDate(post: Pick<RustPost, "publishedAt">) {
  return post.publishedAt ? dateFormatter.format(post.publishedAt) : "Unscheduled";
}

function getHeroImageUrl(post: RustPost) {
  return post.squareCoverImageUrl ?? post.coverImageUrl;
}

function PostImage({ alt, src }: { alt: string; src: string | null }) {
  if (!src) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-editorial-cream px-6 text-center text-sm font-bold uppercase tracking-[0.18em] text-editorial-muted">
        Cover image pending
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- Private object storage images are resolved by the Rust image proxy.
    <img alt={alt} className={coverMediaImageClassName} src={src} />
  );
}

function PostMeta({ post }: { post: RustPost }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-editorial-muted">
      <span className="font-bold uppercase text-editorial-red">{post.category.name}</span>
      <span aria-hidden="true">/</span>
      <time dateTime={post.publishedAt?.toISOString()}>{formatPublishedDate(post)}</time>
    </div>
  );
}

function ArticleCard({ post }: { post: RustPost }) {
  return (
    <article className="group grid overflow-hidden rounded-card border border-editorial-line bg-editorial-white shadow-editorial transition hover:-translate-y-1 hover:shadow-lg">
      <Link className="grid h-full" href={`/blog/${post.slug}`}>
        <figure className={coverMediaFrameClassName}>
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
  const { heroPost, posts } = await getRustPostList();
  const heroImageUrl = heroPost ? getHeroImageUrl(heroPost) : null;

  return (
    <main>
      <section className="section section-cream overflow-hidden">
        <div className="page-shell grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          {heroPost ? (
            <>
              <div className="stack max-w-3xl">
                <p className="eyebrow">myClawTeam Official Blogs / Featured Article</p>
                <PostMeta post={heroPost} />
                <h1 className="text-[2.35rem] font-sans font-semibold leading-[2.65rem] text-editorial-ink md:text-heading-md">
                  {heroPost.title}
                </h1>
                <p className="text-lead text-editorial-muted">{heroPost.excerpt}</p>
                <Link className="editorial-button w-fit" href={`/blog/${heroPost.slug}`}>
                  Read article
                </Link>
              </div>
              <Link
                aria-label={`Read ${heroPost.title}`}
                className="group overflow-hidden rounded-card border border-editorial-line bg-editorial-white shadow-editorial"
                href={`/blog/${heroPost.slug}`}
              >
                <figure className="aspect-square overflow-hidden bg-editorial-cream">
                  <PostImage alt="" src={heroImageUrl} />
                </figure>
              </Link>
            </>
          ) : (
            <div className="stack max-w-3xl lg:col-span-2">
              <p className="eyebrow">myClawTeam Official Blogs</p>
              <h1 className="text-[3rem] font-sans font-semibold leading-[3.2rem] text-editorial-ink md:text-heading-lg">
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
            </div>
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
