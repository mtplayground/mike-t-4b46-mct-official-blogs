# myClawTeam Blog

myClawTeam Blog is a production-ready editorial publishing app for official myClawTeam updates, product progress, announcements, and engineering notes.

## What It Does

- Public homepage is the primary reading surface: it uses `myClawTeam Blog` branding, shows the latest featured published article as a hero, falls back to the latest published article, and renders a responsive article card grid linking to `/blog/[slug]` detail pages.
- The homepage hero CTA is labeled `Read article`; the former secondary `Browse articles` CTA has been removed.
- Legacy blog index, pagination, and category listing routes redirect to `/`; individual article routes at `/blog/[slug]` remain public.
- Article detail pages render the post category/date/title/excerpt, optional signed cover image, GitHub-flavored Markdown body content with themed typography/components, signed `storage:` inline images, and an author block with signed avatar, name, and intro.
- Newsletter signup in the footer includes client validation, duplicate handling, and PostgreSQL persistence.
- Public header and footer use the hosted logo image from `https://myclawteam.ai/logo.png` plus visible `myClawTeam Blog` brand text.
- Public header/footer navigation includes Home and Admin entry points; the Admin link goes directly to the login screen so anonymous readers see a coherent auth page instead of a protected-route transition.
- Footer category labels are clickable links: Thoughts → `/blog/category/thoughts`, Product Progress → `/blog/category/product-progress`, and Announcements → `/blog/category/announcements`.
- Admin area is protected by env-configured username/password and a signed HTTP-only cookie session; login trims surrounding whitespace from submitted and configured credentials before constant-time comparison, and production admin auth redirects use `SELF_URL` as the canonical HTTPS origin.
- Admin dashboard lists draft and published posts, supports publish/unpublish/delete actions, and links to subscriber management.
- Admin create/edit form supports title, slug, excerpt, category, featured flag, draft/publish status, cover image, author name/intro/avatar, Markdown body, and inline image uploads.
- Published posts must have cover image and author fields; drafts may leave those incomplete. Multiple posts may be featured at once.
- Sitemap includes the homepage and published article detail URLs only, plus robots.txt and route loading/error/not-found boundaries.

## Architecture

- Next.js App Router, React, TypeScript, and Tailwind CSS.
- Prisma ORM with PostgreSQL as the only persistent database.
- Private S3-compatible object storage via the vendor-neutral `OBJECT_STORAGE_*` env vars.
- Uploaded cover, avatar, and inline post images are stored as relative object keys in PostgreSQL; S3 keys are always prefixed with `OBJECT_STORAGE_PREFIX`, and browser image URLs are generated with signed GET URLs at render time. Markdown bodies keep `![alt](storage:key)` references in storage and rewrite them to signed URLs server-side before rendering.
- Public pages use ISR where appropriate; admin and API routes are dynamic.
- Runtime env validation is centralized in `lib/env/server.ts` and exposed through `npm run env:check`.

## Key Conventions

- Product branding is `myClawTeam Blog`.
- Runtime server defaults bind to `0.0.0.0:8080`; production start uses `${PORT:-8080}`.
- Required env includes `SELF_URL`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and all `OBJECT_STORAGE_*` values in `.env.example`.
- Do not store uploaded files on local disk, in PostgreSQL blobs, or in public bucket URLs.
- Admin auth is a first-party env-credential flow, not Google OAuth or a custom JWT layer; keep constant-time credential checks and whitespace-tolerant login comparisons, build production login/logout redirects from `SELF_URL`, and keep public Admin navigation pointed at `/admin/login`.
- Database schema, migrations, and seed data live under `prisma/`. Markdown preprocessing lives in `lib/content/markdown.ts`; it leaves failed image signatures unchanged rather than breaking the article page.

## Quality Gates

- `npm run test` covers admin session/origin logic, whitespace-tolerant credential matching, post visibility and published-field requirements, Markdown storage-image preprocessing, and subscriber validation/dedupe.
- `npm run e2e` covers admin login, required publish fields, featured homepage/card flow, `/blog` redirect, article author block, absence of the fixed banner fallback, and newsletter persistence.
- `npm run lint`, `npm run build`, and `npm run env:check` are expected to pass before deployment.
