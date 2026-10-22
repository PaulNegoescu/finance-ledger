import { z } from "zod";
import { previousMonth } from "@ledger/core/comparison";
import { overviewInput } from "@ledger/core/validation";
const year = z.string().regex(/^[1-9]\d{3}$/);
const month = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const overviewSchema = overviewInput.safeExtend({ year: year.optional() });
const spendingSchema = overviewInput.safeExtend({
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});
const comparisonSchema = z.object({
  accountId: z.uuid().optional(),
  selected: month.refine((value) => value !== "1000-01").optional(),
  baseline: month.optional(),
});
export type OverviewSearch = {
  accountId?: string;
  from?: string;
  to?: string;
  year?: string;
  invalidFilters?: boolean;
};
export type SpendingSearch = {
  accountId?: string;
  from?: string;
  to?: string;
  currency?: string;
  invalidFilters?: boolean;
};
export type ComparisonSearch = {
  accountId?: string;
  selected?: string;
  baseline?: string;
  invalidFilters?: boolean;
};
// Invalid incoming links render safe defaults plus a visible reset notice, never a router stack trace.
export function readOverviewSearch(input: unknown): OverviewSearch {
  const result = overviewSchema.safeParse(input);
  return result.success ? result.data : { invalidFilters: true };
}
export function readSpendingSearch(input: unknown): SpendingSearch {
  const result = spendingSchema.safeParse(input);
  return result.success ? result.data : { invalidFilters: true };
}
export function readComparisonSearch(input: unknown): ComparisonSearch {
  const result = comparisonSchema.safeParse(input);
  return result.success ? result.data : { invalidFilters: true };
}

export function comparisonDefaults(
  input: ComparisonSearch,
  currentMonth: string,
) {
  const selected = input.selected ?? currentMonth;
  return {
    selected,
    baseline: input.baseline ?? previousMonth(selected),
    accountId: input.accountId ?? "",
  };
}
