import { createServerFn } from "@tanstack/react-start";
import { trendsInput } from "@ledger/core/trends";
let trends:
  | ReturnType<(typeof import("@ledger/db/trends"))["createTrends"]>
  | undefined;
export const getTrends = createServerFn({ method: "GET" })
  .validator(trendsInput)
  .handler(async ({ data }) => {
    try {
      const { createTrends } = await import("@ledger/db/trends");
      if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
      trends ??= createTrends(process.env.DATABASE_URL);
      return await trends.summarize(data);
    } catch {
      throw new Error("Unable to load category trends. Try again.");
    }
  });
