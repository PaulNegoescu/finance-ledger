import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { overviewInput, comparisonInput } from "@ledger/core/validation";
import { categoryGroups, categories, transactions } from "./schema";

const amounts = {
  incomeMinor: sql<string>`coalesce(sum(case when ${transactions.amountMinor} > 0 then ${transactions.amountMinor} else 0 end), 0)::text`,
  expenseMinor: sql<string>`coalesce(sum(case when ${transactions.amountMinor} < 0 then -${transactions.amountMinor} else 0 end), 0)::text`,
  netMinor: sql<string>`coalesce(sum(${transactions.amountMinor}), 0)::text`,
  count: sql<number>`count(*)::integer`,
};

export function createOverview(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client);
  type Snapshot = Parameters<Parameters<typeof db.transaction>[0]>[0];
  async function summarizeInSnapshot(tx: Snapshot, input: unknown) {
    const query = overviewInput.parse(input);
    const where = and(
      query.accountId ? eq(transactions.accountId, query.accountId) : undefined,
      query.from ? gte(transactions.date, query.from) : undefined,
      query.to ? lte(transactions.date, query.to) : undefined,
    );
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
        groupId: categories.groupId,
        group: sql<string>`coalesce(${categoryGroups.name}, 'Ungrouped')`,
        category: sql<string>`coalesce(${categories.name}, 'Uncategorized')`,
        expenseMinor: sql<string>`sum(-${transactions.amountMinor})::text`,
      })
      .from(transactions)
      .leftJoin(categories, eq(transactions.categoryId, categories.id))
      .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
      .where(and(where, lt(transactions.amountMinor, 0)))
      .groupBy(
        transactions.currency,
        transactions.categoryId,
        categories.name,
        categories.groupId,
        categoryGroups.name,
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
  }
  const snapshotOptions = {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  } as const;
  return {
    close: () => client.end(),
    summarize: (input: unknown) =>
      db.transaction((tx) => summarizeInSnapshot(tx, input), snapshotOptions),
    compare: async (input: unknown) => {
      const query = comparisonInput.parse(input);
      // Both periods and their categories are read from one database snapshot.
      return db.transaction(
        async (tx) => ({
          selected: await summarizeInSnapshot(tx, query.selected),
          baseline: await summarizeInSnapshot(tx, query.baseline),
        }),
        snapshotOptions,
      );
    },
  };
}
