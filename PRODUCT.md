# myClawTeam Official Blogs

myClawTeam Official Blogs is a production-ready editorial blog for publishing official myClawTeam updates, product progress, announcements, and engineering notes.

## What It Does

- Public home page with editorial styling, recent posts, category signals, and newsletter signup.
- Public blog listing with category filtering, pagination, ISR, and uppercase red category labels.
- Individual post pages with cover image support, rich Markdown-style body rendering, category labels, publish dates, metadata, Open Graph/Twitter tags, and Article JSON-LD.
- Newsletter signup in the footer with client validation, duplicate handling, and PostgreSQL persistence.
- Admin area protected by env-configured username/password and a signed HTTP-only cookie session; production admin auth redirects use `SELF_URL` as the canonical HTTPS origin.
- Admin dashboard for listing draft and published posts, publishing/unpublishing, deleting with confirmation, and viewing subscribers.
- Admin create/edit form for title, slug, excerpt, category, draft/publish status, Markdown body, cover image upload, and inline image upload.
- Sitemap, robots.txt, loading/error/not-found boundaries, and self-hosting documentation.

## Architecture

- Next.js App Router, React, TypeScript, and Tailwind CSS.
- Prisma ORM with PostgreSQL as the only persistent database.
- Private S3-compatible object storage via the vendor-neutral `OBJECT_STORAGE_*` env vars.
- Uploaded post images are stored as relative object keys in PostgreSQL; S3 keys are always prefixed with `OBJECT_STORAGE_PREFIX`, and browser image URLs are generated with signed GET URLs at render time.
- Public pages use ISR where appropriate; admin and API routes are dynamic.
- Runtime env validation is centralized in `lib/env/server.ts` and exposed through `npm run env:check`.

## Key Conventions

- Product branding is `myClawTeam Official Blogs`.
- Runtime server defaults bind to `0.0.0.0:8080`; production start uses `${PORT:-8080}`.
- Required env includes `SELF_URL`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and all `OBJECT_STORAGE_*` values in `.env.example`.
- Do not store uploaded files on local disk, in PostgreSQL blobs, or in public bucket URLs.
- Admin auth is a first-party env-credential flow, not Google OAuth or a custom JWT layer; production login/logout redirects must be built from `SELF_URL`, while local/dev may use request headers.
- Database schema and seed data live under `prisma/`.

## Quality Gates

- `npm run test` covers admin session logic, post visibility rules, and subscriber validation/dedupe.
- `npm run e2e` covers admin login, post publish-to-public-view, and newsletter persistence.
- `npm run lint`, `npm run build`, and `npm run env:check` are expected to pass before deployment.
