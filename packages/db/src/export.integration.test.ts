import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createLedger } from "./index";
import { createQueries, TransactionExportLimitError } from "./queries";
import { transactionExportLimit } from "@ledger/core/csv";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("CSV exports (fictional data)", () => {
  let ledger: ReturnType<typeof createLedger>;
  let queries: ReturnType<typeof createQueries>;
  let client: ReturnType<typeof postgres>;
  let accountId: string;
  const prefix = `export-${randomUUID()}`;
  const accountIds: string[] = [];
  const categoryIds: string[] = [];
  const groupIds: string[] = [];
  beforeAll(async () => {
    client = postgres(url!, { max: 1, onnotice: () => {} });
    await migrate(drizzle(client), {
      migrationsFolder: fileURLToPath(
        new URL("../migrations", import.meta.url),
      ),
    });
    ledger = createLedger(url!);
    queries = createQueries(url!);
    const csv =
      "Date;Description;Amount;Currency;Reference\n" +
      Array.from(
        { length: 526 },
        (_, i) =>
          `2026-01-01;Synthetic export row ${i};-1.00;RON;${prefix}-${i}`,
      ).join("\n");
    await ledger.importCsv({ account: prefix, currency: "RON", csv });
    accountId = (await ledger.metadata()).accounts.find(
      (a) => a.name === prefix,
    )!.id;
    accountIds.push(accountId);
  }, 30_000);
  afterAll(async () => {
    if (client) {
      for (const id of accountIds) {
        await client`delete from transactions where "accountId"=${id}`;
        await client`delete from imports where "accountId"=${id}`;
        await client`delete from accounts where id=${id}`;
      }
      for (const id of categoryIds)
        await client`delete from categories where id=${id}`;
      for (const id of groupIds)
        await client`delete from category_groups where id=${id}`;
      await client.end();
    }
    await ledger?.close();
    await queries?.close();
  });
  it("exports the full selection beyond pagination in the same stable order", async () => {
    const result = await queries.exportTransactions({
      accountId,
      page: 99,
      pageSize: 1,
    });
    expect(result.count).toBe(526);
    const lines = result.csv
      .replace(/^\uFEFF/, "")
      .trimEnd()
      .split("\r\n");
    expect(lines).toHaveLength(527);
    const first = await queries.listTransactions({ accountId, pageSize: 100 });
    const ids = lines
      .slice(1, 101)
      .map((line) => line.split(",").at(-1)!.replaceAll('"', ""));
    expect(ids).toEqual(first.transactions.map((row) => row.id));
    expect(
      lines
        .slice(1)
        .every((line) =>
          line.includes(
            '"-1.00","RON","Uncategorized","Ungrouped","unassigned"',
          ),
        ),
    ).toBe(true);
    expect((await queries.exportTransactions({ accountId })).csv).toBe(
      result.csv,
    );
  });
  it("uses exactly the list filters, including literal search, category, direction, currency and batch", async () => {
    const [category] = await ledger.addCategory({ name: `@${prefix}` });
    categoryIds.push(category.id);
    const [group] =
      await client`insert into category_groups (name) values (${"+Fictional group " + prefix}) returning id`;
    groupIds.push(group.id);
    await client`update categories set "groupId"=${group.id} where id=${category.id}`;
    for (const currency of ["RON", "EUR"]) {
      const name = `${prefix}-${currency}`;
      await ledger.importCsv({
        account: name,
        currency,
        csv: `Date;Description;Amount;Currency;Reference\n2026-03-01;Synthetic 100%_out;-5.00;${currency};${prefix}-out\n2026-03-02;Synthetic refund;2.00;${currency};${prefix}-in`,
      });
      const id = (await ledger.metadata()).accounts.find(
        (a) => a.name === name,
      )!.id;
      accountIds.push(id);
      const page = await queries.listTransactions({ accountId: id });
      for (const row of page.transactions)
        await ledger.assign({ id: row.id, categoryId: category.id });
    }
    const filters = {
      categoryId: category.id,
      currency: "RON",
      flow: "out",
      search: "%_",
      from: "2026-03-01",
      to: "2026-03-01",
    };
    const list = await queries.listTransactions(filters);
    const result = await queries.exportTransactions({
      ...filters,
      importId: list.transactions[0].importId,
    });
    expect(list.total).toBe(1);
    expect(result.count).toBe(1);
    expect(result.csv).toContain('"-5.00","RON","\'@');
    expect(result.csv).toContain('"manual"');
    expect(result.csv).toContain("\"'+Fictional group ");
    expect(result.csv).toContain(list.transactions[0].id);
    expect(
      (await queries.exportTransactions({ ...filters, uncategorized: true }))
        .count,
    ).toBe(0);
    expect(
      (await queries.exportTransactions({ ...filters, accountId })).count,
    ).toBe(0);
    expect(
      (
        await queries.exportTransactions({
          ...filters,
          from: "2026-03-02",
          to: "2026-03-02",
        })
      ).count,
    ).toBe(0);
    await expect(
      queries.exportTransactions({ from: "2026-02-31" }),
    ).rejects.toThrow();
  });
  it("keeps bigint precision, returns a header for an empty selection and refuses over-limit exports", async () => {
    const id = randomUUID(),
      batch = randomUUID();
    accountIds.push(id);
    await client`insert into accounts (id,name,currency) values (${id},${prefix + "-large"},'RON')`;
    await client`insert into imports (id,"accountId",hash) values (${batch},${id},${prefix + "-large"})`;
    await client`insert into transactions ("accountId","importId",date,description,"amountMinor",currency,reference,fingerprint) values (${id},${batch},'2026-03-01','Synthetic exact bigint',9223372036854775807,'RON','',${prefix + "-exact"})`;
    expect((await queries.exportTransactions({ accountId: id })).csv).toContain(
      '"92233720368547758.07"',
    );
    const empty = await queries.exportTransactions({ accountId: randomUUID() });
    expect(empty.count).toBe(0);
    expect(empty.csv.trimEnd().split("\r\n")).toHaveLength(1);
    await client`insert into transactions ("accountId","importId",date,description,"amountMinor",currency,reference,fingerprint) select ${id},${batch},'2026-03-02','Synthetic limit row',-100,'RON','',${prefix} || i::text from generate_series(1,${transactionExportLimit}) i`;
    await expect(
      queries.exportTransactions({ accountId: id }),
    ).rejects.toBeInstanceOf(TransactionExportLimitError);
    expect(
      (await queries.exportTransactions({ accountId: id, from: "2026-03-02" }))
        .count,
    ).toBe(transactionExportLimit);
  }, 30_000);
});
