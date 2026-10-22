import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createQueries } from "./queries";
import { createLedger } from "./index";
import { createRuleManagement } from "./rule-management";
import { createOverview } from "./overview";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Category groups (synthetic data)", () => {
  let ledger: ReturnType<typeof createLedger>,
    management: ReturnType<typeof createRuleManagement>,
    overview: ReturnType<typeof createOverview>;
  let queries: ReturnType<typeof createQueries>;
  const prefix = `groups-${randomUUID()}`;
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
    queries = createQueries(url!);
    management = createRuleManagement(url!);
    overview = createOverview(url!);
  });
  afterAll(async () => {
    await Promise.all([
      ledger?.close(),
      queries?.close(),
      management?.close(),
      overview?.close(),
    ]);
  });
  it("assigns, moves and clears categories without changing transaction or rule assignments", async () => {
    const group = await management.addGroup({ name: prefix });
    await expect(
      management.addGroup({ name: prefix.toUpperCase() }),
    ).rejects.toThrow();
    const category = await management.addCategory({
      name: prefix,
      groupId: group.id,
    });
    const rule = await management.addRule({
      contains: prefix,
      categoryId: category.id,
      priority: 100,
    });
    await ledger.importCsv({
      account: prefix,
      currency: "RON",
      csv: `Date;Description;Amount;Currency\n2026-06-01;${prefix};-12.34;RON`,
    });
    const meta = await ledger.metadata();
    const account = meta.accounts.find((row) => row.name === prefix)!;
    expect(meta.categoryGroups.some((row) => row.id === group.id)).toBe(true);
    const before = (await queries.listTransactions({ accountId: account.id })).transactions[0];
    expect(before.categoryId).toBe(category.id);
    expect(before.ruleId).toBe(rule.id);
    const report = await overview.summarize({ accountId: account.id });
    expect(report.categories[0]).toMatchObject({
      groupId: group.id,
      group: prefix,
      expenseMinor: "1234",
    });
    await management.updateGroup({ id: group.id, name: prefix + " renamed" });
    expect(
      (await overview.summarize({ accountId: account.id })).categories[0].group,
    ).toBe(prefix + " renamed");
    await expect(management.deleteGroup({ id: group.id })).rejects.toThrow();
    await expect(
      management.updateCategory({
        id: category.id,
        name: prefix,
        groupId: randomUUID(),
      }),
    ).rejects.toThrow();
    await management.updateCategory({
      id: category.id,
      name: prefix,
      groupId: null,
    });
    expect(
      (await overview.summarize({ accountId: account.id })).categories[0],
    ).toMatchObject({
      groupId: null,
      group: "Ungrouped",
      expenseMinor: "1234",
    });
    const after = (await queries.listTransactions({ accountId: account.id })).transactions[0];
    expect([after.categoryId, after.ruleId, after.categorySource]).toEqual([
      before.categoryId,
      before.ruleId,
      before.categorySource,
    ]);
    expect(await management.deleteGroup({ id: group.id })).toEqual({
      ok: true,
    });
  });
});
