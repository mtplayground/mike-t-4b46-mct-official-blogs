import { PostStatus } from "@prisma/client";
import type { MetadataRoute } from "next";

import { categoryUrlSlugByEnum } from "./(public)/blog/_components/blog-listing";
import { prisma } from "@/lib/db/prisma";
import { absoluteSiteUrl } from "@/lib/metadata";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await prisma.post.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      publishedAt: true,
      slug: true,
      updatedAt: true,
    },
    where: {
      publishedAt: {
        not: null,
      },
      status: PostStatus.PUBLISHED,
    },
  });

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: absoluteSiteUrl("/"),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteSiteUrl("/blog"),
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...Object.values(categoryUrlSlugByEnum).map((category) => ({
      url: absoluteSiteUrl(`/blog/category/${category}`),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: absoluteSiteUrl(`/blog/${post.slug}`),
      lastModified: post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
