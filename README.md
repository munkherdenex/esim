# Holbo

Holbo is a Mongolian-first travel eSIM store. The current foundation includes the Next.js app, PostgreSQL/Drizzle schema,
validated environment, pg-boss worker, eSIM Access package client, pricing
logic, Mongolian-first customer catalog, and QPay checkout with a local mock
payment flow. eSIM fulfillment is added in a later phase.

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

The app is available at `http://localhost:3000`. The worker starts pg-boss and registers the eSIM package sync, payment
verification, and invoice expiry jobs.

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
[eSIM Access reseller API documentation](https://docs.esimaccess.com/). It
signs each request with the documented `RT-Timestamp`, `RT-RequestID`,
`RT-AccessCode`, and `RT-Signature` headers and validates provider responses
with Zod. It supports package listing and profile fulfillment.

The mock provider is selected by default. To use the live provider, set
`ESIM_PROVIDER=esim-access` and supply both `ESIM_ACCESS_CODE` and
`ESIM_ACCESS_SECRET` in `.env`. There is no provider sandbox according to the
official documentation, so live API calls can use the prepaid balance.

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

## QPay checkout

Checkout is available from each active package card. The local mock provider is
enabled by default; complete a mock payment on the payment page to exercise
invoice creation, callback job handling, and verified payment status without
QPay credentials.

To use QPay sandbox, set `QPAY_PROVIDER=qpay`, `QPAY_ENVIRONMENT=sandbox`,
`QPAY_CLIENT_ID`, `QPAY_CLIENT_SECRET`, and `QPAY_INVOICE_PROFILE_JSON` in
`.env`. Set `APP_URL` to a public HTTPS URL so QPay can reach the callback.
The invoice profile must contain the merchant-specific values and payload data
provided by QPay; do not copy placeholder values from examples.
The integration uses the documented Merchant V2 token, invoice, and payment
check endpoints. Callback notifications enqueue verification, and an order is
marked paid only after the payment check confirms a transaction. QPay instructs
merchants to verify via callback rather than continuously polling payment
status. Configure the merchant's invoice expiry to match the store's 30-minute
checkout window; do not assume a QPay default expiry duration. The public
Merchant V2 docs currently show only an empty `/v2/payment/check` response and
do not document a successful payment row. The client deliberately fails closed
on non-empty rows instead of guessing their status fields, so real QPay payment
verification must not be enabled for sales until that positive response schema
is confirmed and implemented.

## eSIM fulfillment and delivery

After QPay verification moves an order to `PAID`, the worker places the
eSIM Access order using the order's stable `providerTransactionId` as the
documented `transactionId`. It queries allocated profiles by provider
`orderNo`, retries asynchronous allocation with pg-boss backoff, and moves the
order to `FAILED` after the configured retry limit. Orders and webhook-triggered
reconciliation are also swept periodically so queue enqueue failures do not
leave paid orders stranded.

Set `ESIM_WEBHOOK_SECRET` to a random value with at least 32 characters. Set
`APP_URL` to the public host, then register the callback using the signed,
documented eSIM Access `/api/v1/open/webhook/save` API:

```sh
npm run esim:webhook:configure
```

The official eSIM Access docs identify `ORDER_STATUS` notifications but do not
publish their payload schema in the API collection. The webhook therefore
validates JSON and triggers a database reconciliation; it does not trust or
interpret undocumented fields. eSIM Access has no sandbox, so local testing
uses the mock provider and its visibly non-installable test profile.

If you want delivery email, configure `RESEND_API_KEY`,
`RESEND_FROM_EMAIL`, and `ORDER_TOKEN_ENCRYPTION_KEY` in `.env`. Generate the
AES-256 key with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

The order access token is stored encrypted for email-link creation; only its
hash is used for order-page authorization. Email sends use a stable idempotency
key, and failed sends are retried and reconciled. Without Resend configuration,
orders still deliver through the protected order page; the omission is recorded
in the order event log.

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
`.env.example`; eSIM Access and QPay credentials are optional when using their
default mock providers. No live provider credentials are needed for development
with mock payments.
