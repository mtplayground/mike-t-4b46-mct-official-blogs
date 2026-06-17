ALTER TABLE "posts"
    ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "author_name" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "author_intro" VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN "author_avatar_key" TEXT;
