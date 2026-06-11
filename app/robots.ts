import type { MetadataRoute } from "next";

import { absoluteSiteUrl } from "@/lib/metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/"],
    },
    sitemap: absoluteSiteUrl("/sitemap.xml"),
    host: absoluteSiteUrl("/"),
  };
}
