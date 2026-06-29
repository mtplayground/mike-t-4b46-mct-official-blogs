import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const title = `E2E Published Post ${uniqueId}`;
const slug = `e2e-published-post-${uniqueId}`;
const excerpt = "A browser-created post that proves the admin publishing flow reaches readers.";
const body = [
  "This post was created through the admin UI by the end-to-end test.",
  "It should appear in the homepage hero, card grid, and individual public page.",
].join("\n\n");
const authorName = "myClawTeam E2E Author";
const authorIntro = "An end-to-end test author profile used to verify the article detail block.";
const subscriberEmail = `e2e-${uniqueId}@example.com`;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

async function expectPublicPostVisible(page: Page) {
  await expect(async () => {
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test("admin publishes a post that drives the homepage, detail page, and newsletter flow", async ({
  page,
}, testInfo) => {
  const adminCredentials = testInfo.config.metadata as {
    adminPassword?: string;
    adminUsername?: string;
  };

  if (!adminCredentials.adminUsername || !adminCredentials.adminPassword) {
    throw new Error("E2E admin credentials are not configured.");
  }

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.getByLabel("Username").fill(adminCredentials.adminUsername);
  await page.getByLabel("Password").fill(adminCredentials.adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Post dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "New post" }).click();
  await expect(page.getByRole("heading", { name: "Create post" })).toBeVisible();

  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Slug").fill(slug);
  await page.getByLabel("Excerpt").fill(excerpt);
  await page.getByLabel("Category").selectOption({ index: 0 });
  await page.getByLabel("Published").check();
  await page.getByLabel("Featured article").check();
  await page.getByLabel("Cover image, 16:9").setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: "cover.png",
  });
  await page.getByLabel("Square cover image, 1:1").setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: "square-cover.png",
  });
  await page.getByLabel("Author name").fill(authorName);
  await page.getByLabel("Author intro").fill(authorIntro);
  await page.getByLabel("Author avatar").setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: "avatar.png",
  });
  await page.getByLabel("Markdown body").fill(body);
  await page.getByRole("button", { name: "Create post" }).click();

  await expect(page).toHaveURL(/\/admin\?notice=/);
  await expect(page.getByText(`"${title}" was created.`)).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Featured Article", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();

  const articleGrid = page.locator("#articles");
  const publishedArticle = articleGrid.locator("article").filter({ hasText: title });

  await expect(publishedArticle.getByRole("heading", { name: title })).toBeVisible();
  await expect(publishedArticle.getByText(excerpt)).toBeVisible();

  await page.goto("/blog");
  await expect(page).toHaveURL(/\/$/);

  await expectPublicPostVisible(page);
  await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
  await expect(page.getByText(body.split("\n\n")[0])).toBeVisible();
  await expect(page.getByText(body.split("\n\n")[1])).toBeVisible();
  await expect(page.getByText("Written by")).toBeVisible();
  await expect(page.getByRole("heading", { name: authorName })).toBeVisible();
  await expect(page.getByText(authorIntro)).toBeVisible();
  await expect(page.locator('img[src*="editorial-hero.png"]')).toHaveCount(0);

  await page.goto("/");
  await page.locator("#footer-email").fill(subscriberEmail);
  await page.getByRole("button", { name: "Join newsletter" }).click();
  await expect(page.getByText("You are on the list.")).toBeVisible();
});
