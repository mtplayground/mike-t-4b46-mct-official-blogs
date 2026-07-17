# myClawTeam Official Blogs

Rust Axum and server-rendered HTML foundation for the myClawTeam official blog, with static Tailwind CSS assets.

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

- `npm run dev` starts the Rust Axum server on `${PORT:-8080}`.
- `npm run build` builds the static Tailwind CSS bundle and the Rust backend release binary.
- `npm run build:backend` compiles the Rust backend release binary.
- `npm run start` runs the compiled Rust backend directly on `${PORT:-8080}`.
- `npm run test` verifies the Next.js runtime has been removed.
- `npm run backend:test` runs the Rust backend unit test suite.
- `npm run test:all` runs both TypeScript and Rust unit tests.
- `npm run e2e` runs the Playwright publish-to-public-view browser flow.
- `npm run env:check` validates required runtime environment variables.
- `npm run format` checks formatting with Prettier.

## Runtime States

Axum serves public routes, admin routes, static assets, and not-found/error responses directly. Public readers get links back to the blog/home pages, while server-side admin errors log the underlying exception and return coherent HTML responses.

## Styling

Tailwind CSS is configured with editorial design tokens for cream/white section bands, the
`#E8472B` red accent, dark feature-card surfaces, heading/body type scales, and rounded red button
components.

The Rust templates under `rust-backend/templates/` render the shared header, footer, article cards, admin forms, and newsletter signup.

## Database

The Rust backend uses SQLx with PostgreSQL through `DATABASE_URL`. Export the provided
connection string before running backend commands that touch persistent state.

```bash
export DATABASE_URL=$(cat /workspace/.database_url)
npm run backend:test
```

Schema migrations remain in `prisma/migrations` as the committed migration source for the
existing PostgreSQL schema, but runtime app code no longer uses Prisma or the Prisma client.

## Object Storage

The Rust backend uses the pre-provisioned S3-compatible object storage bucket through the
`OBJECT_STORAGE_*` environment variables. Uploaded post images are stored under the required
tenant prefix plus `post-images/<year>/<month>/...`; database records keep the returned relative
object key. Every S3 put/get/delete operation prepends `OBJECT_STORAGE_PREFIX`, and public image
reads go through `/api/image/*key` so the backend can issue short-lived private-bucket signed URLs.

## Environment

Required runtime env vars are documented in `.env.example` and validated by
`scripts/check-env.ts` for deployment-time configuration. The Rust backend also validates
`SELF_URL`, `DATABASE_URL`, admin credentials (or `JWT_SECRET` fallback), and all
`OBJECT_STORAGE_*` settings at startup.

## Bare Self-Hosted Deployment

This app runs as a single Rust Axum process. Axum serves HTML pages, admin form flows, API endpoints, and `/assets/*` static files directly.

Prerequisites:

- Node.js `>=20.9.0`
- Rust toolchain available on `PATH`
- PostgreSQL reachable through `DATABASE_URL`
- An S3-compatible private bucket with the `OBJECT_STORAGE_*` variables from `.env.example`
- A public canonical URL in `SELF_URL`

Deployment steps:

```bash
npm ci
npm run env:check
npm run build

PORT=8080 ./rust-backend/target/release/mct-official-blogs-backend
```

The Rust backend binds `0.0.0.0:${PORT:-8080}`. Put a TLS-terminating reverse proxy in front of the process, preserve the original public host/proto headers, and point `SELF_URL` at the externally reachable origin.

For uploads, keep storing only relative object keys in PostgreSQL. The Rust storage layer prepends
`OBJECT_STORAGE_PREFIX` for every S3 operation and signs private read URLs through the image proxy.
