import { beforeAll, afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createLedger } from "./index";
import { createQueries } from "./queries";
import { createImportHistory } from "./import-history";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Import history (synthetic data)", () => {
  let ledger: ReturnType<typeof createLedger>;
  let history: ReturnType<typeof createImportHistory>;
  let accountId: string;
  let secondAccountId: string;
  const prefix = `history-${randomUUID()}`;
  const header = "Date;Description;Amount;Currency;Reference\n";
  const first = "2026-02-01;Synthetic coffee;-2.00;RON;DEMO-1";
  const second = "2026-02-02;Synthetic grocery;-3.00;RON;DEMO-2";
  const third = "2026-02-03;Synthetic transport;-4.00;RON;DEMO-3";
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
    history = createImportHistory(url!);
    const input = {
      account: prefix,
      currency: "RON",
      csv: header + first + "\n" + second,
    };
    expect(await ledger.importCsv(input)).toEqual({ inserted: 2, skipped: 0 });
    expect(await ledger.importCsv(input)).toEqual({ inserted: 0, skipped: 2 });
    expect(
      await ledger.importCsv({ ...input, csv: input.csv + "\n" + third }),
    ).toEqual({ inserted: 1, skipped: 2 });
    expect(
      await ledger.importCsv({ ...input, csv: header + second + "\n" + first }),
    ).toEqual({ inserted: 0, skipped: 2 });
    await ledger.importCsv({ ...input, account: `${prefix}-other` });
    const metadata = await ledger.metadata();
    accountId = metadata.accounts.find(
      (account) => account.name === prefix,
    )!.id;
    secondAccountId = metadata.accounts.find(
      (account) => account.name === `${prefix}-other`,
    )!.id;
  });
  afterAll(async () => {
    await ledger?.close();
    await history?.close();
  });
  it("lists batches with exact current transaction counts and excludes exact-file reimports", async () => {
    const result = await history.list({ accountId });
    expect(result.total).toBe(3);
    expect(
      result.imports.map((batch) => batch.transactionCount).sort(),
    ).toEqual([0, 1, 2]);
    expect(
      result.imports.every(
        (batch) => batch.account === prefix && batch.currency === "RON",
      ),
    ).toBe(true);
    for (const batch of result.imports) {
      expect(Object.keys(batch).sort()).toEqual(
        [
          "account",
          "adapterId",
          "format",
          "inputCount",
          "skippedCount",
          "createdAt",
          "currency",
          "id",
          "transactionCount",
        ].sort(),
      );
      expect(batch.adapterId).toBe("ing");
      expect(batch.format).toBe("csv");
      expect(batch.inputCount).toBe(
        batch.transactionCount + batch.skippedCount!,
      );
      expect(Number.isFinite(Date.parse(batch.createdAt))).toBe(true);
    }
    const other = await history.list({ accountId: secondAccountId });
    expect(other.total).toBe(1);
    expect(other.imports[0].transactionCount).toBe(2);
  });
  it("opens exactly the transactions added by each batch and composes filters", async () => {
    const queries = createQueries(url!);
    try {
      const result = await history.list({ accountId });
      for (const batch of result.imports) {
        const page = await queries.listTransactions({ importId: batch.id });
        expect(page.total).toBe(batch.transactionCount);
        expect(
          page.transactions.every((row) => row.importId === batch.id),
        ).toBe(true);
        expect(
          (
            await queries.listTransactions({
              importId: batch.id,
              accountId: secondAccountId,
            })
          ).total,
        ).toBe(0);
        expect(
          (
            await queries.listTransactions({
              importId: batch.id,
              search: "absent text",
            })
          ).total,
        ).toBe(0);
      }
      expect(
        (await queries.listTransactions({ importId: randomUUID() })).total,
      ).toBe(0);
      await expect(
        queries.listTransactions({ importId: "invalid" }),
      ).rejects.toThrow();
    } finally {
      await queries.close();
    }
  });
  it("keeps legacy counts unavailable and enforces atomic count pairs", async () => {
    const client = postgres(url!, { max: 1 });
    try {
      const [account] =
        await client`insert into accounts (name, currency) values (${prefix + "-legacy"}, 'RON') returning id`;
      const [batch] =
        await client`insert into imports ("accountId", hash) values (${account.id}, 'synthetic-legacy') returning id`;
      const result = await history.list({ accountId: account.id });
      expect(result.imports[0]).toMatchObject({
        id: batch.id,
        adapterId: "ing",
        format: "csv",
        inputCount: null,
        skippedCount: null,
        transactionCount: 0,
      });
      await expect(
        client`update imports set "inputCount" = 2 where id = ${batch.id}`,
      ).rejects.toThrow();
      await expect(
        client`update imports set "inputCount" = 2, "skippedCount" = 3 where id = ${batch.id}`,
      ).rejects.toThrow();
    } finally {
      await client.end();
    }
  });
  it("paginates stably and clamps an out-of-range page", async () => {
    const firstPage = await history.list({ accountId, pageSize: 2 });
    const lastPage = await history.list({ accountId, pageSize: 2, page: 100 });
    expect(firstPage.imports).toHaveLength(2);
    expect(lastPage.page).toBe(2);
    expect(lastPage.imports).toHaveLength(1);
    expect(
      new Set(
        [...firstPage.imports, ...lastPage.imports].map((batch) => batch.id),
      ).size,
    ).toBe(3);
    expect(
      (await history.list({ accountId, pageSize: 2 })).imports.map(
        (batch) => batch.id,
      ),
    ).toEqual(firstPage.imports.map((batch) => batch.id));
    const empty = await history.list({ accountId: randomUUID(), page: 50 });
    expect(empty).toEqual({ imports: [], total: 0, page: 1, pageSize: 20 });
  });
  it("rejects invalid pagination and account identifiers", async () => {
    for (const input of [
      { page: 0 },
      { pageSize: 101 },
      { accountId: "invalid" },
    ])
      await expect(history.list(input)).rejects.toThrow();
  });
});
