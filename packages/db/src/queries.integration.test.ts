import { beforeAll, afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createLedger } from "./index";
import { createQueries } from "./queries";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Transaction queries (synthetic data)", () => {
  let ledger: ReturnType<typeof createLedger>;
  let queries: ReturnType<typeof createQueries>;
  let accountId: string;
  const prefix = `query-${randomUUID()}`;
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
    const rows = Array.from(
      { length: 526 },
      (_, i) =>
        `2026-01-01;${i === 0 ? "Demo 100%_literal" : `Demo row ${i}`};-1.00;RON;${prefix}-${i}`,
    );
    await ledger.importCsv({
      account: prefix,
      currency: "RON",
      csv: "Date;Description;Amount;Currency;Reference\n" + rows.join("\n"),
    });
    accountId = (await ledger.list()).accounts.find(
      (a) => a.name === prefix,
    )!.id;
  }, 30000);
  afterAll(async () => {
    await ledger?.close();
    await queries?.close();
  });
  it("paginates beyond 500, uses stable ordering and clamps out-of-range pages", async () => {
    const input = { accountId, pageSize: 25 };
    const first = await queries.listTransactions(input);
    const second = await queries.listTransactions({ ...input, page: 2 });
    const last = await queries.listTransactions({ ...input, page: 999 });
    expect(first.total).toBe(526);
    expect(first.transactions).toHaveLength(25);
    expect(
      second.transactions.every(
        (t) => !first.transactions.some((a) => a.id === t.id),
      ),
    ).toBe(true);
    expect(last.page).toBe(22);
    expect(last.transactions).toHaveLength(1);
    expect(
      (await queries.listTransactions(input)).transactions.map((t) => t.id),
    ).toEqual(first.transactions.map((t) => t.id));
  });
  it("keeps category report drilldowns isolated by currency and cash-flow direction", async () => {
    const [category] = await ledger.addCategory({
      name: `${prefix}-report-currency`,
    });
    for (const currency of ["RON", "EUR"]) {
      const account = `${prefix}-report-${currency}`;
      await ledger.importCsv({
        account,
        currency,
        csv: `Date;Description;Amount;Currency;Reference\n2026-03-01;Fictional report payment;-5.00;${currency};${prefix}-out-${currency}\n2026-03-01;Fictional report refund;2.00;${currency};${prefix}-in-${currency}`,
      });
      const reportAccount = (await ledger.metadata()).accounts.find(
        (row) => row.name === account,
      )!;
      const rows = await queries.listTransactions({
        accountId: reportAccount.id,
        currency,
      });
      for (const row of rows.transactions.filter(
        (row) => row.account === account,
      ))
        await ledger.assign({ id: row.id, categoryId: category.id });
    }
    const out = await queries.listTransactions({
      categoryId: category.id,
      currency: "RON",
      flow: "out",
    });
    expect(out.total).toBe(1);
    expect(out.transactions[0]).toMatchObject({
      currency: "RON",
      amountMinor: -500,
    });
    const incoming = await queries.listTransactions({
      categoryId: category.id,
      currency: "EUR",
      flow: "in",
    });
    expect(incoming.total).toBe(1);
    expect(incoming.transactions[0].amountMinor).toBe(200);
    expect(
      (await queries.listTransactions({ categoryId: category.id, flow: "out" }))
        .total,
    ).toBe(2);
    await expect(
      queries.listTransactions({ currency: "ron" }),
    ).rejects.toThrow();
    await expect(
      queries.listTransactions({ flow: "invalid" }),
    ).rejects.toThrow();
  });
  it("applies literal search, category, uncategorized and inclusive date filters to the whole account", async () => {
    const literal = await queries.listTransactions({ accountId, search: "%_" });
    expect(literal.total).toBe(1);
    const [category] = await ledger.addCategory({ name: `${prefix}-category` });
    await ledger.assign({
      id: literal.transactions[0].id,
      categoryId: category.id,
    });
    expect(
      (await queries.listTransactions({ accountId, categoryId: category.id }))
        .total,
    ).toBe(1);
    expect(
      (await queries.listTransactions({ accountId, uncategorized: true }))
        .total,
    ).toBe(525);
    expect(
      (
        await queries.listTransactions({
          accountId,
          from: "2026-01-01",
          to: "2026-01-01",
        })
      ).total,
    ).toBe(526);
    const empty = await queries.listTransactions({
      accountId,
      from: "2026-01-02",
      page: 50,
    });
    expect(empty.total).toBe(0);
    expect(empty.page).toBe(1);
    expect(empty.transactions).toEqual([]);
  });
  it("rejects invalid dates, reversed dates, excessive page sizes and invalid account IDs", async () => {
    for (const input of [
      { from: "2026-02-31" },
      { from: "2026-02-01", to: "2026-01-01" },
      { pageSize: 101 },
      { accountId: "invalid" },
    ])
      await expect(queries.listTransactions(input)).rejects.toThrow();
  });
});
