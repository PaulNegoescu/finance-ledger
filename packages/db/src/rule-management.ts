import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { categorize } from "@ledger/core";
import {
  categoryInput,
  categoryGroupInput,
  categoryGroupUpdateInput,
} from "@ledger/core/validation";
import * as schema from "./schema";

const idInput = z.object({ id: z.uuid() });
const categoryUpdateInput = categoryInput.extend({ id: z.uuid() });
const ruleInput = z.object({
  contains: z.string().trim().min(2).max(120),
  categoryId: z.uuid(),
  priority: z.number().int().min(0).max(10000),
});
const ruleUpdateInput = ruleInput.extend({ id: z.uuid() });

export function createRuleManagement(url: string) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return {
    close: () => client.end(),
    addGroup: async (input: unknown) => {
      const data = categoryGroupInput.parse(input);
      const [group] = await db
        .insert(schema.categoryGroups)
        .values(data)
        .returning();
      return group;
    },
    updateGroup: async (input: unknown) => {
      const { id, ...data } = categoryGroupUpdateInput.parse(input);
      const [group] = await db
        .update(schema.categoryGroups)
        .set(data)
        .where(eq(schema.categoryGroups.id, id))
        .returning();
      if (!group) throw new Error("Group not found.");
      return group;
    },
    deleteGroup: async (input: unknown) => {
      const { id } = idInput.parse(input);
      const [group] = await db
        .delete(schema.categoryGroups)
        .where(eq(schema.categoryGroups.id, id))
        .returning({ id: schema.categoryGroups.id });
      if (!group) throw new Error("Group not found.");
      return { ok: true };
    },
    addCategory: async (input: unknown) => {
      const data = categoryInput.parse(input);
      const [category] = await db
        .insert(schema.categories)
        .values(data)
        .returning();
      return category;
    },
    updateCategory: async (input: unknown) => {
      const { id, ...data } = categoryUpdateInput.parse(input);
      const [category] = await db
        .update(schema.categories)
        .set(data)
        .where(eq(schema.categories.id, id))
        .returning();
      if (!category) throw new Error("Category not found.");
      return category;
    },
    // Foreign keys prevent removing categories that are still assigned or used by a rule.
    deleteCategory: async (input: unknown) => {
      const { id } = idInput.parse(input);
      const [category] = await db
        .delete(schema.categories)
        .where(eq(schema.categories.id, id))
        .returning({ id: schema.categories.id });
      if (!category) throw new Error("Category not found.");
      return { ok: true };
    },
    addRule: async (input: unknown) => {
      const data = ruleInput.parse(input);
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(674321)`);
        const [rule] = await tx.insert(schema.rules).values(data).returning();
        return rule;
      });
    },
    updateRule: async (input: unknown) => {
      const { id, ...data } = ruleUpdateInput.parse(input);
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(674321)`);
        const [rule] = await tx
          .update(schema.rules)
          .set(data)
          .where(eq(schema.rules.id, id))
          .returning();
        if (!rule) throw new Error("Rule not found.");
        return rule;
      });
    },
    deleteRule: async (input: unknown) => {
      const { id } = idInput.parse(input);
      return db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(674321)`);
        // Historical categories remain intact even after the originating rule is removed.
        await tx
          .update(schema.transactions)
          .set({ ruleId: null })
          .where(eq(schema.transactions.ruleId, id));
        const [rule] = await tx
          .delete(schema.rules)
          .where(eq(schema.rules.id, id))
          .returning({ id: schema.rules.id });
        if (!rule) throw new Error("Rule not found.");
        return { ok: true };
      });
    },
    applyRules: async () =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(674321)`);
        const rules = await tx.select().from(schema.rules);
        const pending = await tx
          .select({
            id: schema.transactions.id,
            description: schema.transactions.description,
          })
          .from(schema.transactions)
          .where(isNull(schema.transactions.categoryId));
        let updated = 0;
        for (const transaction of pending) {
          const rule = categorize(transaction.description, rules);
          if (!rule) continue;
          const rows = await tx
            .update(schema.transactions)
            .set({
              categoryId: rule.categoryId,
              ruleId: rule.id,
              categorySource: "rule",
            })
            .where(
              and(
                eq(schema.transactions.id, transaction.id),
                isNull(schema.transactions.categoryId),
              ),
            )
            .returning({ id: schema.transactions.id });
          updated += rows.length;
        }
        return { updated };
      }),
  };
}
export type RuleManagement = ReturnType<typeof createRuleManagement>;
