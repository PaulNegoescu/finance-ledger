import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  and,
  desc,
  eq,
  gte,
  lte,
  isNull,
  sql,
  getTableColumns,
} from "drizzle-orm";
import { transactionQuery } from "@ledger/core/validation";
import { accounts, transactions } from "./schema";

export function createQueries(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client);
  return {
    close: () => client.end(),
    listTransactions: async (input: unknown) => {
      const query = transactionQuery.parse(input);
      const conditions = [
        query.importId ? eq(transactions.importId, query.importId) : undefined,
        query.accountId
          ? eq(transactions.accountId, query.accountId)
          : undefined,
        query.uncategorized
          ? isNull(transactions.categoryId)
          : query.categoryId
            ? eq(transactions.categoryId, query.categoryId)
            : undefined,
        query.from ? gte(transactions.date, query.from) : undefined,
        query.to ? lte(transactions.date, query.to) : undefined,
        // Literal substring matching: %, _ and backslashes have no wildcard meaning.
        query.search
          ? sql`strpos(lower(${transactions.description}), lower(${query.search})) > 0`
          : undefined,
      ];
      const where = and(...conditions);
      // Count and page use a single snapshot, including during concurrent imports.
      return db.transaction(
        async (tx) => {
          const [count] = await tx
            .select({ total: sql<number>`count(*)::integer` })
            .from(transactions)
            .where(where);
          const page = Math.min(
            query.page,
            Math.max(1, Math.ceil(count.total / query.pageSize)),
          );
          const rows = await tx
            .select({
              ...getTableColumns(transactions),
              account: accounts.name,
            })
            .from(transactions)
            .innerJoin(accounts, eq(transactions.accountId, accounts.id))
            .where(where)
            .orderBy(desc(transactions.date), desc(transactions.id))
            .limit(query.pageSize)
            .offset((page - 1) * query.pageSize);
          return {
            transactions: rows,
            total: count.total,
            page,
            pageSize: query.pageSize,
          };
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
    },
  };
}
