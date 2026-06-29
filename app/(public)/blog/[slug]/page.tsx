import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { ArticleEngagement } from "@/components/blog/article-engagement";
import { coverMediaFrameClassName, coverMediaImageClassName } from "@/lib/content/cover-media";
import { getRustPost, getRustPostList, type RustPost } from "@/lib/api/rust-blog";
import { absoluteSiteUrl, buildPageMetadata, siteName } from "@/lib/metadata";

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
      <h2 className="pt-6 font-sans text-3xl font-semibold leading-tight text-editorial-ink">
        {children}
      </h2>
    );
  },
  h3({ children }) {
    return (
      <h3 className="pt-4 font-sans text-2xl font-semibold leading-snug text-editorial-ink">
        {children}
      </h3>
    );
  },
  img({ alt, src }) {
    if (!src) {
      return null;
    }

    return (
      // eslint-disable-next-line @next/next/no-img-element -- Markdown storage image URLs are resolved by the Rust image proxy.
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

function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function MyClawTeamCard() {
  const socialLinks = [
    {
      href: "https://x.com/myclawteam_ai",
      label: "X",
    },
    {
      href: "https://discord.gg/p8RtDfjmWK",
      label: "Discord",
    },
  ];

  return (
    <aside className="grid gap-5 rounded-card border border-editorial-line bg-editorial-cream p-6 shadow-editorial sm:grid-cols-[auto_1fr] sm:items-start">
      <img
        alt="myClawTeam logo"
        className="h-12 w-auto"
        src="https://myclawteam.ai/logo.png"
      />
      <div className="grid gap-4">
        <p className="eyebrow">About myClawTeam</p>
        <p className="text-[1.05rem] leading-8 text-editorial-muted">
          myClawTeam AI (MCT) is a professional AI agent team cloud to help you ship high-quality
          software easily. myClawTeam turns your ideas into production-ready software within hours.
          You just talk — we handle the rest.
        </p>
        <div className="flex flex-wrap gap-4 pt-1" aria-label="myClawTeam social links">
          {socialLinks.map((link) => (
            <a
              key={link.href}
              className="font-bold text-editorial-red underline decoration-editorial-red decoration-2 underline-offset-4 transition hover:text-editorial-ink"
              href={link.href}
              rel="noreferrer"
              target="_blank"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}

function LinkifiedText({ text }: { text: string }) {
  const urlPattern = /https?:\/\/\S+/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(text))) {
    const [matchedUrl] = match;
    const start = match.index;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    const trailingPunctuation = matchedUrl.match(/[).,!?:;]+$/u)?.[0] ?? "";
    const url = trailingPunctuation
      ? matchedUrl.slice(0, matchedUrl.length - trailingPunctuation.length)
      : matchedUrl;

    nodes.push(
      <a
        key={`${url}-${start}`}
        className="font-bold text-editorial-red underline decoration-editorial-red decoration-2 underline-offset-4 transition hover:text-editorial-ink"
        href={url}
        rel="noreferrer"
        target="_blank"
      >
        {url}
      </a>,
    );

    if (trailingPunctuation) {
      nodes.push(trailingPunctuation);
    }

    lastIndex = start + matchedUrl.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return <>{nodes.length ? nodes : text}</>;
}

function buildArticleJsonLd({
  authorAvatarUrl,
  coverImageUrl,
  post,
}: {
  authorAvatarUrl: string | null;
  coverImageUrl: string | null;
  post: RustPost;
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
  const { posts } = await getRustPostList();

  return posts.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getRustPost(slug);

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
  const post = await getRustPost(slug);

  if (!post) {
    notFound();
  }

  const coverImageUrl = post.coverImageUrl;
  const authorAvatarUrl = post.authorAvatarUrl;
  const signedBody = post.body;
  const canonicalUrl = absoluteSiteUrl(`/blog/${post.slug}`);
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
              <figure
                className={`${coverMediaFrameClassName} rounded-card border border-editorial-line shadow-editorial`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- Private cover URLs are resolved by the Rust image proxy. */}
                <img alt="" className={coverMediaImageClassName} src={coverImageUrl} />
              </figure>
            ) : null}

            <div className="mx-auto grid w-full max-w-3xl gap-7">
              <ArticleEngagement slug={post.slug} title={post.title} url={canonicalUrl} />

              <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                {signedBody}
              </ReactMarkdown>

              <aside className="mt-8 grid gap-5 rounded-card border border-editorial-line bg-editorial-cream p-6 shadow-editorial sm:grid-cols-[auto_1fr] sm:items-center">
                {authorAvatarUrl ? (
                  <figure className="size-24 overflow-hidden rounded-full border border-editorial-line bg-editorial-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Private author avatar URLs are resolved by the Rust image proxy. */}
                    <img alt="" className="h-full w-full object-cover" src={authorAvatarUrl} />
                  </figure>
                ) : null}
                <div className="grid gap-2">
                  <p className="eyebrow">Written by</p>
                  <h2 className="text-2xl font-semibold text-editorial-ink">{post.authorName}</h2>
                  <p className="leading-7 text-editorial-muted">
                    <LinkifiedText text={post.authorIntro} />
                  </p>
                </div>
              </aside>

              <MyClawTeamCard />
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
