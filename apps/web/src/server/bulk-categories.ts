import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  ids: z
    .array(z.uuid())
    .min(1)
    .max(100)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Transaction IDs must be unique.",
    ),
  categoryId: z.uuid().nullable(),
});
export const assignBulkCategories = createServerFn({ method: "POST" })
  .validator(inputSchema)
  .handler(async ({ data }) => {
    const { createBulkCategories } = await import("@ledger/db/bulk-categories");
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("The database connection is unavailable.");
    const management = createBulkCategories(url);
    try {
      return await management.assign(data);
    } catch {
      throw new Error(
        "Unable to update all selected transactions. Refresh the list and try again.",
      );
    } finally {
      await management.close();
    }
  });
