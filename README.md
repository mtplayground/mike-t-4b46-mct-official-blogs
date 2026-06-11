# myClawTeam Official Blogs

Next.js App Router and TypeScript foundation for the myClawTeam official blog.

## Development

```bash
npm install
npm run dev
```

The development server listens on `0.0.0.0:8080`.

Copy `.env.example` to a local env file and replace example values before running commands that
touch the database, admin area, or object storage.

Before starting a server, validate the runtime environment:

```bash
set -a
. ./.env.production
set +a
npm run env:check
```

## Scripts

- `npm run dev` starts the local Next.js server.
- `npm run build` creates a production build.
- `npm run start` serves the production build on `${PORT:-8080}`.
- `npm run lint` runs ESLint.
- `npm run test` runs unit tests for auth, content, and newsletter logic.
- `npm run e2e` runs the Playwright publish-to-public-view browser flow.
- `npm run env:check` validates required runtime environment variables.
- `npm run format` checks formatting with Prettier.
- `npm run db:generate` generates the Prisma client.
- `npm run db:migrate` creates and applies local Prisma migrations.
- `npm run db:migrate:deploy` applies committed migrations in deployed environments.
- `npm run db:seed` runs the Prisma seed workflow.

## Runtime States

The App Router includes loading, error, and not-found boundaries for public routes, admin routes,
and unknown root paths. Public readers get links back to the blog/home pages, while admin errors
log the underlying exception and offer a retry action.

## Styling

Tailwind CSS is configured with editorial design tokens for cream/white section bands, the
`#E8472B` red accent, dark feature-card surfaces, heading/body type scales, and rounded red button
components.

The public route group uses shared header and footer components from `components/layout`.

## Database

Prisma is configured for PostgreSQL through `DATABASE_URL`. The CLI workflow is defined in
`prisma.config.ts`, and the app creates a shared Prisma Client from `lib/db/prisma.ts`. Export the
provided connection string before running database commands.

```bash
export DATABASE_URL=$(cat /workspace/.database_url)
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

## Object Storage

Image upload helpers use the pre-provisioned S3-compatible object storage bucket through the
`OBJECT_STORAGE_*` environment variables. Uploaded post images are stored under the required tenant
prefix plus `post-images/<year>/<month>/...`; database records should keep the returned relative
object key and call the signed URL helper when rendering private bucket assets.

## Environment

Required server env vars are documented in `.env.example` and validated by `lib/env/server.ts`:
`SELF_URL`, `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and the
`OBJECT_STORAGE_*` settings used by the storage client.

## Bare Self-Hosted Deployment

This app can run as a plain Node.js process behind any reverse proxy or process manager.

Prerequisites:

- Node.js `>=20.9.0`
- PostgreSQL reachable through `DATABASE_URL`
- An S3-compatible private bucket with the `OBJECT_STORAGE_*` variables from `.env.example`
- A public canonical URL in `SELF_URL`

Deployment steps:

```bash
npm ci
npm run db:migrate:deploy
npm run env:check
npm run build
PORT=8080 npm run start
```

The production server binds `0.0.0.0` and uses `${PORT:-8080}`. Put a TLS-terminating reverse
proxy in front of it, forward the original `Host` and `X-Forwarded-Proto` headers, and point
`SELF_URL` at the externally reachable origin. Run `npm run db:seed` once if the database does not
already contain the starter categories and sample posts.

For uploads, keep storing only relative object keys in PostgreSQL. The storage helper prepends
`OBJECT_STORAGE_PREFIX` for every S3 operation and signs private read URLs at render time.
