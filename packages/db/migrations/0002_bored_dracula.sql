CREATE TABLE "category_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "groupId" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "category_groups_name_key" ON "category_groups" USING btree (lower(btrim("name")));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_groupId_category_groups_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."category_groups"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "category_groups" ("name") VALUES ('Critical spending'), ('Nice to have'), ('Savings'), ('Splurge') ON CONFLICT DO NOTHING;
