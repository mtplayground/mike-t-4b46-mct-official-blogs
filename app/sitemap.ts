import { PostStatus } from "@prisma/client";
import type { MetadataRoute } from "next";

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
