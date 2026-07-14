import { getSelfUrl } from "@/lib/env/server";

const PUBLIC_REVALIDATE_SECONDS = 300;
const DEFAULT_COMPANY_NAME = "myClawTeam";
const DEFAULT_COMPANY_LOGO_URL = "https://myclawteam.ai/logo.png";
const DEFAULT_COMPANY_WEBSITE_URL = "https://myclawteam.ai";

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
  companyName?: string | null;
  companyIntro?: string | null;
  companyLogoKey?: string | null;
  companyLogoUrl?: string | null;
  companyWebsiteUrl?: string | null;
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

export type RustPost = Omit<
  ApiPost,
  | "companyIntro"
  | "companyLogoKey"
  | "companyLogoUrl"
  | "companyName"
  | "companyWebsiteUrl"
  | "createdAt"
  | "publishedAt"
  | "updatedAt"
> & {
  companyIntro: string;
  companyLogoKey: string | null;
  companyLogoUrl: string;
  companyName: string;
  companyWebsiteUrl: string;
  createdAt: Date;
  publishedAt: Date | null;
  updatedAt: Date;
};

export type RustPostListResponse = {
  heroPost: RustPost | null;
  posts: RustPost[];
};

export class RustApiRequestError extends Error {
  readonly body?: string;
  readonly path: string;
  readonly status?: number;

  constructor({
    body,
    cause,
    message,
    path,
    status,
  }: {
    body?: string;
    cause?: unknown;
    message: string;
    path: string;
    status?: number;
  }) {
    super(message, { cause });
    this.name = "RustApiRequestError";
    this.body = body;
    this.path = path;
    this.status = status;
  }
}

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
    companyIntro: post.companyIntro ?? "",
    companyLogoKey: post.companyLogoKey ?? null,
    companyLogoUrl: post.companyLogoUrl ?? DEFAULT_COMPANY_LOGO_URL,
    companyName: post.companyName ?? DEFAULT_COMPANY_NAME,
    companyWebsiteUrl: post.companyWebsiteUrl ?? DEFAULT_COMPANY_WEBSITE_URL,
    createdAt: parseApiDate(post.createdAt),
    publishedAt: post.publishedAt ? parseApiDate(post.publishedAt) : null,
    updatedAt: parseApiDate(post.updatedAt),
  };
}

async function readResponseBody(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    return `Unable to read response body: ${String(error)}`;
  }
}

type FetchRustApiOptions = {
  nullOnNotFound?: boolean;
};

async function fetchRustApi<T>(
  path: string,
  { nullOnNotFound = true }: FetchRustApiOptions = {},
): Promise<T | null> {
  let response: Response;

  try {
    response = await fetch(apiUrl(path), {
      headers: {
        Accept: "application/json",
      },
      next: { revalidate: PUBLIC_REVALIDATE_SECONDS },
    });
  } catch (error) {
    console.error("Rust API request failed before response", { error, path });
    throw new RustApiRequestError({
      cause: error,
      message: `Rust API request failed before response: ${path}`,
      path,
    });
  }

  if (response.status === 404 && nullOnNotFound) {
    return null;
  }

  if (!response.ok) {
    const body = await readResponseBody(response);
    console.error("Rust API request failed", { body, path, status: response.status });
    throw new RustApiRequestError({
      body,
      message: `Rust API request failed: ${path} returned ${response.status}`,
      path,
      status: response.status,
    });
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    console.error("Rust API response JSON parse failed", { error, path });
    throw new RustApiRequestError({
      cause: error,
      message: `Rust API response JSON parse failed: ${path}`,
      path,
      status: response.status,
    });
  }
}

export async function getRustPostList(): Promise<RustPostListResponse> {
  const data = await fetchRustApi<ApiPostListResponse>("/api/posts", { nullOnNotFound: false });

  if (!data) {
    throw new RustApiRequestError({
      message: "Rust API posts endpoint returned no data.",
      path: "/api/posts",
    });
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
