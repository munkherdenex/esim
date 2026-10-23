# Holbo

Holbo is a Mongolian-first travel eSIM store. The current foundation includes the Next.js app, PostgreSQL/Drizzle schema,
validated environment, pg-boss worker, eSIM Access package client, pricing
logic, and the Mongolian-first customer catalog. Checkout and fulfillment flows
are added in later phases.

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
registers the scheduled eSIM package sync job.

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

## eSIM Access package sync

The eSIM Access client uses the official
[eSIM Access reseller API documentation](https://docs.esimaccess.com/). It sends
the documented `RT-AccessCode` header to
`POST https://api.esimaccess.com/api/v1/open/package/list` and validates the
provider response with Zod. The client currently implements package listing;
order fulfillment and usage operations will be added in their respective
phases.

The mock provider is selected by default. To use the live provider, set
`ESIM_PROVIDER=esim-access` and supply `ESIM_ACCESS_CODE` in `.env`. There is no
provider sandbox according to the official documentation, so live API calls
can use the prepaid balance.

Package sync calculates MNT prices using the following settings, read from the
`settings` table first and then from the corresponding environment variables:

| Settings key | Environment variable |
| --- | --- |
| `usd_to_mnt` | `USD_TO_MNT_RATE` |
| `default_markup_percent` | `DEFAULT_MARKUP_PERCENT` |
| `rounding_step_mnt` | `ROUNDING_STEP_MNT` |

These values must be configured before running a sync; no exchange rate or
markup is assumed by the app. Run a sync manually with:

```sh
npm run packages:sync
```

The worker also schedules a daily sync at 03:00 UTC. Imported packages stay
inactive until curated. Syncs preserve the active flag, manually assigned
Mongolian country name, and any admin price override; the China social-app flag
also remains opt-in.

The customer catalog is available at `/` with country pages at `/china` and
`/south-korea`. Country pages include Mongolian metadata, and the app exposes a
sitemap and Open Graph image. The catalog displays only active packages from
PostgreSQL. To preview synced packages before the admin panel is available,
activate curated packages manually in the database, for example:

```sql
UPDATE packages SET is_active = true WHERE country_code IN ('CN', 'KR');
```

For China packages, set `supports_china_social_apps` to `true` only for plans
confirmed to support those services. The catalog then shows that capability
only on the matching package card. If no package is active for a destination,
its page shows an availability message instead of fabricated prices.

For pricing logic and provider parsing tests:

```sh
npm test
```

## Validation

```sh
npm run typecheck
npm test
npm run build
```

## Environment

`src/lib/env.ts` validates required runtime configuration. Start from
`.env.example`; eSIM Access credentials are optional when using the default
mock provider. QPay and other integration credentials will be added alongside
their respective providers. No live provider credentials are needed for
development with the mock provider.
