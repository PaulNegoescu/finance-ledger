import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  date,
  bigint,
  integer,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
export const accounts = pgTable("accounts", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
  currency: text().notNull(),
});
export const categories = pgTable("categories", {
  id: uuid().primaryKey().defaultRandom(),
  name: text().notNull().unique(),
});
export const rules = pgTable("rules", {
  id: uuid().primaryKey().defaultRandom(),
  contains: text().notNull(),
  categoryId: uuid()
    .notNull()
    .references(() => categories.id),
  priority: integer().notNull().default(100),
});
export const imports = pgTable(
  "imports",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    hash: text().notNull(),
    adapterId: text().notNull().default("ing"),
    format: text().notNull().default("csv"),
    inputCount: integer(),
    skippedCount: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("imports_account_source_hash").on(
      t.accountId,
      t.adapterId,
      t.format,
      t.hash,
    ),
    check(
      "valid_import_counts",
      sql`(${t.inputCount} is null and ${t.skippedCount} is null) or (${t.inputCount} is not null and ${t.skippedCount} is not null and ${t.inputCount} >= 0 and ${t.skippedCount} >= 0 and ${t.skippedCount} <= ${t.inputCount})`,
    ),
  ],
);
export const transactions = pgTable(
  "transactions",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id),
    importId: uuid()
      .notNull()
      .references(() => imports.id),
    date: date().notNull(),
    description: text().notNull(),
    amountMinor: bigint({ mode: "number" }).notNull(),
    currency: text().notNull(),
    reference: text().notNull(),
    fingerprint: text().notNull(),
    categoryId: uuid().references(() => categories.id),
    ruleId: uuid().references(() => rules.id),
    categorySource: text().notNull().default("unassigned"),
  },
  (t) => [
    uniqueIndex("transactions_account_fingerprint").on(
      t.accountId,
      t.fingerprint,
    ),
    check("nonzero_amount", sql`${t.amountMinor} <> 0`),
    check(
      "valid_category_source",
      sql`${t.categorySource} in ('unassigned', 'manual', 'rule')`,
    ),
  ],
);
