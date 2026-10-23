# Holbo

Holbo is a Mongolian-first travel eSIM store. This repository currently contains
the Phase 1 foundation: the Next.js app, PostgreSQL/Drizzle schema, validated
environment, and pg-boss worker skeleton. Provider integrations and customer
flows are added in later phases.

## Requirements

- Node.js 22+
- npm
- Docker Compose (for the local PostgreSQL service)

## Local development

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

   ```sh
   docker compose up -d postgres
   ```

3. Install dependencies and apply the schema:

   ```sh
   npm install
   npm run db:migrate
   ```

4. Run the web app and worker in separate terminals:

   ```sh
   npm run dev
   ```

   ```sh
   npm run worker
   ```

The app is available at `http://localhost:3000`. The worker starts pg-boss and
is ready for job handlers to be added in subsequent phases.

To run all three services in containers instead, ensure `.env` exists and run:

```sh
docker compose up
```

Then apply migrations from the host with `npm run db:migrate`. The Compose
services use the `postgres` hostname for their database connection; local
commands use `localhost` as configured in `.env.example`.

## Database

Drizzle schema definitions live in `src/db/schema.ts`. Create a migration after
schema changes with:

```sh
npm run db:generate
```

Apply committed migrations with:

```sh
npm run db:migrate
```

## Validation

```sh
npm run typecheck
npm run build
```

## Environment

`src/lib/env.ts` validates required runtime configuration. Start from
`.env.example`; secrets for eSIM Access, QPay, and other integrations will be
added to the environment schema when those providers are implemented. No live
provider credentials are needed for Phase 1.
