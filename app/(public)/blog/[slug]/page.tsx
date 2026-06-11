import { PostStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { categoryUrlSlugByEnum } from "../_components/blog-listing";
import { prisma } from "@/lib/db/prisma";
import { absoluteSiteUrl, buildPageMetadata, siteName } from "@/lib/metadata";
import { getSignedPostImageUrl } from "@/lib/storage/object-storage";

export const revalidate = 300;

const fallbackCoverImage = "/images/editorial-hero.png";

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

type BodyBlock =
  | {
      alt: string;
      kind: "image";
      src: string;
    }
  | {
      kind: "paragraph";
      text: string;
    };

function parseStorageImage(paragraph: string) {
  const match = paragraph.match(/^!\[([^\]]*)\]\(storage:([^)]+)\)$/);

  if (!match) {
    return null;
  }

  return {
    alt: match[1],
    key: match[2],
  };
}

async function getPostBodyBlocks(body: string): Promise<BodyBlock[]> {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return Promise.all(
    paragraphs.map(async (paragraph) => {
      const storageImage = parseStorageImage(paragraph);

      if (storageImage) {
        try {
          return {
            alt: storageImage.alt,
            kind: "image",
            src: await getSignedPostImageUrl(storageImage.key),
          };
        } catch (error) {
          console.error("Failed to sign inline post image", error);
        }
      }

      return {
        kind: "paragraph",
        text: paragraph,
      };
    }),
  );
}

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

function buildArticleJsonLd(post: NonNullable<Awaited<ReturnType<typeof getPublishedPost>>>) {
  const canonicalUrl = absoluteSiteUrl(`/blog/${post.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    articleSection: post.category.name,
    image: [absoluteSiteUrl(fallbackCoverImage)],
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonicalUrl,
    },
    author: {
      "@type": "Organization",
      name: "myClawTeam",
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

  const coverImageUrl = post.coverImageKey
    ? await getSignedPostImageUrl(post.coverImageKey)
    : fallbackCoverImage;
  const bodyBlocks = await getPostBodyBlocks(post.body);
  const articleJsonLd = buildArticleJsonLd(post);

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
              href="/blog"
            >
              Back to blog
            </Link>
            <div className="grid gap-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-editorial-muted">
                <Link
                  className="font-bold uppercase text-editorial-red transition hover:text-editorial-ink"
                  href={`/blog/category/${categoryUrlSlugByEnum[post.category.slug]}`}
                >
                  {post.category.name}
                </Link>
                <span aria-hidden="true">/</span>
                <time dateTime={post.publishedAt?.toISOString()}>
                  {post.publishedAt ? dateFormatter.format(post.publishedAt) : "Unscheduled"}
                </time>
              </div>
              <h1 className="max-w-4xl text-heading-lg">{post.title}</h1>
              <p className="max-w-3xl text-lead text-editorial-muted">{post.excerpt}</p>
            </div>
          </div>
        </section>

        <section className="section section-white">
          <div className="page-shell grid gap-12">
            <figure className="overflow-hidden rounded-card border border-editorial-line bg-editorial-cream shadow-editorial">
              {/* eslint-disable-next-line @next/next/no-img-element -- Signed private cover URLs are resolved at render time. */}
              <img
                alt=""
                className="h-[360px] w-full object-cover md:h-[520px]"
                src={coverImageUrl}
              />
            </figure>

            <div className="mx-auto grid w-full max-w-3xl gap-7">
              {bodyBlocks.map((block) =>
                block.kind === "image" ? (
                  <figure
                    className="overflow-hidden rounded-card border border-editorial-line bg-editorial-cream shadow-editorial"
                    key={block.src}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- Signed private inline image URLs are resolved at render time. */}
                    <img alt={block.alt} className="w-full object-cover" src={block.src} />
                  </figure>
                ) : (
                  <p className="text-[1.15rem] leading-8 text-editorial-ink" key={block.text}>
                    {block.text}
                  </p>
                ),
              )}
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
