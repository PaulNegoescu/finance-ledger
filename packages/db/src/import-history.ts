import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { accounts, imports, transactions } from "./schema";

const historyQuery = z.object({
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  accountId: z.uuid().optional(),
});

export function createImportHistory(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client);
  return {
    close: () => client.end(),
    list: async (input: unknown) => {
      const query = historyQuery.parse(input);
      const where = query.accountId
        ? eq(imports.accountId, query.accountId)
        : undefined;
      return db.transaction(
        async (tx) => {
          const [count] = await tx
            .select({ total: sql<number>`count(*)::integer` })
            .from(imports)
            .where(where);
          const page = Math.min(
            query.page,
            Math.max(1, Math.ceil(count.total / query.pageSize)),
          );
          const rows = await tx
            .select({
              id: imports.id,
              adapterId: imports.adapterId,
              format: imports.format,
              inputCount: imports.inputCount,
              skippedCount: imports.skippedCount,
              account: accounts.name,
              currency: accounts.currency,
              createdAt: imports.createdAt,
              transactionCount: sql<number>`(select count(*)::integer from ${transactions} where ${transactions.importId} = ${imports.id})`,
            })
            .from(imports)
            .innerJoin(accounts, eq(imports.accountId, accounts.id))
            .where(where)
            .orderBy(desc(imports.createdAt), desc(imports.id))
            .limit(query.pageSize)
            .offset((page - 1) * query.pageSize);
          return {
            imports: rows.map((row) => ({
              ...row,
              createdAt: row.createdAt.toISOString(),
            })),
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
