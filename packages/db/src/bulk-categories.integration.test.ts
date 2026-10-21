import { afterAll, beforeAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createLedger } from "./index";
import { createBulkCategories } from "./bulk-categories";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("Bulk manual categorization (synthetic data)", () => {
  let ledger: ReturnType<typeof createLedger>;
  let bulk: ReturnType<typeof createBulkCategories>;
  let inspect: ReturnType<typeof postgres>;
  const prefix = `bulk-${randomUUID()}`;
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
    bulk = createBulkCategories(url!);
    inspect = postgres(url!, { max: 1, onnotice: () => {} });
  });
  afterAll(async () => {
    await Promise.all([ledger?.close(), bulk?.close(), inspect?.end()]);
  });
  it("updates all selected rows atomically, replaces rule provenance, and clears explicitly", async () => {
    const [category] = await ledger.addCategory({ name: prefix });
    const [other] = await ledger.addCategory({ name: `${prefix}-other` });
    await ledger.addRule({ contains: prefix, categoryId: category.id });
    await ledger.importCsv({
      account: prefix,
      currency: "RON",
      csv: `Date;Description;Amount;Currency\n2026-10-01;${prefix} one;-1.00;RON\n2026-10-02;${prefix} two;-2.00;RON`,
    });
    const rows = () =>
      inspect`select t.id,t."categoryId",t."categorySource",t."ruleId" from transactions t join accounts a on a.id=t."accountId" where a.name=${prefix}`;
    const initial = await rows();
    const ids = initial.map((row) => row.id as string);
    expect(
      initial.every((row) => row.categorySource === "rule" && row.ruleId),
    ).toBe(true);
    await expect(
      bulk.assign({ ids: [ids[0], randomUUID()], categoryId: other.id }),
    ).rejects.toThrow();
    expect(await rows()).toEqual(initial);
    await expect(
      bulk.assign({ ids, categoryId: randomUUID() }),
    ).rejects.toThrow();
    expect(await rows()).toEqual(initial);
    await expect(
      bulk.assign({ ids: [ids[0], ids[0]], categoryId: other.id }),
    ).rejects.toThrow();
    await expect(bulk.assign({ ids: [], categoryId: null })).rejects.toThrow();
    expect(await bulk.assign({ ids, categoryId: other.id })).toEqual({
      updated: 2,
    });
    expect(
      (await rows()).every(
        (row) =>
          row.categoryId === other.id &&
          row.categorySource === "manual" &&
          row.ruleId === null,
      ),
    ).toBe(true);
    expect(await bulk.assign({ ids, categoryId: null })).toEqual({
      updated: 2,
    });
    expect(
      (await rows()).every(
        (row) =>
          row.categoryId === null &&
          row.categorySource === "unassigned" &&
          row.ruleId === null,
      ),
    ).toBe(true);
  });
});
