import { PostStatus } from "@prisma/client";
import Link from "next/link";

import { prisma } from "@/lib/db/prisma";
import { buildPageMetadata } from "@/lib/metadata";

export const revalidate = 300;

export const metadata = buildPageMetadata({
  title: "Practical AI engineering, written in the open",
  description:
    "Field notes, product progress, and announcements from the team building dependable AI-powered software.",
  path: "/",
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

const focusAreas = [
  {
    title: "Thoughts",
    copy: "Practical notes on AI engineering decisions, delivery habits, and the work behind useful systems.",
  },
  {
    title: "Product Progress",
    copy: "Clear updates from active builds, including what changed, why it changed, and what comes next.",
  },
  {
    title: "Announcements",
    copy: "Launch notes, platform milestones, and official updates from the myClawTeam engineering team.",
  },
];

async function getRecentPosts() {
  return prisma.post.findMany({
    include: {
      category: true,
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: 3,
    where: {
      publishedAt: {
        not: null,
      },
      status: PostStatus.PUBLISHED,
    },
  });
}

export default async function HomePage() {
  const recentPosts = await getRecentPosts();

  return (
    <main>
      <section
        className="relative overflow-hidden bg-editorial-cream"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgb(247 242 234 / 0.98) 0%, rgb(247 242 234 / 0.88) 47%, rgb(247 242 234 / 0.32) 100%), url('/images/editorial-hero.png')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="page-shell min-h-[680px] py-24 md:min-h-[720px] md:py-28">
          <div className="grid max-w-3xl gap-8">
            <p className="eyebrow">myClawTeam Official Blogs</p>
            <h1 className="text-[3rem] font-display font-semibold leading-[3.2rem] text-editorial-ink md:text-heading-lg">
              Practical AI engineering, written in the{" "}
              <span className="text-editorial-red">open</span>.
            </h1>
            <p className="max-w-2xl text-lead text-editorial-muted">
              Field notes, product progress, and announcements from the team building dependable
              AI-powered software with senior engineering judgment.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link className="editorial-button" href="/blog">
                Read the blog
              </Link>
              <Link
                className="text-sm font-bold text-editorial-ink underline decoration-editorial-red decoration-2 underline-offset-8 transition hover:text-editorial-red"
                href="#recent-posts"
              >
                Latest posts
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-white">
        <div className="page-shell grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="stack">
            <p className="eyebrow">Editorial Focus</p>
            <h2 className="text-heading-md">A useful signal through the build cycle.</h2>
            <p className="text-lead text-editorial-muted">
              The journal keeps the work legible: the thinking behind decisions, the progress worth
              tracking, and the announcements teams need to act on.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {focusAreas.map((area) => (
              <article
                className="feature-card grid min-h-[260px] content-between gap-8"
                key={area.title}
              >
                <div className="grid gap-4">
                  <p className="eyebrow">{area.title}</p>
                  <h3 className="text-[1.65rem] leading-8 text-editorial-white">{area.title}</h3>
                </div>
                <p className="feature-card-muted leading-7">{area.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-cream" id="recent-posts">
        <div className="page-shell grid gap-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div className="stack max-w-2xl">
              <p className="eyebrow">Recent Posts</p>
              <h2 className="text-heading-md">Latest notes from the team.</h2>
              <p className="text-lead text-editorial-muted">
                Fresh published entries from the editorial archive, ordered by publication date.
              </p>
            </div>
            <Link className="editorial-button" href="/blog">
              Browse all posts
            </Link>
          </div>

          {recentPosts.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-3">
              {recentPosts.map((post) => (
                <article
                  className="grid min-h-[320px] content-between gap-8 rounded-card border border-editorial-line bg-editorial-white p-6 shadow-editorial"
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
                    <h3 className="text-[1.55rem] leading-8">{post.title}</h3>
                    <p className="leading-7 text-editorial-muted">{post.excerpt}</p>
                  </div>
                  <Link
                    className="w-fit text-sm font-bold text-editorial-ink underline decoration-editorial-red decoration-2 underline-offset-8 transition hover:text-editorial-red"
                    href="/blog"
                  >
                    Read on the blog
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-editorial-line bg-editorial-white p-8 text-editorial-muted">
              Published posts will appear here after the archive is seeded.
            </div>
          )}
        </div>
      </section>

      <section className="section section-white">
        <div className="page-shell grid gap-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="stack max-w-3xl">
            <p className="eyebrow">Built for clarity</p>
            <h2 className="text-heading-md">Follow the decisions behind dependable AI software.</h2>
          </div>
          <Link className="editorial-button" href="/blog">
            Start reading
          </Link>
        </div>
      </section>
    </main>
  );
}
