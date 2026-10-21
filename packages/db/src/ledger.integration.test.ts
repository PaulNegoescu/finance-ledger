import { beforeAll, afterAll, describe, expect, it } from "vitest";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
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
    it("uses account IDs authoritatively and rejects stale or duplicate creation", async () => {
      const name = `${prefix}-identity`;
      await ledger.importCsv({
        account: name,
        currency: "RON",
        csv,
        createAccount: true,
      });
      const account = (await ledger.list()).accounts.find(
        (item) => item.name === name,
      )!;
      const nextCsv = csv.replace("01.10.2026", "02.10.2026");
      await ledger.importCsv({
        accountId: account.id,
        account: `${name}-wrong-name`,
        currency: "RON",
        csv: nextCsv,
      });
      expect(
        (await ledger.list()).accounts.some(
          (item) => item.name === `${name}-wrong-name`,
        ),
      ).toBe(false);
      expect(
        (
          await ledger.previewCsv({
            accountId: account.id,
            account: "Ignored",
            currency: "RON",
            csv: nextCsv,
          })
        ).duplicateCount,
      ).toBe(1);
      const stale = {
        accountId: randomUUID(),
        account: `${name}-missing`,
        currency: "RON",
        csv,
      };
      expect(
        (await ledger.previewCsv(stale)).issues.some((issue) =>
          issue.message.includes("no longer exists"),
        ),
      ).toBe(true);
      await expect(ledger.importCsv(stale)).rejects.toThrow("not found");
      const duplicate = {
        account: name.toUpperCase(),
        currency: "RON",
        csv,
        createAccount: true,
      };
      expect(
        (await ledger.previewCsv(duplicate)).issues.some((issue) =>
          issue.message.includes("already exists"),
        ),
      ).toBe(true);
      await expect(ledger.importCsv(duplicate)).rejects.toThrow(
        "already exists",
      );
      const create = {
        account: `${prefix}-race`,
        currency: "RON",
        csv,
        createAccount: true,
      };
      const attempts = await Promise.allSettled([
        ledger.importCsv(create),
        ledger.importCsv({ ...create, account: create.account.toUpperCase() }),
      ]);
      expect(
        attempts.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        attempts.filter((result) => result.status === "rejected"),
      ).toHaveLength(1);
    });
    it("routes grouped ING CSV through the adapter and rejects unsupported formats without writes", async () => {
      const input = {
        account: `${prefix}-grouped`,
        currency: "RON",
        createAccount: true,
        adapterId: "ing",
        format: "csv",
        csv: readFileSync(
          new URL(
            "../../../fixtures/ing-grouped-synthetic.csv",
            import.meta.url,
          ),
          "utf8",
        ),
      };
      const preview = await ledger.previewCsv(input);
      expect(preview.issues).toEqual([]);
      expect(preview.newCount).toBe(3);
      expect(preview.rows.map((row) => row.amountMinor)).toEqual([
        -12550, 12550, -4725,
      ]);
      expect(await ledger.importCsv(input)).toEqual({
        inserted: 3,
        skipped: 0,
      });
      const account = (await ledger.list()).accounts.find(
        (row) => row.name === input.account,
      )!;
      expect(
        await ledger.importCsv({
          ...input,
          accountId: account.id,
          createAccount: false,
        }),
      ).toEqual({ inserted: 0, skipped: 3 });
      const unsupported = {
        ...input,
        account: `${prefix}-unsupported`,
        format: "pdf",
      };
      expect((await ledger.previewCsv(unsupported)).issues).toHaveLength(1);
      await expect(ledger.importCsv(unsupported)).rejects.toThrow("validation");
      expect(
        (await ledger.list()).accounts.some(
          (row) => row.name === unsupported.account,
        ),
      ).toBe(false);
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
