import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { categories, transactions } from "./schema";

const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Invalid date",
  );
const overviewInput = z
  .object({
    accountId: z.uuid().optional(),
    from: dateInput.optional(),
    to: dateInput.optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Start date must not follow end date",
  );
const amounts = {
  incomeMinor: sql<string>`coalesce(sum(case when ${transactions.amountMinor} > 0 then ${transactions.amountMinor} else 0 end), 0)::text`,
  expenseMinor: sql<string>`coalesce(sum(case when ${transactions.amountMinor} < 0 then -${transactions.amountMinor} else 0 end), 0)::text`,
  netMinor: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)::text`,
  count: sql<number>`count(*)::integer`,
};

export function createOverview(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client);
  return {
    close: () => client.end(),
    summarize: async (input: unknown) => {
      const query = overviewInput.parse(input);
      const where = and(
        query.accountId
          ? eq(transactions.accountId, query.accountId)
          : undefined,
        query.from ? gte(transactions.date, query.from) : undefined,
        query.to ? lte(transactions.date, query.to) : undefined,
      );
      // All reports share a snapshot. Numeric sums stay exact integer strings,
      // and every grouping includes currency; no exchange rates are inferred.
      return db.transaction(
        async (tx) => {
          const totals = await tx
            .select({ currency: transactions.currency, ...amounts })
            .from(transactions)
            .where(where)
            .groupBy(transactions.currency)
            .orderBy(asc(transactions.currency));
          const spending = await tx
            .select({
              currency: transactions.currency,
              categoryId: transactions.categoryId,
              category: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
              expenseMinor: sql<string>`sum(-${transactions.amountMinor})::text`,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .where(and(where, lt(transactions.amountMinor, 0)))
            .groupBy(
              transactions.currency,
              transactions.categoryId,
              categories.name,
            )
            .orderBy(
              asc(transactions.currency),
              desc(sql`sum(-${transactions.amountMinor})`),
              asc(categories.name),
            );
          const month = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
          const months = await tx
            .select({ month, currency: transactions.currency, ...amounts })
            .from(transactions)
            .where(where)
            .groupBy(month, transactions.currency)
            .orderBy(desc(month), asc(transactions.currency));
          return { totals, categories: spending, months };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
