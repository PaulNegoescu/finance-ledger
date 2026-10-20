import { z } from "zod";
export const importInput = z.object({
  account: z.string().trim().min(1).max(100),
  currency: z.string().regex(/^[A-Z]{3}$/),
  csv: z.string().min(1).max(2_000_000),
});
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
