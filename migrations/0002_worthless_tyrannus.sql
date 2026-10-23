CREATE TABLE "api_rate_limits" (
	"key_hash" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "checkout_idempotency_key_hash" text;--> statement-breakpoint
UPDATE "orders" SET "checkout_idempotency_key_hash" = md5("id"::text) WHERE "checkout_idempotency_key_hash" IS NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "checkout_idempotency_key_hash" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "qpay_qr_text" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "qpay_qr_image" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "qpay_short_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "qpay_urls" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "qpay_invoice_attempted_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "orders_checkout_idempotency_key_uq" ON "orders" USING btree ("checkout_idempotency_key_hash");