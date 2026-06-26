import { expect, test } from "@playwright/test";
import { CategorySlug, PostStatus } from "@prisma/client";

import { prisma } from "../lib/db/prisma";
import { deletePostImage } from "../lib/storage/object-storage";

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

test.beforeAll(async () => {
  await prisma.category.upsert({
    create: {
      description: "Perspective on AI engineering and product craft.",
      name: "Thoughts",
      slug: CategorySlug.THOUGHTS,
    },
    update: {
      name: "Thoughts",
    },
    where: {
      slug: CategorySlug.THOUGHTS,
    },
  });

  await Promise.all([
    prisma.post.deleteMany({
      where: {
        slug,
      },
    }),
    prisma.subscriber.deleteMany({
      where: {
        email: subscriberEmail,
      },
    }),
  ]);
});

test.afterAll(async () => {
  const post = await prisma.post.findUnique({
    select: {
      authorAvatarKey: true,
      coverImageKey: true,
      squareCoverImageKey: true,
    },
    where: {
      slug,
    },
  });

  await Promise.allSettled([
    ...(post?.coverImageKey ? [deletePostImage(post.coverImageKey)] : []),
    ...(post?.squareCoverImageKey ? [deletePostImage(post.squareCoverImageKey)] : []),
    ...(post?.authorAvatarKey ? [deletePostImage(post.authorAvatarKey)] : []),
    prisma.post.deleteMany({
      where: {
        slug,
      },
    }),
    prisma.subscriber.deleteMany({
      where: {
        email: subscriberEmail,
      },
    }),
  ]);
  await prisma.$disconnect();
});

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
  await page.getByLabel("Category").selectOption({ label: "Thoughts" });
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

  await expect
    .poll(async () => {
      return prisma.post.findUnique({
        select: {
          authorAvatarKey: true,
          authorIntro: true,
          authorName: true,
          coverImageKey: true,
          isFeatured: true,
          publishedAt: true,
          squareCoverImageKey: true,
          status: true,
        },
        where: {
          slug,
        },
      });
    })
    .toMatchObject({
      authorIntro,
      authorName,
      coverImageKey: expect.any(String),
      isFeatured: true,
      squareCoverImageKey: expect.any(String),
      status: PostStatus.PUBLISHED,
    });

  await page.goto("/");
  await expect(page.getByText("Featured Article", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: title }).first()).toBeVisible();

  const articleGrid = page.locator("#articles");
  const publishedArticle = articleGrid.locator("article").filter({ hasText: title });

  await expect(publishedArticle.getByRole("heading", { name: title })).toBeVisible();
  await expect(publishedArticle.getByText(excerpt)).toBeVisible();

  await page.goto("/blog");
  await expect(page).toHaveURL(/\/$/);

  await page.goto(`/blog/${slug}`);
  await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
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

  await expect
    .poll(async () => {
      return prisma.subscriber.findUnique({
        select: {
          email: true,
        },
        where: {
          email: subscriberEmail,
        },
      });
    })
    .toEqual({
      email: subscriberEmail,
    });
});
