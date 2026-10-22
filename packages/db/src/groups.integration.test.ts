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
    const before = (await queries.listTransactions({ accountId: account.id }))
      .transactions[0];
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
    const after = (await queries.listTransactions({ accountId: account.id }))
      .transactions[0];
    expect([after.categoryId, after.ruleId, after.categorySource]).toEqual([
      before.categoryId,
      before.ruleId,
      before.categorySource,
    ]);
    expect(await management.deleteGroup({ id: group.id })).toEqual({
      ok: true,
    });
  });
  it("reconciles group and ungrouped report totals with transaction lists and CSV exports", async () => {
    const group = await management.addGroup({ name: prefix + "-drilldown" });
    const grouped = await management.addCategory({
      name: prefix + "-grouped",
      groupId: group.id,
    });
    const ungrouped = await management.addCategory({
      name: prefix + "-ungrouped",
    });
    await ledger.importCsv({
      account: prefix + "-drilldown",
      currency: "RON",
      csv: "Date;Description;Amount;Currency;Reference\n2026-07-01;Fictional group debit;-12.34;RON;GROUP-DEBIT\n2026-07-02;Fictional group credit;2.00;RON;GROUP-CREDIT\n2026-07-03;Fictional ungrouped;-3.00;RON;UNGROUPED\n2026-07-04;Fictional uncategorized;-4.00;RON;UNCATEGORIZED",
    });
    const accountId = (await ledger.metadata()).accounts.find(
      (row) => row.name === prefix + "-drilldown",
    )!.id;
    const rows = (await queries.listTransactions({ accountId })).transactions;
    for (const row of rows)
      await ledger.assign({
        id: row.id,
        categoryId: row.reference.startsWith("GROUP-")
          ? grouped.id
          : row.reference === "UNGROUPED"
            ? ungrouped.id
            : null,
      });
    const filter = {
      accountId,
      currency: "RON",
      flow: "out",
      groupId: group.id,
    };
    const report = await overview.summarize({ accountId });
    expect(
      report.categories.find((row) => row.groupId === group.id)?.expenseMinor,
    ).toBe("1234");
    const page = await queries.listTransactions(filter);
    expect(page.total).toBe(1);
    expect(page.transactions[0].reference).toBe("GROUP-DEBIT");
    const csv = await queries.exportTransactions(filter);
    expect(csv.count).toBe(1);
    expect(csv.csv).toContain('"-12.34"');
    expect(csv.csv).not.toContain("GROUP-CREDIT");
    expect(
      (await queries.listTransactions({ ...filter, flow: "in" })).total,
    ).toBe(1);
    expect(
      (await queries.listTransactions({ ...filter, currency: "EUR" })).total,
    ).toBe(0);
    expect(
      (await queries.listTransactions({ ...filter, from: "2026-08-01" })).total,
    ).toBe(0);
    expect(
      (
        await queries.listTransactions({
          accountId,
          ungrouped: true,
          flow: "out",
        })
      ).total,
    ).toBe(2);
    expect(
      (
        await queries.listTransactions({
          accountId,
          ungrouped: true,
          uncategorized: true,
        })
      ).total,
    ).toBe(1);
    expect(
      (await queries.exportTransactions({ accountId, ungrouped: true })).count,
    ).toBe(2);
    await management.updateCategory({
      id: grouped.id,
      name: grouped.name,
      groupId: null,
    });
    expect((await queries.listTransactions(filter)).total).toBe(0);
    expect(
      (
        await queries.listTransactions({
          accountId,
          ungrouped: true,
          flow: "out",
        })
      ).total,
    ).toBe(3);
  });
});
