import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { categories, transactions } from "./schema";

const inputSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Transaction IDs must be unique.",
    ),
  categoryId: z.uuid().nullable(),
});

export function createBulkCategories(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client);
  return {
    close: () => client.end(),
    assign: async (input: unknown) => {
      const data = inputSchema.parse(input);
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(674321)`);
        if (data.categoryId) {
          const [category] = await tx
            .select({ id: categories.id })
            .from(categories)
            .where(eq(categories.id, data.categoryId));
          if (!category) throw new Error("Category not found.");
        }
        const found = await tx
          .select({ id: transactions.id })
          .from(transactions)
          .where(inArray(transactions.id, data.ids))
          .for("update");
        if (found.length !== data.ids.length)
          throw new Error("One or more transactions no longer exist.");
        const saved = await tx
          .update(transactions)
          .set({
            categoryId: data.categoryId,
            categorySource: data.categoryId ? "manual" : "unassigned",
            ruleId: null,
          })
          .where(inArray(transactions.id, data.ids))
          .returning({ id: transactions.id });
        if (saved.length !== data.ids.length)
          throw new Error("Unable to update all selected transactions.");
        return { updated: saved.length };
      });
    },
  };
}
