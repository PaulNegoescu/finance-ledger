import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { parseIngCsv, reviewIngCsv } from "./index";
const csv = readFileSync(
  new URL("../../../fixtures/ing-grouped-synthetic.csv", import.meta.url),
  "utf8",
);
it("groups physical rows into three transactions with Romanian dates and exact signs", () => {
  const rows = reviewIngCsv(csv, "RON");
  expect(rows.issues).toEqual([]);
  expect(rows.rows.map((r) => [r.date, r.amountMinor, r.sourceRow])).toEqual([
    ["2026-01-01", -12550, 3],
    ["2026-01-01", 12550, 8],
    ["2026-01-02", -4725, 10],
  ]);
  expect(rows.rows[2].description).toContain("MAGAZIN FICTIV");
  expect(rows.rows[2].reference).toBe("authorization:DEMO-A2");
  expect(JSON.stringify(rows.rows)).not.toMatch(
    /CLIENT FICTIV|ACCOUNT-DEMO|0000|Data autorizarii/,
  );
  expect(parseIngCsv(csv, "RON")).toEqual(
    parseIngCsv(csv.replaceAll("\n", "\r\n"), "RON"),
  );
});
it("rejects orphan continuations and unexpected populated columns", () => {
  const header = ",Data,,,Detalii tranzactie,,,Debit,,Credit\n";
  expect(
    reviewIngCsv(header + ",,,Terminal:ORPHAN,,,,,,", "RON").issues.length,
  ).toBeGreaterThan(0);
  expect(() =>
    parseIngCsv(csv.replace(',,"47,25"', ',EXTRA,"47,25"'), "RON"),
  ).toThrow();
});
it("keeps duplicate occurrence identities stable and validates Romanian dates", () => {
  const rows = parseIngCsv(csv, "RON");
  expect(rows[0].fingerprint).not.toBe(rows[1].fingerprint);
  expect(
    reviewIngCsv(csv.replace("02 ianuarie 2026", "31 februarie 2026"), "RON")
      .issues[0].row,
  ).toBe(10);
});
