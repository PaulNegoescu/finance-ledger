import { z } from "zod";
export const importInput = z.object({
  adapterId: z.string().min(1).max(80).default("ing"),
  format: z.string().min(1).max(40).default("csv"),
  account: z.string().trim().min(1).max(100),
  currency: z.string().regex(/^[A-Z]{3}$/),
  accountId: z.uuid().optional(),
  createAccount: z.boolean().optional(),
  csv: z
    .string()
    .min(1)
    .max(2_000_000)
    .refine(
      (value) => new TextEncoder().encode(value).byteLength <= 2_000_000,
      "CSV must not exceed 2 MB.",
    ),
});
export const importRequest = importInput.refine(
  (value) => Boolean(value.accountId) !== Boolean(value.createAccount),
  "Select an existing account or explicitly create a new one.",
);
export const categoryInput = z.object({
  name: z.string().trim().min(1).max(80),
});
export const assignmentInput = z.object({
  id: z.uuid(),
  categoryId: z.uuid().nullable(),
});
export const ruleInput = z.object({
  contains: z.string().trim().min(2).max(120),
  categoryId: z.uuid(),
});

const filterDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Invalid date",
  );
const transactionFilters = z.object({
  search: z.string().trim().max(200).optional(),
  accountId: z.uuid().optional(),
  importId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  uncategorized: z.boolean().optional(),
  from: filterDate.optional(),
  to: filterDate.optional(),
});
const validRange = (data: { from?: string; to?: string }) =>
  !data.from || !data.to || data.from <= data.to;
export const transactionSearch = transactionFilters.refine(
  validRange,
  "Start date must not follow end date",
);
export const transactionQuery = transactionFilters
  .extend({
    page: z.number().int().min(1).max(1_000_000).default(1),
    pageSize: z.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(200).default(""),
    uncategorized: z.boolean().default(false),
  })
  .refine(validRange, "Start date must not follow end date");
