import { cookies } from "next/headers";

export type AdminCategory = { id: string; name: string; slug?: string; description?: string | null };
export type AdminPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverImageKey: string | null;
  squareCoverImageKey: string | null;
  isFeatured: boolean;
  views: number;
  authorName: string;
  authorIntro: string;
  authorAvatarKey: string | null;
  status: "DRAFT" | "PUBLISHED";
  publishedAt: string | null;
  categoryId: string;
  categoryName: string;
  createdAt: string;
  updatedAt: string;
};
export type AdminSubscriber = { id: string; email: string; createdAt: string };

type MutationResponse = { message?: string; notice?: string; post?: AdminPost | null };

function rustApiBaseUrl() {
  return (process.env.RUST_API_BASE_URL || process.env.SELF_URL || "http://127.0.0.1:8080").replace(/\/$/u, "");
}

function rustApiUrl(path: string) {
  return new URL(path, `${rustApiBaseUrl()}/`).toString();
}

async function adminCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function rustAdminFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const cookie = await adminCookieHeader();
  if (cookie) headers.set("cookie", cookie);
  return fetch(rustApiUrl(path), { ...init, headers, cache: "no-store" });
}

async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await rustAdminFetch(path, { headers: { accept: "application/json" } });
    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Rust admin API request failed: ${path}`, error);
    return fallback;
  }
}

export async function getAdminPosts() {
  return getJson<AdminPost[]>("/api/admin/posts", []);
}

export async function getAdminPost(id: string) {
  const post = await getJson<AdminPost | null>(`/api/admin/posts/${encodeURIComponent(id)}`, null);
  return post;
}

export async function getAdminCategories() {
  return getJson<AdminCategory[]>("/api/admin/categories", []);
}

export async function getAdminSubscribers() {
  return getJson<AdminSubscriber[]>("/api/admin/subscribers", []);
}

export async function submitAdminForm(path: string, formData: FormData, method = "POST") {
  const response = await rustAdminFetch(path, { method, body: formData });
  let payload: MutationResponse = {};
  try {
    payload = (await response.json()) as MutationResponse;
  } catch {}
  return { ok: response.ok, status: response.status, payload };
}

export async function submitAdminMutation(path: string, method = "POST") {
  const response = await rustAdminFetch(path, { method });
  let payload: MutationResponse = {};
  try {
    payload = (await response.json()) as MutationResponse;
  } catch {}
  return { ok: response.ok, status: response.status, payload };
}
