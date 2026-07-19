# Ideavibes

Ideavibes is a production-ready editorial publishing app for official updates, product progress, announcements, and engineering notes.

## What It Does

- Public homepage is the primary reading surface: it uses Ideavibes branding, shows the latest featured published article as a hero, falls back to the latest published article, and renders a responsive article card grid linking to `/blog/[slug]` detail pages.
- The homepage hero CTA is labeled `Read article`; the former secondary `Browse articles` CTA has been removed.
- Legacy blog index, pagination, and category listing routes redirect to `/`; individual article routes at `/blog/[slug]` remain public.
- Article detail pages render the post category/date/title/excerpt, optional signed cover image, GitHub-flavored Markdown body content with themed typography/components, signed `storage:` inline images, and an author block with signed avatar, name, and intro.
- Article company cards default to the Ideavibes name, website, and hosted logo URL when legacy posts have no company-card values.
- Newsletter signup in the footer includes client validation, duplicate handling, and PostgreSQL persistence.
- Public header and footer use the hosted Ideavibes logo image from `https://ideavibes.ai/logo.png`.
- Public header/footer navigation includes Home and Admin entry points; the Admin link goes directly to the login screen so anonymous readers see a coherent auth page instead of a protected-route transition.
- Footer category labels are clickable links: Thoughts → `/blog/category/thoughts`, Product Progress → `/blog/category/product-progress`, and Announcements → `/blog/category/announcements`.
- Admin area is protected by configured admin credentials and a signed HTTP-only cookie session; `ADMIN_USERNAME`/`ADMIN_PASSWORD` are used when provided together, otherwise credentials are deterministically derived from `JWT_SECRET`. Login trims surrounding whitespace before constant-time comparison, and production admin auth redirects use `SELF_URL` as the canonical HTTPS origin.
- Admin dashboard lists draft and published posts, supports publish/unpublish/delete actions, and links to subscriber management.
- Admin create/edit form supports title, slug, excerpt, category, featured flag, draft/publish status, cover image, author name/intro/avatar, Markdown body, and inline image uploads.
- Published posts must have cover image and author fields; drafts may leave those incomplete. Multiple posts may be featured at once.
- Browser favicon, static assets, and committed public images are served by Axum from the committed public asset tree.
- Sitemap includes the homepage and published article detail URLs only, plus robots.txt and server-rendered not-found responses.

## Architecture

- Rust Axum, Askama templates, SQLx, PostgreSQL, and static Tailwind CSS; Axum serves public pages, admin forms, sitemap, robots.txt, assets, and images directly.
- PostgreSQL is the only persistent database; schema migrations remain committed under `prisma/migrations`.
- Private S3-compatible object storage via the vendor-neutral `OBJECT_STORAGE_*` env vars.
- Uploaded cover, avatar, and inline post images are stored as relative object keys in PostgreSQL; S3 keys are always prefixed with `OBJECT_STORAGE_PREFIX`, and browser image URLs are generated with signed GET URLs at render time. Markdown bodies keep `![alt](storage:key)` references in storage and rewrite them to signed URLs server-side before rendering.
- Public pages are rendered server-side by Rust on each request; admin and API routes are handled by the same Axum server.
- Runtime env validation is centralized in the Rust backend, with a small Node `npm run env:check` helper for deployment sanity checks.

## Key Conventions

- Product branding is `Ideavibes`.
- Runtime server defaults bind to `0.0.0.0:8080`; production start uses `${PORT:-8080}`.
- Required env includes `SELF_URL`, `DATABASE_URL`, `JWT_SECRET`, and all `OBJECT_STORAGE_*` values in `.env.example`; `ADMIN_USERNAME` and `ADMIN_PASSWORD` are optional but must be supplied together if overridden.
- Do not store uploaded files on local disk, in PostgreSQL blobs, or in public bucket URLs.
- Admin auth is a first-party credential flow; keep constant-time credential checks, whitespace-tolerant login comparisons, the `JWT_SECRET` fallback credential derivation, production login/logout redirects from `SELF_URL`, and public Admin navigation pointed at `/admin/login`.
- Database schema, migrations, and seed data live under `prisma/`. Markdown preprocessing lives in `rust-backend/src/html/markdown.rs`; it leaves failed image signatures unchanged rather than breaking the article page.

## Quality Gates

- `npm run test` verifies that the Next.js runtime and React dependencies are absent.
- Rust unit and integration coverage is expected through `npm run backend:test`.
- `npm run build` and `npm run env:check` are expected to pass before deployment.
