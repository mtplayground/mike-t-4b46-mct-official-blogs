CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TYPE "CategorySlug" AS ENUM ('THOUGHTS', 'PRODUCT_PROGRESS', 'ANNOUNCEMENTS');

CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "slug" "CategorySlug" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" VARCHAR(320) NOT NULL,
    "body" TEXT NOT NULL,
    "cover_image_key" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

CREATE INDEX "posts_category_id_idx" ON "posts"("category_id");

CREATE INDEX "posts_status_published_at_idx" ON "posts"("status", "published_at");

ALTER TABLE "posts"
    ADD CONSTRAINT "posts_category_id_fkey"
    FOREIGN KEY ("category_id")
    REFERENCES "categories"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
