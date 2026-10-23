ALTER TABLE "packages" RENAME COLUMN "cost_usd_cents" TO "cost_usd";
--> statement-breakpoint
ALTER TABLE "packages" ALTER COLUMN "cost_usd" TYPE numeric(12, 4) USING ("cost_usd"::numeric / 100);
--> statement-breakpoint
ALTER TABLE "packages" ALTER COLUMN "data_gb" TYPE numeric(12, 3) USING ("data_gb"::numeric);
--> statement-breakpoint
ALTER TABLE "packages" ALTER COLUMN "country_name_mn" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "provider_name" text;
--> statement-breakpoint
UPDATE "packages" SET "provider_name" = "provider_package_code";
--> statement-breakpoint
ALTER TABLE "packages" ALTER COLUMN "provider_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "packages" ADD COLUMN "price_overridden" boolean DEFAULT false NOT NULL;