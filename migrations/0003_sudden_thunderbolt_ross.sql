ALTER TABLE "orders" ADD COLUMN "access_token_encrypted" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivery_email_completed_at" timestamp with time zone;