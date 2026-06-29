import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

const CATEGORY_PATHS = [
  "/blog/category/thoughts",
  "/blog/category/product-progress",
  "/blog/category/announcements",
] as const;

type RevalidatePayload = {
  slug?: unknown;
  slugs?: unknown;
};

function revalidationSecret() {
  return process.env.REVALIDATE_SECRET || process.env.JWT_SECRET;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/u);

  if (scheme?.toLowerCase() === "bearer" && token) {
    return token;
  }

  return request.headers.get("x-revalidate-secret") ?? "";
}

function normalizeSlug(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const slug = value.trim().replace(/^\/+|\/+$/gu, "");

  return /^[a-z0-9-]+$/u.test(slug) ? slug : null;
}

function payloadSlugs(payload: RevalidatePayload) {
  const rawSlugs = Array.isArray(payload.slugs) ? payload.slugs : [payload.slug];
  const slugs = rawSlugs.map(normalizeSlug).filter((slug): slug is string => Boolean(slug));

  return [...new Set(slugs)];
}

function revalidateSharedPaths() {
  revalidatePath("/");
  revalidatePath("/blog");
  revalidatePath("/blog/page/[page]", "page");
  revalidatePath("/blog/category/[category]", "page");
  revalidatePath("/blog/category/[category]/page/[page]", "page");

  for (const categoryPath of CATEGORY_PATHS) {
    revalidatePath(categoryPath);
  }
}

export async function POST(request: Request) {
  const secret = revalidationSecret();

  if (!secret) {
    return NextResponse.json({ message: "Revalidation is not configured." }, { status: 503 });
  }

  if (bearerToken(request) !== secret) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let payload: RevalidatePayload;

  try {
    payload = (await request.json()) as RevalidatePayload;
  } catch {
    return NextResponse.json({ message: "Invalid JSON payload." }, { status: 400 });
  }

  const slugs = payloadSlugs(payload);

  revalidateSharedPaths();
  revalidatePath("/blog/[slug]", "page");

  for (const slug of slugs) {
    revalidatePath(`/blog/${slug}`);
  }

  return NextResponse.json({
    ok: true,
    revalidated: {
      listings: true,
      slugs,
    },
  });
}
