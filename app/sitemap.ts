import type { MetadataRoute } from "next";

import { getRustPostList } from "@/lib/api/rust-blog";
import { absoluteSiteUrl } from "@/lib/metadata";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { posts } = await getRustPostList();
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
