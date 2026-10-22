DROP INDEX "imports_account_hash";--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "adapterId" text DEFAULT 'ing' NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "format" text DEFAULT 'csv' NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "inputCount" integer;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "skippedCount" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "imports_account_source_hash" ON "imports" USING btree ("accountId","adapterId","format","hash");--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "valid_import_counts" CHECK (("imports"."inputCount" is null and "imports"."skippedCount" is null) or ("imports"."inputCount" is not null and "imports"."skippedCount" is not null and "imports"."inputCount" >= 0 and "imports"."skippedCount" >= 0 and "imports"."skippedCount" <= "imports"."inputCount"));