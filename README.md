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
- `npm run build` creates both production artifacts: the Next.js frontend and the Rust backend release binary.
- `npm run build:frontend` creates only the Next.js production build.
- `npm run build:backend` compiles the Rust backend release binary.
- `npm run start` serves the production Next.js build on `${PORT:-8080}`.
- `npm run lint` runs ESLint.
- `npm run test` runs TypeScript unit tests for content and frontend helpers.
- `npm run backend:test` runs the Rust backend unit test suite.
- `npm run test:all` runs both TypeScript and Rust unit tests.
- `npm run e2e` runs the Playwright publish-to-public-view browser flow.
- `npm run env:check` validates required runtime environment variables.
- `npm run format` checks formatting with Prettier.

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

Use `RUST_API_BASE_URL` for Next.js server-side calls when the Rust backend is not reachable at
the same public origin, for example `http://127.0.0.1:8081` behind a local process manager.

## Bare Self-Hosted Deployment

This app runs as two processes behind a reverse proxy or process manager: the Next.js frontend and
the Rust Axum API backend. Route `/api/*` traffic to the Rust backend and all other traffic to
Next.js.

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

# Terminal/process 1: Rust API backend
PORT=8081 ./rust-backend/target/release/mct-official-blogs-backend

# Terminal/process 2: Next.js frontend
RUST_API_BASE_URL=http://127.0.0.1:8081 PORT=8080 npm run start
```

The Next.js server binds `0.0.0.0` and uses `${PORT:-8080}`. The Rust backend also binds
`0.0.0.0:${PORT:-8080}`, so set a distinct port when both processes run on one host. Put a
TLS-terminating reverse proxy in front of both processes, preserve the original public host/proto
headers, route `/api/*` to Rust, and point `SELF_URL` at the externally reachable origin.

For uploads, keep storing only relative object keys in PostgreSQL. The Rust storage layer prepends
`OBJECT_STORAGE_PREFIX` for every S3 operation and signs private read URLs through the image proxy.
