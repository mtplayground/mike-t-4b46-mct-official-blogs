import type { Metadata } from "next";

import { getSelfUrl } from "./env/server";

export const siteName = "myClawTeam Official Blogs";
export const defaultDescription =
  "Official updates, product progress, announcements, and engineering notes from myClawTeam.";

const defaultSocialImagePath = "/images/editorial-hero.png";

export function absoluteSiteUrl(path = "/") {
  return new URL(path, getSelfUrl()).toString();
}

export function buildPageMetadata({
  description,
  path,
  title,
  type = "website",
}: {
  description: string;
  path: string;
  title: string;
  type?: "article" | "website";
}): Metadata {
  const url = absoluteSiteUrl(path);
  const imageUrl = absoluteSiteUrl(defaultSocialImagePath);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName,
      type,
      images: [
        {
          url: imageUrl,
          width: 1744,
          height: 902,
          alt: siteName,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}
