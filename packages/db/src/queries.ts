import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  and,
  desc,
  eq,
  gte,
  lte,
  lt,
  gt,
  isNull,
  sql,
  getTableColumns,
} from "drizzle-orm";
import {
  transactionQuery,
  transactionExportInput,
} from "@ledger/core/validation";
import { accounts, transactions, categories, categoryGroups } from "./schema";

import { transactionCsv, transactionExportLimit } from "@ledger/core/csv";
import type { z } from "zod";

export class TransactionExportLimitError extends Error {
  constructor() {
    super(
      `Export supports up to ${transactionExportLimit.toLocaleString("en-GB")} transactions. Narrow the filters and try again.`,
    );
    this.name = "TransactionExportLimitError";
  }
}
function transactionWhere(query: z.infer<typeof transactionExportInput>) {
  return and(
    query.currency ? eq(transactions.currency, query.currency) : undefined,
    query.flow === "in"
      ? gt(transactions.amountMinor, 0)
      : query.flow === "out"
        ? lt(transactions.amountMinor, 0)
        : undefined,
    query.importId ? eq(transactions.importId, query.importId) : undefined,
    query.accountId ? eq(transactions.accountId, query.accountId) : undefined,
    query.uncategorized
      ? isNull(transactions.categoryId)
      : query.categoryId
        ? eq(transactions.categoryId, query.categoryId)
        : undefined,
    query.from ? gte(transactions.date, query.from) : undefined,
    query.to ? lte(transactions.date, query.to) : undefined,
    query.search
      ? sql`strpos(lower(${transactions.description}), lower(${query.search})) > 0`
      : undefined,
  );
}
export function createQueries(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client);
  return {
    close: () => client.end(),
    exportTransactions: async (input: unknown) => {
      const query = transactionExportInput.parse(input);
      const where = transactionWhere(query);
      const rows = await db.transaction(
        async (tx) => {
          const [count] = await tx
            .select({ total: sql<number>`count(*)::integer` })
            .from(transactions)
            .where(where);
          if (count.total > transactionExportLimit)
            throw new TransactionExportLimitError();
          return tx
            .select({
              id: transactions.id,
              date: transactions.date,
              account: accounts.name,
              description: transactions.description,
              amountMinor: sql<string>`${transactions.amountMinor}::text`,
              currency: transactions.currency,
              category: categories.name,
              categoryGroup: categoryGroups.name,
              categorySource: transactions.categorySource,
              reference: transactions.reference,
            })
            .from(transactions)
            .innerJoin(accounts, eq(transactions.accountId, accounts.id))
            .leftJoin(categories, eq(transactions.categoryId, categories.id))
            .leftJoin(categoryGroups, eq(categories.groupId, categoryGroups.id))
            .where(where)
            .orderBy(desc(transactions.date), desc(transactions.id));
        },
        { isolationLevel: "repeatable read", accessMode: "read only" },
      );
      return { csv: transactionCsv(rows), count: rows.length };
    },
    listTransactions: async (input: unknown) => {
      const query = transactionQuery.parse(input);
      const where = transactionWhere(query);
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
