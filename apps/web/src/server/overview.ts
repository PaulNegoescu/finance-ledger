import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Invalid date",
  );
const overviewInput = z
  .object({
    accountId: z.uuid().optional(),
    from: dateInput.optional(),
    to: dateInput.optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Start date must not follow end date",
  );
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
