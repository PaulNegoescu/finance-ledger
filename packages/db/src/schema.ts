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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("imports_account_hash").on(t.accountId, t.hash)],
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
