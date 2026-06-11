# myClawTeam Official Blogs

Next.js App Router and TypeScript foundation for the myClawTeam official blog.

## Development

```bash
npm install
npm run dev
```

The development server listens on `0.0.0.0:8080`.

## Scripts

- `npm run dev` starts the local Next.js server.
- `npm run build` creates a production build.
- `npm run start` serves the production build on `${PORT:-8080}`.
- `npm run lint` runs ESLint.
- `npm run format` checks formatting with Prettier.
- `npm run db:generate` generates the Prisma client.
- `npm run db:migrate` creates and applies local Prisma migrations.
- `npm run db:migrate:deploy` applies committed migrations in deployed environments.
- `npm run db:seed` runs the Prisma seed workflow.

## Styling

Tailwind CSS is configured with editorial design tokens for cream/white section bands, the
`#E8472B` red accent, dark feature-card surfaces, heading/body type scales, and rounded red button
components.

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
