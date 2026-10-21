import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createLedger } from "./index";
import { createRuleManagement } from "./rule-management";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Category and rule management (synthetic data)", () => {
  let ledger: ReturnType<typeof createLedger>;
  let management: ReturnType<typeof createRuleManagement>;
  let inspect: ReturnType<typeof postgres>;
  const prefix = `rules-${randomUUID()}`;
  beforeAll(async () => {
    const client = postgres(url!, { max: 1, onnotice: () => {} });
    try {
      await migrate(drizzle(client), {
        migrationsFolder: fileURLToPath(
          new URL("../migrations", import.meta.url),
        ),
      });
    } finally {
      await client.end();
    }
    ledger = createLedger(url!);
    management = createRuleManagement(url!);
    inspect = postgres(url!, { max: 1, onnotice: () => {} });
  });
  afterAll(async () => {
    await Promise.all([ledger?.close(), management?.close(), inspect?.end()]);
  });
  const rows = () =>
    inspect`select t.id, t.description, t."categoryId", t."ruleId", t."categorySource" from transactions t join accounts a on a.id = t."accountId" where a.name = ${prefix}`;

  it("renames categories, validates priorities, applies by priority only to uncategorized and keeps historical categories after rule deletion", async () => {
    const first = await management.addCategory({ name: `${prefix}-first` });
    const second = await management.addCategory({ name: `${prefix}-second` });
    expect(
      (
        await management.updateCategory({
          id: first.id,
          name: `${prefix}-renamed`,
        })
      ).name,
    ).toBe(`${prefix}-renamed`);
    await expect(
      management.updateCategory({ id: second.id, name: `${prefix}-renamed` }),
    ).rejects.toThrow();
    await ledger.importCsv({
      account: prefix,
      currency: "RON",
      csv: `Date;Description;Amount;Currency\n2026-10-01;${prefix} pending;-1.00;RON\n2026-10-02;${prefix} manual;-2.00;RON`,
    });
    const manual = (await rows()).find((row) =>
      row.description.endsWith("manual"),
    )!;
    await ledger.assign({ id: manual.id, categoryId: first.id });
    const fallback = await management.addRule({
      contains: prefix,
      categoryId: first.id,
      priority: 20,
    });
    const preferred = await management.addRule({
      contains: prefix,
      categoryId: second.id,
      priority: 10,
    });
    await expect(
      management.addRule({
        contains: prefix,
        categoryId: second.id,
        priority: 0.5,
      }),
    ).rejects.toThrow();
    await expect(
      management.updateRule({ ...preferred, priority: -1 }),
    ).rejects.toThrow();
    const result = await management.applyRules();
    expect(result.updated).toBeGreaterThanOrEqual(1);
    const after = await rows();
    const pending = after.find((row) => row.description.endsWith("pending"))!;
    expect(pending.categoryId).toBe(second.id);
    expect(pending.ruleId).toBe(preferred.id);
    expect(after.find((row) => row.id === manual.id)?.categoryId).toBe(
      first.id,
    );
    expect(after.find((row) => row.id === manual.id)?.categorySource).toBe(
      "manual",
    );
    await management.updateRule({
      id: preferred.id,
      contains: prefix,
      categoryId: first.id,
      priority: 5,
    });
    await management.applyRules();
    expect(
      (await rows()).find((row) => row.id === pending.id)?.categoryId,
    ).toBe(second.id);
    await expect(
      management.deleteCategory({ id: second.id }),
    ).rejects.toThrow();
    await management.deleteRule({ id: preferred.id });
    const historical = (await rows()).find((row) => row.id === pending.id)!;
    expect(historical.categoryId).toBe(second.id);
    expect(historical.categorySource).toBe("rule");
    expect(historical.ruleId).toBeNull();
    await ledger.assign({ id: pending.id, categoryId: null });
    await management.applyRules();
    const reapplied = (await rows()).find((row) => row.id === pending.id)!;
    expect(reapplied.categoryId).toBe(first.id);
    expect(reapplied.ruleId).toBe(fallback.id);
    const spare = await management.addCategory({ name: `${prefix}-unused` });
    expect(await management.deleteCategory({ id: spare.id })).toEqual({
      ok: true,
    });
    await expect(management.deleteCategory({ id: spare.id })).rejects.toThrow(
      "not found",
    );
  });
});
