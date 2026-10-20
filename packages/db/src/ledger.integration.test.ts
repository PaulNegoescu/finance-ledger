import { beforeAll, afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createLedger } from "./index";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)(
  "PostgreSQL ledger (disposable DB; synthetic data)",
  () => {
    let ledger: ReturnType<typeof createLedger>;
    const prefix = `synthetic-${randomUUID()}`;
    const csv =
      "Data;Descriere;Debit;Credit;Valuta;Referinta\n01.10.2026;Magazin fictiv;12,34;;RON;DEMO";
    beforeAll(async () => {
      const client = postgres(url!, { max: 1 });
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
    });
    afterAll(async () => {
      await ledger?.close();
    });
    it("previews without writes and rechecks duplicates on confirmation", async () => {
      const account = `${prefix}-preview`;
      const input = { account, currency: "RON", csv };
      const first = await ledger.previewCsv(input);
      expect(first.newCount).toBe(1);
      expect(first.duplicateCount).toBe(0);
      const readOnlyCheck = postgres(url!, { max: 1 });
      try {
        expect(
          await readOnlyCheck`select id from accounts where name = ${account}`,
        ).toHaveLength(0);
      } finally {
        await readOnlyCheck.end();
      }

      expect(
        (await ledger.list()).transactions.some((t) => t.account === account),
      ).toBe(false);
      // A second import can happen after preview: confirmation must safely skip it.
      expect((await ledger.importCsv(input)).inserted).toBe(1);
      expect(await ledger.importCsv(input)).toEqual({
        inserted: 0,
        skipped: 1,
      });
      const again = await ledger.previewCsv(input);
      expect(again.newCount).toBe(0);
      expect(again.duplicateCount).toBe(1);
      expect(again.rows[0].duplicate).toBe(true);
      const invalid = await ledger.previewCsv({
        ...input,
        csv: csv + "\n31.02.2026;Bad date;1,00;;RON;",
      });
      expect(invalid.issues[0].row).toBe(3);
      const overlap = await ledger.previewCsv({
        ...input,
        csv: csv + "\n02.10.2026;New demo;2,00;;RON;",
      });
      expect([overlap.newCount, overlap.duplicateCount]).toEqual([1, 1]);
      const wrongCurrency = await ledger.previewCsv({
        ...input,
        currency: "EUR",
        csv: csv.replaceAll("RON", "EUR"),
      });
      expect(wrongCurrency.issues.some((i) => i.row === null)).toBe(true);
    });
    it("imports atomically, deduplicates concurrent and overlapping imports, preserves manual overrides", async () => {
      const input = { account: prefix, currency: "RON", csv };
      const results = await Promise.all([
        ledger.importCsv(input),
        ledger.importCsv(input),
      ]);
      expect(results.reduce((n, r) => n + r.inserted, 0)).toBe(1);
      const [category] = await ledger.addCategory({ name: `${prefix}-food` });
      const row = (await ledger.list()).transactions.find(
        (t) => t.account === prefix,
      )!;
      await ledger.assign({ id: row.id, categoryId: category.id });
      expect(
        await ledger.importCsv({
          ...input,
          csv: csv + "\n02.10.2026;Transport fictiv;5,00;;RON;DEMO-2",
        }),
      ).toEqual({ inserted: 1, skipped: 1 });
      expect(
        (await ledger.list()).transactions.find((t) => t.id === row.id)
          ?.categorySource,
      ).toBe("manual");
      const count = (await ledger.list()).transactions.length;
      await expect(
        ledger.importCsv({
          ...input,
          csv: csv + "\n31.02.2026;Invalid;3,00;;RON;",
        }),
      ).rejects.toThrow();
      expect((await ledger.list()).transactions.length).toBe(count);
      await expect(
        ledger.importCsv({
          ...input,
          currency: "EUR",
          csv: csv.replaceAll("RON", "EUR"),
        }),
      ).rejects.toThrow("altă valută");
      await expect(
        ledger.assign({ id: row.id, categoryId: randomUUID() }),
      ).rejects.toThrow();
      expect(
        (await ledger.list()).transactions.find((t) => t.id === row.id)
          ?.categoryId,
      ).toBe(category.id);
      await ledger.addRule({ contains: prefix, categoryId: category.id });
      await ledger.importCsv({
        ...input,
        csv: `Data;Descriere;Suma;Valuta\n04.10.2026;${prefix};-10,00;RON`,
      });
      const matched = (await ledger.list()).transactions.find(
        (t) => t.description === prefix,
      )!;
      expect(matched.categorySource).toBe("rule");
      await ledger.assign({ id: matched.id, categoryId: null });
      expect(
        (await ledger.list()).transactions.find((t) => t.id === matched.id)
          ?.ruleId,
      ).toBeNull();
    });
  },
);
