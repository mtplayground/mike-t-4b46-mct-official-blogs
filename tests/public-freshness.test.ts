import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public blog pages use ISR instead of force-dynamic rendering", async () => {
  const [homeSource, articleSource] = await Promise.all([
    readFile("app/(public)/page.tsx", "utf8"),
    readFile("app/(public)/blog/[slug]/page.tsx", "utf8"),
  ]);

  for (const source of [homeSource, articleSource]) {
    assert.doesNotMatch(source, /export const dynamic = "force-dynamic";/);
  }
  assert.match(articleSource, /export async function generateStaticParams\(\)/);
  assert.match(articleSource, /getRustPostList\(\)/);
  assert.match(articleSource, /posts\.map\(\(post\) => \(\{\s*slug: post\.slug,/s);
});

test("Rust public API fetches opt into a five-minute ISR data cache", async () => {
  const source = await readFile("lib/api/rust-blog.ts", "utf8");

  assert.match(source, /const PUBLIC_REVALIDATE_SECONDS = 300;/);
  assert.match(source, /next:\s*\{\s*revalidate: PUBLIC_REVALIDATE_SECONDS\s*\}/s);
  assert.doesNotMatch(source, /cache: "no-store"/);
  assert.doesNotMatch(source, /RUST_API_REVALIDATE_SECONDS/);
});

test("admin CMS fetches remain dynamic and uncached", async () => {
  const source = await readFile("lib/admin/cms-api.ts", "utf8");

  assert.match(source, /cache: "no-store"/);
  assert.doesNotMatch(source, /next:\s*\{\s*revalidate:/s);
});

test("revalidation route supports slugless bulk seed or import refreshes", async () => {
  const source = await readFile("app/api/revalidate/route.ts", "utf8");

  assert.match(source, /revalidateSharedPaths\(\);/);
  assert.match(source, /revalidatePath\("\/blog\/\[slug\]", "page"\)/);
  assert.match(source, /const slugs = payloadSlugs\(payload\);/);
  assert.match(source, /for \(const slug of slugs\)/);
});
