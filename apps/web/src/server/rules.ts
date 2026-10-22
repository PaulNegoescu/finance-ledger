import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  categoryInput,
  categoryGroupInput,
  categoryGroupUpdateInput,
} from "@ledger/core/validation";

const idInput = z.object({ id: z.uuid() });
const categoryUpdateInput = categoryInput.extend({ id: z.uuid() });
const ruleInput = z.object({
  contains: z.string().trim().min(2).max(120),
  categoryId: z.uuid(),
  priority: z.number().int().min(0).max(10000),
});
const ruleUpdateInput = ruleInput.extend({ id: z.uuid() });

async function withManagement<T>(
  action: (
    management: import("@ledger/db/rule-management").RuleManagement,
  ) => Promise<T>,
) {
  const { createRuleManagement } = await import("@ledger/db/rule-management");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("The database connection is unavailable.");
  const management = createRuleManagement(url);
  try {
    return await action(management);
  } catch {
    throw new Error(
      "Unable to save changes. Names must be unique. Categories in use and groups containing categories cannot be deleted.",
    );
  } finally {
    await management.close();
  }
}
export const createCategory = createServerFn({ method: "POST" })
  .validator(categoryInput)
  .handler(({ data }) => withManagement((m) => m.addCategory(data)));
export const updateCategory = createServerFn({ method: "POST" })
  .validator(categoryUpdateInput)
  .handler(({ data }) => withManagement((m) => m.updateCategory(data)));
export const deleteCategory = createServerFn({ method: "POST" })
  .validator(idInput)
  .handler(({ data }) => withManagement((m) => m.deleteCategory(data)));
export const createRule = createServerFn({ method: "POST" })
  .validator(ruleInput)
  .handler(({ data }) => withManagement((m) => m.addRule(data)));
export const updateRule = createServerFn({ method: "POST" })
  .validator(ruleUpdateInput)
  .handler(({ data }) => withManagement((m) => m.updateRule(data)));
export const deleteRule = createServerFn({ method: "POST" })
  .validator(idInput)
  .handler(({ data }) => withManagement((m) => m.deleteRule(data)));
export const applyRules = createServerFn({ method: "POST" }).handler(() =>
  withManagement((m) => m.applyRules()),
);

export const createCategoryGroup = createServerFn({ method: "POST" })
  .validator(categoryGroupInput)
  .handler(({ data }) => withManagement((m) => m.addGroup(data)));
export const updateCategoryGroup = createServerFn({ method: "POST" })
  .validator(categoryGroupUpdateInput)
  .handler(({ data }) => withManagement((m) => m.updateGroup(data)));
export const deleteCategoryGroup = createServerFn({ method: "POST" })
  .validator(idInput)
  .handler(({ data }) => withManagement((m) => m.deleteGroup(data)));
