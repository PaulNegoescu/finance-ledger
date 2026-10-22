import { createServerFn } from "@tanstack/react-start";
import { overviewInput, comparisonInput } from "@ledger/core/validation";
let overview:
  | ReturnType<(typeof import("@ledger/db/overview"))["createOverview"]>
  | undefined;
export const getOverview = createServerFn({ method: "GET" })
  .validator(overviewInput)
  .handler(async ({ data }) => {
    try {
      const { createOverview } = await import("@ledger/db/overview");
      if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
      overview ??= createOverview(process.env.DATABASE_URL);
      return await overview.summarize(data);
    } catch {
      throw new Error(
        "Unable to load the overview. Check your filters and connection, then try again.",
      );
    }
  });

export const getComparison = createServerFn({ method: "GET" })
  .validator(comparisonInput)
  .handler(async ({ data }) => {
    try {
      const { createOverview } = await import("@ledger/db/overview");
      if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
      overview ??= createOverview(process.env.DATABASE_URL);
      return await overview.compare(data);
    } catch {
      throw new Error(
        "Unable to load the comparison. Check your filters and connection, then try again.",
      );
    }
  });
