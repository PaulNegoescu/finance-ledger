import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq, and, inArray, sql, getTableColumns } from "drizzle-orm";
import {
  categorize,
  hash,
  importInput,
  parseIngCsv,
  reviewIngCsv,
  categoryInput,
  assignmentInput,
  ruleInput,
} from "@ledger/core";
import * as schema from "./schema";

export function createLedger(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return {
    close: () => client.end(),
    health: async () => {
      await db.execute(sql`select 1`);
      return { ok: true };
    },
    list: async () => ({
      transactions: await db
        .select({
          ...getTableColumns(schema.transactions),
          account: schema.accounts.name,
        })
        .from(schema.transactions)
        .innerJoin(
          schema.accounts,
          eq(schema.transactions.accountId, schema.accounts.id),
        )
        .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
        .limit(500),
      categories: await db
        .select()
        .from(schema.categories)
        .orderBy(schema.categories.name),
      rules: await db
        .select()
        .from(schema.rules)
        .orderBy(schema.rules.priority, schema.rules.id),
    }),
    previewCsv: async (input: unknown) => {
      const data = importInput.parse(input);
      const review = reviewIngCsv(data.csv, data.currency);
      const [account] = await db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.name, data.account));
      if (account && account.currency !== data.currency)
        review.issues.push({
          row: null,
          message: "This account uses a different currency.",
        });
      const existing =
        account && review.rows.length
          ? await db
              .select({ fingerprint: schema.transactions.fingerprint })
              .from(schema.transactions)
              .where(
                and(
                  eq(schema.transactions.accountId, account.id),
                  inArray(
                    schema.transactions.fingerprint,
                    review.rows.map((r) => r.fingerprint),
                  ),
                ),
              )
          : [];
      const known = new Set(existing.map((r) => r.fingerprint));
      const rows = review.rows.map(({ fingerprint, ...row }) => ({
        ...row,
        duplicate: known.has(fingerprint),
      }));
      return {
        rows,
        issues: review.issues,
        newCount: rows.filter((r) => !r.duplicate).length,
        duplicateCount: rows.filter((r) => r.duplicate).length,
      };
    },
    importCsv: async (input: unknown) => {
      const data = importInput.parse(input);
      const rows = parseIngCsv(data.csv, data.currency);
      return db.transaction(async (tx) => {
        // Serialize imports, including account creation and overlapping exports.
        await tx.execute(sql`select pg_advisory_xact_lock(674321)`);
        await tx
          .insert(schema.accounts)
          .values({ name: data.account, currency: data.currency })
          .onConflictDoNothing();
        const [account] = await tx
          .select()
          .from(schema.accounts)
          .where(eq(schema.accounts.name, data.account));
        if (account.currency !== data.currency)
          throw new Error("Contul existent are altă valută.");
        const [batch] = await tx
          .insert(schema.imports)
          .values({ accountId: account.id, hash: hash(data.csv) })
          .onConflictDoNothing()
          .returning();
        if (!batch) return { inserted: 0, skipped: rows.length };
        const rules = await tx.select().from(schema.rules);
        let inserted = 0;
        for (const row of rows) {
          const rule = categorize(row.description, rules);
          const saved = await tx
            .insert(schema.transactions)
            .values({
              ...row,
              accountId: account.id,
              importId: batch.id,
              categoryId: rule?.categoryId ?? null,
              ruleId: rule?.id ?? null,
              categorySource: rule ? "rule" : "unassigned",
            })
            .onConflictDoNothing()
            .returning({ id: schema.transactions.id });
          inserted += saved.length;
        }
        return { inserted, skipped: rows.length - inserted };
      });
    },
    addCategory: async (input: unknown) => {
      const data = categoryInput.parse(input);
      return db
        .insert(schema.categories)
        .values(data)
        .onConflictDoNothing()
        .returning();
    },
    assign: async (input: unknown) => {
      const data = assignmentInput.parse(input);
      const result = await db
        .update(schema.transactions)
        .set({
          categoryId: data.categoryId,
          ruleId: null,
          categorySource: data.categoryId ? "manual" : "unassigned",
        })
        .where(eq(schema.transactions.id, data.id))
        .returning({ id: schema.transactions.id });
      if (!result.length) throw new Error("Tranzacție inexistentă.");
      return { ok: true };
    },
    addRule: async (input: unknown) =>
      db.insert(schema.rules).values(ruleInput.parse(input)).returning(),
  };
}
export type Ledger = ReturnType<typeof createLedger>;
