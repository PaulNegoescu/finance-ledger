import { z } from "zod";
export const trendsInput = z.object({
  year: z.number().int().min(1000).max(9998),
  accountId: z.uuid().optional(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional(),
});
export const trendsSearch = trendsInput.partial();
export function monthBounds(month: string) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Invalid month");
  const [year, number] = month.split("-").map(Number);
  return {
    from: `${month}-01`,
    to: `${month}-${new Date(Date.UTC(year, number, 0)).getUTCDate()}`,
  };
}
