import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const title = `E2E Published Post ${uniqueId}`;
const slug = `e2e-published-post-${uniqueId}`;
const excerpt =
  "A browser-created post that proves the Axum admin publishing flow reaches readers.";
const body = [
  "This post was created through the server-rendered admin UI by the end-to-end test.",
  "It should appear in the homepage, card grid, and individual public page without Next.js.",
].join("\n\n");
const authorName = "myClawTeam E2E Author";
const authorIntro = "An end-to-end test author profile used to verify the article detail block.";
const companyIntro = "A company profile used by the Axum HTML publishing flow.";
const subscriberEmail = `e2e-${uniqueId}@example.com`;
const tinyPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

test("Axum HTML shell loads and default admin credentials are rejected", async ({ page }) => {
  await page.goto("/admin/login");
  await expect(page.locator('link[rel="stylesheet"][href="/assets/app.css"]')).toHaveCount(1);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Username").fill("admin");
  await page.getByLabel("Password").fill("change-me");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/login\?error=invalid/);
  await expect(page.getByText("Invalid admin credentials.")).toBeVisible();
});

async function expectPublicPostVisible(page: Page) {
  await expect(async () => {
    await page.goto(`/blog/${slug}`);
    await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test("admin publishes a post that drives Axum HTML homepage, detail page, and newsletter flow", async ({
  page,
}, testInfo) => {
  const adminCredentials = testInfo.config.metadata as {
    adminPassword?: string;
    adminUsername?: string;
    objectStorageConfigured?: boolean;
    uploadE2eEnabled?: boolean;
  };

  test.skip(
    !adminCredentials.uploadE2eEnabled,
    "set RUN_UPLOAD_E2E=1 with real database and object storage env to run upload-backed publish E2E",
  );

  if (!adminCredentials.adminUsername || !adminCredentials.adminPassword) {
    throw new Error("E2E admin credentials are not configured.");
  }

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);

  await page.getByLabel("Username").fill(adminCredentials.adminUsername);
  await page.getByLabel("Password").fill(adminCredentials.adminPassword);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/admin(?:\?|$)/);
  await expect(page.getByRole("heading", { name: "Posts" })).toBeVisible();

  await page.getByRole("link", { name: "New post" }).click();
  await expect(page.getByRole("heading", { name: "New post" })).toBeVisible();

  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Excerpt").fill(excerpt);
  await page.getByLabel("Markdown body").fill(body);
  await page.getByLabel("Category").selectOption({ index: 0 });
  await page.getByLabel("Featured post").check();
  await page.getByLabel("Status").selectOption("PUBLISHED");
  await page.locator('input[name="coverImage"]').setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: "cover.png",
  });
  await page.locator('input[name="squareCoverImage"]').setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: "square-cover.png",
  });
  await page.getByLabel("Author name").fill(authorName);
  await page.getByLabel("Author intro").fill(authorIntro);
  await page.locator('input[name="authorAvatar"]').setInputFiles({
    buffer: tinyPng,
    mimeType: "image/png",
    name: "avatar.png",
  });
  await page.getByLabel("Company name").fill("myClawTeam");
  await page.getByLabel("Company intro").fill(companyIntro);
  await page.getByLabel("Company website URL").fill("https://myclawteam.ai");
  await page.getByRole("button", { name: "Create post" }).click();

  await expect(page).toHaveURL(/\/admin\?notice=/);
  await expect(page.getByText(`"${title}" was created.`)).toBeVisible();

  await page.goto("/");
  await expect(page.getByText("Featured", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();
  await expect(page.getByText(excerpt).first()).toBeVisible();

  await page.goto("/blog");
  await expect(page).toHaveURL(/\/$/);

  await expectPublicPostVisible(page);
  await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
  await expect(page.getByText(body.split("\n\n")[0])).toBeVisible();
  await expect(page.getByText(body.split("\n\n")[1])).toBeVisible();
  await expect(page.getByText("Author", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: authorName })).toBeVisible();
  await expect(page.getByText(authorIntro)).toBeVisible();
  await expect(page.getByText("Company", { exact: true })).toBeVisible();
  await expect(page.getByText(companyIntro)).toBeVisible();

  await page.goto("/");
  await page.getByLabel("Stay in the loop").fill(subscriberEmail);
  await page.getByRole("button", { name: "Join newsletter" }).click();
  await expect(page).toHaveURL(/\/?newsletter=subscribed$/);
  await expect(page.getByText("You are on the list.")).toBeVisible();
});
