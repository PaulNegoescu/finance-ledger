import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const historyQuery = z.object({
  page: z.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  accountId: z.uuid().optional(),
});
let history:
  | ReturnType<
      (typeof import("@ledger/db/import-history"))["createImportHistory"]
    >
  | undefined;
export const listImportHistory = createServerFn({ method: "GET" })
  .validator(historyQuery)
  .handler(async ({ data }) => {
    try {
      const { createImportHistory } = await import("@ledger/db/import-history");
      if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
      history ??= createImportHistory(process.env.DATABASE_URL);
      return await history.list(data);
    } catch {
      throw new Error(
        "Unable to load import history. Check your connection and try again.",
      );
    }
  });
