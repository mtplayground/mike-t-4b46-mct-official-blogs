import assert from "node:assert/strict";
import test from "node:test";

import { CategorySlug, PostStatus } from "@prisma/client";

import { isPublishedPostVisible, publishedPostWhere } from "../lib/content/posts";

test("isPublishedPostVisible only exposes published posts with a publish date", () => {
  const publishedAt = new Date("2026-01-15T12:00:00.000Z");

  assert.equal(isPublishedPostVisible({ publishedAt, status: PostStatus.PUBLISHED }), true);
  assert.equal(isPublishedPostVisible({ publishedAt: null, status: PostStatus.PUBLISHED }), false);
  assert.equal(isPublishedPostVisible({ publishedAt, status: PostStatus.DRAFT }), false);
  assert.equal(isPublishedPostVisible({ publishedAt: null, status: PostStatus.DRAFT }), false);
});

test("publishedPostWhere scopes list queries to published posts and optional category", () => {
  assert.deepEqual(publishedPostWhere(), {
    publishedAt: {
      not: null,
    },
    status: PostStatus.PUBLISHED,
  });

  assert.deepEqual(publishedPostWhere(CategorySlug.THOUGHTS), {
    category: {
      slug: CategorySlug.THOUGHTS,
    },
    publishedAt: {
      not: null,
    },
    status: PostStatus.PUBLISHED,
  });
});
