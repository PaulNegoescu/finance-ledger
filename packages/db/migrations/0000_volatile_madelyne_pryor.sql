CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	CONSTRAINT "accounts_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"hash" text NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contains" text NOT NULL,
	"categoryId" uuid NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accountId" uuid NOT NULL,
	"importId" uuid NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amountMinor" bigint NOT NULL,
	"currency" text NOT NULL,
	"reference" text NOT NULL,
	"fingerprint" text NOT NULL,
	"categoryId" uuid,
	"ruleId" uuid,
	"categorySource" text DEFAULT 'unassigned' NOT NULL,
	CONSTRAINT "nonzero_amount" CHECK ("transactions"."amountMinor" <> 0),
	CONSTRAINT "valid_category_source" CHECK ("transactions"."categorySource" in ('unassigned', 'manual', 'rule'))
);
--> statement-breakpoint
ALTER TABLE "imports" ADD CONSTRAINT "imports_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rules" ADD CONSTRAINT "rules_categoryId_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_accounts_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_importId_imports_id_fk" FOREIGN KEY ("importId") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_categories_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_ruleId_rules_id_fk" FOREIGN KEY ("ruleId") REFERENCES "public"."rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "imports_account_hash" ON "imports" USING btree ("accountId","hash");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_account_fingerprint" ON "transactions" USING btree ("accountId","fingerprint");