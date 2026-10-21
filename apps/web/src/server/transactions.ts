import { createServerFn } from "@tanstack/react-start";
import { transactionQuery } from "@ledger/core/validation";
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
