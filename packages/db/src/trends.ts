import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, asc, eq, gte, lt, sql } from "drizzle-orm";
import { trendsInput } from "@ledger/core/trends";
import { categories, transactions } from "./schema";
export function createTrends(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client);
  return {
    close: () => client.end(),
    summarize: async (input: unknown) => {
      const query = trendsInput.parse(input);
      const where = and(
        gte(transactions.date, `${query.year}-01-01`),
        lt(transactions.date, `${query.year + 1}-01-01`),
        lt(transactions.amountMinor, 0),
        query.accountId
          ? eq(transactions.accountId, query.accountId)
          : undefined,
      );
      return db.transaction(
        async (tx) => {
          const currencies = await tx
            .selectDistinct({ currency: transactions.currency })
            .from(transactions)
            .where(where)
            .orderBy(asc(transactions.currency));
          const month = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
          const rows = await tx
            .select({
              month,
              currency: transactions.currency,
              categoryId: transactions.categoryId,
              category: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
              expenseMinor: sql<string>`sum(-${transactions.amountMinor})::text`,
              count: sql<number>`count(*)::integer`,
            })
            .from(transactions)
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .where(
              and(
                where,
                query.currency
                  ? eq(transactions.currency, query.currency)
                  : undefined,
              ),
            )
            .groupBy(
              month,
              transactions.currency,
              transactions.categoryId,
              categories.name,
            )
            .orderBy(
              asc(month),
              asc(transactions.currency),
              asc(categories.name),
              asc(transactions.categoryId),
            );
          return { currencies: currencies.map((row) => row.currency), rows };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
