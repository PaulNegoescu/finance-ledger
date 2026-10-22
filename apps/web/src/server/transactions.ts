import { createServerFn } from "@tanstack/react-start";
import {
  transactionQuery,
  transactionExportInput,
} from "@ledger/core/validation";
let queries:
  | Awaited<ReturnType<(typeof import("@ledger/db/queries"))["createQueries"]>>
  | undefined;
export const listTransactions = createServerFn({ method: "GET" })
  .validator(transactionQuery)
  .handler(async ({ data }) => {
    try {
      const { createQueries } = await import("@ledger/db/queries");
      if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
      queries ??= createQueries(process.env.DATABASE_URL);
      return await queries.listTransactions(data);
    } catch {
      throw new Error(
        "Unable to load transactions. Check filters and connection, then try again.",
      );
    }
  });

export const exportTransactions = createServerFn({ method: "POST" })
  .validator(transactionExportInput)
  .handler(async ({ data }) => {
    const { createQueries, TransactionExportLimitError } = await import(
      "@ledger/db/queries"
    );
    try {
      if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
      queries ??= createQueries(process.env.DATABASE_URL);
      return { ok: true as const, ...(await queries.exportTransactions(data)) };
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof TransactionExportLimitError
            ? error.message
            : "Unable to export transactions. Try again.",
      };
    }
  });
