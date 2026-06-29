import { getSelfUrl } from "@/lib/env/server";

export const RUST_API_REVALIDATE_SECONDS = 300;

type ApiCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

type ApiPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  squareCoverImageKey: string | null;
  squareCoverImageUrl: string | null;
  isFeatured: boolean;
  views: number;
  authorName: string;
  authorIntro: string;
  authorAvatarKey: string | null;
  authorAvatarUrl: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  categoryId: string;
  category: ApiCategory;
  createdAt: string;
  updatedAt: string;
};

type ApiPostListResponse = {
  heroPost: ApiPost | null;
  posts: ApiPost[];
};

export type RustCategory = ApiCategory;

export type RustPost = Omit<ApiPost, "createdAt" | "publishedAt" | "updatedAt"> & {
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type RustPostListResponse = {
  heroPost: RustPost | null;
  posts: RustPost[];
};

function apiBaseUrl() {
  return (process.env.RUST_API_BASE_URL || getSelfUrl()).replace(/\/$/, "");
}

function apiUrl(path: string) {
  return new URL(path, `${apiBaseUrl()}/`).toString();
}

function parseApiDate(value: string) {
  const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/u.test(value);
  return new Date(hasTimeZone ? value : `${value}Z`);
}

function normalizePost(post: ApiPost): RustPost {
  return {
    ...post,
    createdAt: parseApiDate(post.createdAt),
    publishedAt: post.publishedAt ? parseApiDate(post.publishedAt) : null,
    updatedAt: parseApiDate(post.updatedAt),
  };
}

async function fetchRustApi<T>(path: string): Promise<T | null> {
  let response: Response;

  try {
    response = await fetch(apiUrl(path), {
      headers: {
        Accept: "application/json",
      },
      next: {
        revalidate: RUST_API_REVALIDATE_SECONDS,
      },
    });
  } catch (error) {
    console.error(`Rust API request failed before response: ${path}`, error);
    return null;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    console.error(`Rust API request failed: ${path} returned ${response.status}`);
    return null;
  }

  return (await response.json()) as T;
}

export async function getRustPostList(): Promise<RustPostListResponse> {
  const data = await fetchRustApi<ApiPostListResponse>("/api/posts");

  if (!data) {
    return {
      heroPost: null,
      posts: [],
    };
  }

  return {
    heroPost: data.heroPost ? normalizePost(data.heroPost) : null,
    posts: data.posts.map(normalizePost),
  };
}

export async function getRustPost(slug: string): Promise<RustPost | null> {
  const data = await fetchRustApi<ApiPost>(`/api/posts/${encodeURIComponent(slug)}`);

  return data ? normalizePost(data) : null;
}
