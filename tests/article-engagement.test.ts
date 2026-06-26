import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Post model includes a defaulted views counter", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");

  assert.match(schema, /model Post \{[\s\S]*\n\s+views\s+Int\s+@default\(0\)/);
});

test("article page renders ArticleEngagement with the canonical article URL", async () => {
  const source = await readFile("app/(public)/blog/[slug]/page.tsx", "utf8");

  assert.match(source, /import \{ ArticleEngagement \} from "@\/components\/blog\/article-engagement";/);
  assert.match(source, /const canonicalUrl = absoluteSiteUrl\(`\/blog\/\$\{post\.slug\}`\);/);
  assert.match(
    source,
    /<ArticleEngagement\s+slug=\{post\.slug\}\s+title=\{post\.title\}\s+url=\{canonicalUrl\}\s+\/>/,
  );
});

test("article engagement includes expected social share URLs", async () => {
  const source = await readFile("components/blog/article-engagement.tsx", "utf8");

  assert.match(source, /https:\/\/twitter\.com\/intent\/tweet\?url=/);
  assert.match(source, /https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/);
  assert.match(source, /https:\/\/www\.facebook\.com\/sharer\/sharer\.php\?u=/);
});
