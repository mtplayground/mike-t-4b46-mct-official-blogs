ALTER TABLE "posts"
    ADD COLUMN "company_name" TEXT NOT NULL DEFAULT 'myClawTeam',
    ADD COLUMN "company_intro" VARCHAR(500) NOT NULL DEFAULT '',
    ADD COLUMN "company_logo_key" TEXT,
    ADD COLUMN "company_website_url" TEXT NOT NULL DEFAULT 'https://myclawteam.ai';
