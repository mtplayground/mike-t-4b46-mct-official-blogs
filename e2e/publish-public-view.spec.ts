import { expect, test } from "@playwright/test";
import { CategorySlug, PostStatus } from "@prisma/client";

import { prisma } from "../lib/db/prisma";

test.describe.configure({ mode: "serial" });

const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const title = `E2E Published Post ${uniqueId}`;
const slug = `e2e-published-post-${uniqueId}`;
const excerpt = "A browser-created post that proves the admin publishing flow reaches readers.";
const body = [
  "This post was created through the admin UI by the end-to-end test.",
  "It should appear on the public listing and its individual public page.",
].join("\n\n");
const subscriberEmail = `e2e-${uniqueId}@example.com`;

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
  await Promise.allSettled([
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

test("admin publishes a post that is visible publicly, and newsletter signup persists", async ({
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
  await page.getByLabel("Markdown body").fill(body);
  await page.getByRole("button", { name: "Create post" }).click();

  await expect(page).toHaveURL(/\/admin\?notice=/);
  await expect(page.getByText(`"${title}" was created.`)).toBeVisible();

  await expect
    .poll(async () => {
      return prisma.post.findUnique({
        select: {
          publishedAt: true,
          status: true,
        },
        where: {
          slug,
        },
      });
    })
    .toMatchObject({
      status: PostStatus.PUBLISHED,
    });

  await page.goto("/blog");
  const publishedArticle = page.locator("article").filter({ hasText: title });

  await expect(publishedArticle.getByRole("heading", { name: title })).toBeVisible();
  await publishedArticle.getByRole("link", { name: "Read post" }).click();

  await expect(page).toHaveURL(new RegExp(`/blog/${slug}$`));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText(body.split("\n\n")[0])).toBeVisible();
  await expect(page.getByText(body.split("\n\n")[1])).toBeVisible();

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
