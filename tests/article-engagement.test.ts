import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Post model includes a defaulted views counter", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");

  assert.match(schema, /model Post \{[\s\S]*\n\s+views\s+Int\s+@default\(0\)/);
});

test("article page renders ArticleEngagement with the canonical article URL", async () => {
  const source = await readFile("app/(public)/blog/[slug]/page.tsx", "utf8");

  assert.match(
    source,
    /import \{ ArticleEngagement \} from "@\/components\/blog\/article-engagement";/,
  );
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

test("article page renders the per-post company card", async () => {
  const source = await readFile("app/(public)/blog/[slug]/page.tsx", "utf8");

  assert.match(source, /function CompanyCard/);
  assert.match(source, /<LinkifiedText text=\{companyIntro\} \/>/);
  assert.match(source, /name=\{post\.companyName\}/);
  assert.match(source, /intro=\{post\.companyIntro\}/);
  assert.match(source, /logoUrl=\{post\.companyLogoUrl\}/);
  assert.match(source, /websiteUrl=\{post\.companyWebsiteUrl\}/);
  assert.doesNotMatch(source, /function MyClawTeamCard/);
});

test("Rust public post type includes company card fields", async () => {
  const source = await readFile("lib/api/rust-blog.ts", "utf8");

  assert.match(source, /companyName\?: string \| null;/);
  assert.match(source, /companyIntro\?: string \| null;/);
  assert.match(source, /companyLogoKey\?: string \| null;/);
  assert.match(source, /companyLogoUrl\?: string \| null;/);
  assert.match(source, /companyWebsiteUrl\?: string \| null;/);
  assert.match(source, /companyName: string;/);
  assert.match(source, /companyIntro: string;/);
  assert.match(source, /companyLogoKey: string \| null;/);
  assert.match(source, /companyLogoUrl: string;/);
  assert.match(source, /companyWebsiteUrl: string;/);
  assert.match(source, /companyName: post\.companyName \?\? DEFAULT_COMPANY_NAME/);
});
