import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createOverview } from "./overview";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Financial overview (synthetic data)", () => {
  let client: ReturnType<typeof postgres>;
  let overview: ReturnType<typeof createOverview>;
  const ron = randomUUID();
  const eur = randomUUID();
  const precise = randomUUID();
  const category = randomUUID();
  const ronImport = randomUUID();
  const eurImport = randomUUID();
  const preciseImport = randomUUID();
  const prefix = `overview-${randomUUID()}`;
  beforeAll(async () => {
    client = postgres(url!, { max: 1, onnotice: () => {} });
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(
        new URL("../migrations", import.meta.url),
      ),
    });
    await client`insert into accounts (id, name, currency) values (${ron}, ${prefix + "-ron"}, 'RON'), (${eur}, ${prefix + "-eur"}, 'EUR'), (${precise}, ${prefix + "-precise"}, 'USD')`;
    await client`insert into categories (id, name) values (${category}, ${prefix + "-food"})`;
    await client`insert into imports (id, "accountId", hash) values (${ronImport}, ${ron}, ${prefix + "-r"}), (${eurImport}, ${eur}, ${prefix + "-e"}), (${preciseImport}, ${precise}, ${prefix + "-p"})`;
    const rows = [
      {
        id: randomUUID(),
        accountId: ron,
        importId: ronImport,
        date: "2041-04-01",
        description: "Synthetic salary",
        amountMinor: "100000",
        currency: "RON",
        reference: "",
        fingerprint: randomUUID(),
        categoryId: null,
      },
      {
        id: randomUUID(),
        accountId: ron,
        importId: ronImport,
        date: "2041-04-02",
        description: "Synthetic groceries",
        amountMinor: "-12345",
        currency: "RON",
        reference: "",
        fingerprint: randomUUID(),
        categoryId: category,
      },
      {
        id: randomUUID(),
        accountId: ron,
        importId: ronImport,
        date: "2041-05-01",
        description: "Synthetic transport",
        amountMinor: "-2000",
        currency: "RON",
        reference: "",
        fingerprint: randomUUID(),
        categoryId: null,
      },
      {
        id: randomUUID(),
        accountId: eur,
        importId: eurImport,
        date: "2041-04-01",
        description: "Synthetic EUR credit",
        amountMinor: "5000",
        currency: "EUR",
        reference: "",
        fingerprint: randomUUID(),
        categoryId: null,
      },
      {
        id: randomUUID(),
        accountId: eur,
        importId: eurImport,
        date: "2041-04-02",
        description: "Synthetic EUR debit",
        amountMinor: "-250",
        currency: "EUR",
        reference: "",
        fingerprint: randomUUID(),
        categoryId: category,
      },
    ];
    await client`insert into transactions ${client(rows)}`;
    // All individual rows fit the application's monetary bound; their aggregate
    // exceeds JS safe integers. No one-row oversized monetary fixture is needed.
    await client`insert into transactions (id, "accountId", "importId", date, description, "amountMinor", currency, reference, fingerprint) select gen_random_uuid(), ${precise}, ${preciseImport}, '2042-01-01', 'Synthetic precision debit', -999999999999, 'USD', '', i::text from generate_series(1, 10000) i`;
    overview = createOverview(url!);
  }, 30000);
  afterAll(async () => {
    if (client) {
      await client`delete from transactions where "accountId" in (${ron}, ${eur}, ${precise})`;
      await client`delete from imports where "accountId" in (${ron}, ${eur}, ${precise})`;
      await client`delete from accounts where id in (${ron}, ${eur}, ${precise})`;
      await client`delete from categories where id = ${category}`;
      await client.end();
    }
    await overview?.close();
  });
  it("keeps all currencies separate and computes incoming/outgoing flow exactly", async () => {
    const result = await overview.summarize({
      from: "2041-04-01",
      to: "2041-05-01",
    });
    expect(result.totals).toEqual([
      {
        currency: "EUR",
        incomeMinor: "5000",
        expenseMinor: "250",
        netMinor: "4750",
        count: 2,
      },
      {
        currency: "RON",
        incomeMinor: "100000",
        expenseMinor: "14345",
        netMinor: "85655",
        count: 3,
      },
    ]);
    expect(
      result.categories.find(
        (row) => row.currency === "RON" && row.categoryId === category,
      )?.expenseMinor,
    ).toBe("12345");
    expect(
      result.categories.find(
        (row) => row.currency === "RON" && row.categoryId === null,
      )?.expenseMinor,
    ).toBe("2000");
    expect(
      result.months.find(
        (row) => row.month === "2041-05" && row.currency === "RON",
      )?.netMinor,
    ).toBe("-2000");
  });
  it("uses inclusive dates and account filters and returns an empty report without matches", async () => {
    const filtered = await overview.summarize({
      accountId: ron,
      from: "2041-04-02",
      to: "2041-04-02",
    });
    expect(filtered.totals).toEqual([
      {
        currency: "RON",
        incomeMinor: "0",
        expenseMinor: "12345",
        netMinor: "-12345",
        count: 1,
      },
    ]);
    expect(
      await overview.summarize({ accountId: ron, from: "2043-01-01" }),
    ).toEqual({ totals: [], categories: [], months: [] });
  });
  it("aggregates the full ledger beyond 500 rows without JS integer rounding", async () => {
    const result = await overview.summarize({ accountId: precise });
    expect(result.totals).toEqual([
      {
        currency: "USD",
        incomeMinor: "0",
        expenseMinor: "9999999999990000",
        netMinor: "-9999999999990000",
        count: 10000,
      },
    ]);
    expect(result.categories[0].expenseMinor).toBe("9999999999990000");
    expect(result.months[0].netMinor).toBe("-9999999999990000");
  });
  it("compares filtered periods with exact, currency-separated reports", async () => {
    const result = await overview.compare({
      selected: { accountId: ron, from: "2041-04-01", to: "2041-04-30" },
      baseline: { accountId: ron, from: "2041-05-01", to: "2041-05-31" },
    });
    expect(result.selected.totals).toEqual([
      {
        currency: "RON",
        incomeMinor: "100000",
        expenseMinor: "12345",
        netMinor: "87655",
        count: 2,
      },
    ]);
    expect(result.baseline.totals).toEqual([
      {
        currency: "RON",
        incomeMinor: "0",
        expenseMinor: "2000",
        netMinor: "-2000",
        count: 1,
      },
    ]);
    expect(result.selected.categories[0].categoryId).toBe(category);
    expect(result.baseline.categories[0].categoryId).toBeNull();
    await expect(
      overview.compare({ selected: {}, baseline: { from: "2041-02-31" } }),
    ).rejects.toThrow();
  });
  it("rejects impossible/reversed dates and malformed account IDs", async () => {
    for (const input of [
      { from: "2041-02-31" },
      { from: "2041-05-01", to: "2041-04-01" },
      { accountId: "invalid" },
    ])
      await expect(overview.summarize(input)).rejects.toThrow();
  });
});
