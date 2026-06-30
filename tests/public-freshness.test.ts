import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public blog pages render dynamically without ISR", async () => {
  const [homeSource, articleSource] = await Promise.all([
    readFile("app/(public)/page.tsx", "utf8"),
    readFile("app/(public)/blog/[slug]/page.tsx", "utf8"),
  ]);

  for (const source of [homeSource, articleSource]) {
    assert.match(source, /export const dynamic = "force-dynamic";/);
    assert.doesNotMatch(source, /export const revalidate = 300;/);
  }
  assert.doesNotMatch(articleSource, /generateStaticParams/);
});

test("Rust public API fetches bypass the Next data cache", async () => {
  const source = await readFile("lib/api/rust-blog.ts", "utf8");

  assert.match(source, /cache: "no-store"/);
  assert.doesNotMatch(source, /next:\s*\{\s*revalidate:/s);
  assert.doesNotMatch(source, /RUST_API_REVALIDATE_SECONDS/);
});
