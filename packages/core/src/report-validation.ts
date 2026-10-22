import { z } from "zod";
const reportDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Invalid date",
  );
export const overviewInput = z
  .object({
    accountId: z.uuid().optional(),
    from: reportDate.optional(),
    to: reportDate.optional(),
  })
  .refine(
    (value) => !value.from || !value.to || value.from <= value.to,
    "Start date must not follow end date",
  );
export const comparisonInput = z.object({
  selected: overviewInput,
  baseline: overviewInput,
});
