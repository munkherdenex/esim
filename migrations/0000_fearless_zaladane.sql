CREATE TYPE "public"."order_status" AS ENUM('PENDING_PAYMENT', 'PAID', 'PROVISIONING', 'DELIVERED', 'FAILED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"access_token_hash" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"package_id" uuid NOT NULL,
	"price_mnt" integer NOT NULL,
	"status" "order_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"qpay_invoice_id" text,
	"qpay_payment_id" text,
	"provider_order_no" text,
	"provider_transaction_id" text NOT NULL,
	"iccid" text,
	"lpa_activation_code" text,
	"qr_url" text,
	"error_message" text,
	"expires_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_package_code" text NOT NULL,
	"country_code" text NOT NULL,
	"country_name_mn" text NOT NULL,
	"data_gb" integer NOT NULL,
	"validity_days" integer NOT NULL,
	"cost_usd_cents" integer NOT NULL,
	"price_mnt" integer NOT NULL,
	"supports_china_social_apps" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"public_code" text NOT NULL,
	"access_token_hash" text NOT NULL,
	"iccid" text NOT NULL,
	"package_id" uuid NOT NULL,
	"price_mnt" integer NOT NULL,
	"status" "order_status" DEFAULT 'PENDING_PAYMENT' NOT NULL,
	"qpay_invoice_id" text,
	"qpay_payment_id" text,
	"provider_transaction_id" text NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topups" ADD CONSTRAINT "topups_package_id_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_events_order_created_at_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_public_code_uq" ON "orders" USING btree ("public_code");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_provider_transaction_id_uq" ON "orders" USING btree ("provider_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_qpay_invoice_id_uq" ON "orders" USING btree ("qpay_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_qpay_payment_id_uq" ON "orders" USING btree ("qpay_payment_id");--> statement-breakpoint
CREATE INDEX "orders_status_created_at_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "packages_provider_code_uq" ON "packages" USING btree ("provider_package_code");--> statement-breakpoint
CREATE UNIQUE INDEX "topups_public_code_uq" ON "topups" USING btree ("public_code");--> statement-breakpoint
CREATE UNIQUE INDEX "topups_provider_transaction_id_uq" ON "topups" USING btree ("provider_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topups_qpay_invoice_id_uq" ON "topups" USING btree ("qpay_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "topups_qpay_payment_id_uq" ON "topups" USING btree ("qpay_payment_id");--> statement-breakpoint
CREATE INDEX "topups_status_created_at_idx" ON "topups" USING btree ("status","created_at");