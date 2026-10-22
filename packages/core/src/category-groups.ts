import { z } from "zod";
export const categoryGroupInput = z.object({
  name: z.string().trim().min(1).max(80),
});
export const categoryGroupUpdateInput = categoryGroupInput.extend({
  id: z.uuid(),
});
