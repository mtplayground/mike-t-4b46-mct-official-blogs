import { PostStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { categoryUrlSlugByEnum } from "../_components/blog-listing";
import { prisma } from "@/lib/db/prisma";
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

function getPostBodyParagraphs(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
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

export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);

  if (!post) {
    notFound();
  }

  const coverImageUrl = post.coverImageKey
    ? await getSignedPostImageUrl(post.coverImageKey)
    : fallbackCoverImage;
  const paragraphs = getPostBodyParagraphs(post.body);

  return (
    <main>
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
              {paragraphs.map((paragraph) => (
                <p className="text-[1.15rem] leading-8 text-editorial-ink" key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>
      </article>
    </main>
  );
}
