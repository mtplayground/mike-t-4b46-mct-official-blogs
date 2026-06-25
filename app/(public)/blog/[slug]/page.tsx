import { PostStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { getSignedMarkdownBody } from "@/lib/content/markdown";
import { prisma } from "@/lib/db/prisma";
import { absoluteSiteUrl, buildPageMetadata, siteName } from "@/lib/metadata";
import { getSignedPostImageUrl } from "@/lib/storage/object-storage";

export const revalidate = 300;

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

type PostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

const markdownComponents: Components = {
  a({ children, href }) {
    return (
      <a
        className="font-bold text-editorial-red underline decoration-editorial-red decoration-2 underline-offset-4 transition hover:text-editorial-ink"
        href={href}
        rel={href?.startsWith("http") ? "noreferrer" : undefined}
        target={href?.startsWith("http") ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  },
  blockquote({ children }) {
    return (
      <blockquote className="rounded-card border-l-4 border-editorial-red bg-editorial-cream px-6 py-5 text-[1.1rem] leading-8 text-editorial-muted shadow-editorial">
        {children}
      </blockquote>
    );
  },
  code({ children, className }) {
    if (className) {
      return <code className={`${className} font-mono text-editorial-white`}>{children}</code>;
    }

    return (
      <code className="rounded bg-editorial-cream px-2 py-1 font-mono text-sm text-editorial-red">
        {children}
      </code>
    );
  },
  h2({ children }) {
    return (
      <h2 className="pt-6 font-display text-3xl font-semibold leading-tight text-editorial-ink">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="pt-4 font-display text-2xl font-semibold leading-snug text-editorial-ink">
        {children}
      </h3>
    );
  },
  img({ alt, src }) {
    if (!src) {
      return null;
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element -- Markdown storage image URLs are signed server-side before render.
      <img
        alt={alt ?? ""}
        className="my-4 w-full rounded-card border border-editorial-line bg-editorial-cream object-cover shadow-editorial"
        src={src}
      />
    );
  },
  li({ children }) {
    return (
      <li className="pl-2 leading-8 text-editorial-ink marker:text-editorial-red">{children}</li>
    );
  },
  ol({ children }) {
    return <ol className="grid list-decimal gap-3 pl-6 text-[1.1rem]">{children}</ol>;
  },
  p({ children }) {
    return <p className="text-[1.15rem] leading-8 text-editorial-ink">{children}</p>;
  },
  pre({ children }) {
    return (
      <pre className="overflow-x-auto rounded-card border border-editorial-line bg-editorial-dark-card p-5 text-sm leading-7 text-editorial-white shadow-editorial">
        {children}
      </pre>
    );
  },
  ul({ children }) {
    return <ul className="grid list-disc gap-3 pl-6 text-[1.1rem]">{children}</ul>;
  },
};

async function getPublishedPost(slug: string) {
  return prisma.post.findFirst({
    include: {
      category: true,
    },
    where: {
      publishedAt: {
        not: null,
      },
      slug,
      status: PostStatus.PUBLISHED,
    },
  });
}

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function buildArticleJsonLd({
  authorAvatarUrl,
  coverImageUrl,
  post,
}: {
  authorAvatarUrl: string | null;
  coverImageUrl: string | null;
  post: NonNullable<Awaited<ReturnType<typeof getPublishedPost>>>;
}) {
  const canonicalUrl = absoluteSiteUrl(`/blog/${post.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    articleSection: post.category.name,
    ...(coverImageUrl
      ? {
          image: [coverImageUrl],
        }
      : {}),
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    author: {
      "@type": "Person",
      name: post.authorName,
      ...(authorAvatarUrl
        ? {
            image: authorAvatarUrl,
          }
        : {}),
    },
    publisher: {
      "@type": "Organization",
      name: "myClawTeam",
      url: absoluteSiteUrl("/"),
    },
    isPartOf: {
      "@type": "Blog",
      name: siteName,
      url: absoluteSiteUrl("/blog"),
    },
  };
}

export async function generateStaticParams() {
  const posts = await prisma.post.findMany({
    select: {
      slug: true,
    },
    where: {
      publishedAt: {
        not: null,
      },
      status: PostStatus.PUBLISHED,
    },
  });

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    return buildPageMetadata({
      title: "Post not found",
      description: "This post is not available on the myClawTeam official blog.",
      path: `/blog/${slug}`,
    });
  }

  return buildPageMetadata({
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    type: "article",
  });
}

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    notFound();
  }

  const [coverImageUrl, authorAvatarUrl, signedBody] = await Promise.all([
    post.coverImageKey ? getSignedPostImageUrl(post.coverImageKey) : Promise.resolve(null),
    post.authorAvatarKey ? getSignedPostImageUrl(post.authorAvatarKey) : Promise.resolve(null),
    getSignedMarkdownBody(post.body),
  ]);
  const articleJsonLd = buildArticleJsonLd({ authorAvatarUrl, coverImageUrl, post });

  return (
    <main>
      <script
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(articleJsonLd),
        }}
        type="application/ld+json"
      />
      <article>
        <section className="section section-cream">
          <div className="page-shell grid gap-10">
            <Link
              className="w-fit text-sm font-bold text-editorial-muted underline decoration-editorial-red decoration-2 underline-offset-8 transition hover:text-editorial-red"
              href="/"
            >
              Back to articles
            </Link>
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-editorial-muted">
                <span className="font-bold uppercase text-editorial-red">{post.category.name}</span>
                <span aria-hidden="true">/</span>
                <time dateTime={post.publishedAt?.toISOString()}>
                  {post.publishedAt ? dateFormatter.format(post.publishedAt) : "Unscheduled"}
                </time>
              </div>
              <h1 className="max-w-4xl text-heading-md">{post.title}</h1>
              <p className="max-w-3xl text-lead text-editorial-muted">{post.excerpt}</p>
            </div>
          </div>
        </section>

        <section className="section section-white">
          <div className="page-shell grid gap-12">
            {coverImageUrl ? (
              <figure className="overflow-hidden rounded-card border border-editorial-line bg-editorial-cream shadow-editorial">
                {/* eslint-disable-next-line @next/next/no-img-element -- Signed private cover URLs are resolved at render time. */}
                <img
                  alt=""
                  className="h-[360px] w-full object-cover md:h-[520px]"
                  src={coverImageUrl}
                />
              </figure>
            ) : null}

            <div className="mx-auto grid w-full max-w-3xl gap-7">
              <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                {signedBody}
              </ReactMarkdown>

              <aside className="mt-8 grid gap-5 rounded-card border border-editorial-line bg-editorial-cream p-6 shadow-editorial sm:grid-cols-[auto_1fr] sm:items-center">
                {authorAvatarUrl ? (
                  <figure className="size-24 overflow-hidden rounded-full border border-editorial-line bg-editorial-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Signed private author avatar URLs are resolved at render time. */}
                    <img alt="" className="h-full w-full object-cover" src={authorAvatarUrl} />
                  </figure>
                ) : null}
                <div className="grid gap-2">
                  <p className="eyebrow">Written by</p>
                  <h2 className="text-2xl font-semibold text-editorial-ink">{post.authorName}</h2>
                  <p className="leading-7 text-editorial-muted">{post.authorIntro}</p>
                </div>
              </aside>
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
