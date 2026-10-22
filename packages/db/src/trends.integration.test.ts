import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createTrends } from "./trends";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Category monthly trends (fictional data)", () => {
  let client: ReturnType<typeof postgres>;
  let trends: ReturnType<typeof createTrends>;
  const account = randomUUID(),
    other = randomUUID(),
    precise = randomUUID(),
    category = randomUUID();
  const group = randomUUID();
  const batch = randomUUID(),
    otherBatch = randomUUID(),
    preciseBatch = randomUUID();
  beforeAll(async () => {
    client = postgres(url!, { max: 1, onnotice: () => {} });
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(
        new URL("../migrations", import.meta.url),
      ),
    });
    await client`insert into accounts (id, name, currency) values (${account}, ${"trends-" + account}, 'RON'), (${other}, ${"trends-" + other}, 'EUR'), (${precise}, ${"trends-" + precise}, 'USD')`;
    await client`insert into category_groups (id, name) values (${group}, ${"Synthetic group " + group})`;
    await client`insert into categories (id, name, "groupId") values (${category}, ${"Synthetic trends " + category}, ${group})`;
    await client`insert into imports (id, "accountId", hash) values (${batch}, ${account}, 'demo'), (${otherBatch}, ${other}, 'demo'), (${preciseBatch}, ${precise}, 'demo')`;
    await client`insert into transactions (id, "accountId", "importId", date, description, "amountMinor", currency, reference, fingerprint, "categoryId") select gen_random_uuid(), ${account}, ${batch}, '2077-01-01', 'Synthetic outgoing', -100, 'RON', '', i::text, ${category} from generate_series(1, 600) i`;
    const rows = [
      {
        accountId: account,
        importId: batch,
        date: "2077-01-01",
        amountMinor: 500,
        currency: "RON",
        fingerprint: "credit",
        categoryId: category,
      },
      {
        accountId: account,
        importId: batch,
        date: "2077-12-31",
        amountMinor: -42,
        currency: "RON",
        fingerprint: "lastday",
        categoryId: null,
      },
      {
        accountId: account,
        importId: batch,
        date: "2078-01-01",
        amountMinor: -99,
        currency: "RON",
        fingerprint: "nextyear",
        categoryId: null,
      },
      {
        accountId: other,
        importId: otherBatch,
        date: "2077-02-01",
        amountMinor: -321,
        currency: "EUR",
        fingerprint: "eur",
        categoryId: category,
      },
    ].map((row) => ({
      ...row,
      id: randomUUID(),
      description: "Synthetic trends fixture",
      reference: "",
    }));
    await client`insert into transactions ${client(rows)}`;
    await client`insert into transactions (id, "accountId", "importId", date, description, "amountMinor", currency, reference, fingerprint) select gen_random_uuid(), ${precise}, ${preciseBatch}, '2077-03-01', 'Synthetic precision debit', -999999999999, 'USD', '', i::text from generate_series(1, 10000) i`;
    trends = createTrends(url!);
  }, 30000);
  afterAll(async () => {
    await trends?.close();
    if (client) {
      await client`delete from transactions where "accountId" in (${account}, ${other}, ${precise})`;
      await client`delete from imports where "accountId" in (${account}, ${other}, ${precise})`;
      await client`delete from accounts where id in (${account}, ${other}, ${precise})`;
      await client`delete from categories where id = ${category}`;
      await client`delete from category_groups where id = ${group}`;
      await client.end();
    }
  });
  it("aggregates all records, excludes incoming/other years and retains uncategorized activity", async () => {
    const report = await trends.summarize({ year: 2077, accountId: account });
    expect(report.currencies).toEqual(["RON"]);
    expect(report.rows).toHaveLength(2);
    expect(report.rows[0]).toMatchObject({
      month: "2077-01",
      categoryId: category,
      expenseMinor: "60000",
      count: 600,
    });
    expect(report.rows[1]).toMatchObject({
      month: "2077-12",
      categoryId: null,
      category: "Uncategorized",
      expenseMinor: "42",
      count: 1,
    });
    expect(
      (await trends.summarize({ year: 2078, accountId: account })).rows[0]
        .expenseMinor,
    ).toBe("99");
  });
  it("separates currencies, honors currency/account intersections and retains exact sums", async () => {
    const euro = await trends.summarize({ year: 2077, currency: "EUR" });
    expect(euro.rows.every((row) => row.currency === "EUR")).toBe(true);
    expect(
      euro.rows.find((row) => row.categoryId === category)?.expenseMinor,
    ).toBe("321");
    expect(
      (
        await trends.summarize({
          year: 2077,
          accountId: account,
          currency: "EUR",
        })
      ).rows,
    ).toEqual([]);
    expect(
      (await trends.summarize({ year: 2077, accountId: precise })).rows[0],
    ).toMatchObject({ expenseMinor: "9999999999990000", count: 10000 });
  });
  it("filters grouped and ungrouped categories without losing uncategorized rows", async () => {
    const grouped = await trends.summarize({
      year: 2077,
      accountId: account,
      groupId: group,
    });
    expect(grouped.rows).toHaveLength(1);
    expect(grouped.rows[0]).toMatchObject({
      groupId: group,
      group: "Synthetic group " + group,
      expenseMinor: "60000",
    });
    const ungrouped = await trends.summarize({
      year: 2077,
      accountId: account,
      ungrouped: true,
    });
    expect(ungrouped.rows).toHaveLength(1);
    expect(ungrouped.rows[0]).toMatchObject({
      categoryId: null,
      groupId: null,
      group: "Ungrouped",
      expenseMinor: "42",
    });
  });
  it("validates year, currency and account identifiers before querying", async () => {
    for (const query of [
      { year: 9999 },
      { year: 2077, currency: "eur" },
      { year: 2077, accountId: "invalid" },
    ])
      await expect(trends.summarize(query)).rejects.toThrow();
    expect(await trends.summarize({ year: 2076, accountId: account })).toEqual({
      currencies: [],
      rows: [],
    });
  });
});
