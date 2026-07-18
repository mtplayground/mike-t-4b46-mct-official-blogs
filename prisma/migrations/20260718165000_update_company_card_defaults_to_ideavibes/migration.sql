UPDATE "posts"
SET "company_name" = 'Ideavibes'
WHERE "company_name" = 'myClawTeam';

UPDATE "posts"
SET "company_website_url" = 'https://ideavibes.ai'
WHERE "company_website_url" = 'https://myclawteam.ai';

ALTER TABLE "posts"
    ALTER COLUMN "company_name" SET DEFAULT 'Ideavibes',
    ALTER COLUMN "company_website_url" SET DEFAULT 'https://ideavibes.ai';
