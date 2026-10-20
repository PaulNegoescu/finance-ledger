import { describe, expect, it } from "vitest";
import { categorize, money, parseIngCsv } from "./index";
const header = "Data;Descriere;Debit;Credit;Valuta;Referinta\n";
describe("ING CSV profile (synthetic data only)", () => {
  it("handles BOM, Romanian money, quotes, CRLF and duplicate legitimate rows", () => {
    const csv =
      "\uFEFF" +
      header +
      '01.10.2026;"Magazin; fictiv";1.234,56;;RON;\r\n01.10.2026;"Magazin; fictiv";1.234,56;;RON;';
    const rows = parseIngCsv(csv, "RON");
    expect(rows.map((r) => r.amountMinor)).toEqual([-123456, -123456]);
    expect(rows[0].date).toBe("2026-10-01");
    expect(rows[0].fingerprint).not.toBe(rows[1].fingerprint);
    expect(parseIngCsv(csv, "RON")).toEqual(rows);
  });
  it("supports signed amounts and quoted comma decimals", () => {
    expect(
      parseIngCsv(
        'Date,Description,Amount,Currency\n2026-10-01,Example,"-12,34",RON',
        "RON",
      )[0].amountMinor,
    ).toBe(-1234);
  });
  it.each([
    "31.02.2026;Exemplu;10,00;;RON;",
    "01.10.2026;Exemplu;10,00;20,00;RON;",
    "01.10.2026;Exemplu;10,00;;EUR;",
    "01.10.2026;Exemplu;abc;;RON;",
  ])("rejects bad rows atomically: %s", (row) => {
    expect(() => parseIngCsv(header + row, "RON")).toThrow("Rândul 2");
  });
  it("rejects unknown, duplicate and ambiguous headers and broken quotes", () => {
    for (const csv of [
      "foo;bar\na;b",
      "Data;Data;Descriere;Suma\na;b;c;d",
      "Data;Descriere;Suma;Debit;Credit\na;b;1;2;3",
      header + '"broken',
    ])
      expect(() => parseIngCsv(csv, "RON")).toThrow("CSV invalid");
  });
  it("preserves exact cents and refuses ambiguous precision", () => {
    expect(money("0,29")).toBe(29);
    expect(money("-1 234,56")).toBe(-123456);
    expect(() => money("1.234")).toThrow();
  });
  it("uses explicit deterministic priority and leaves unmatched rows manual", () => {
    const rules = [
      { id: "b", contains: "magazin", categoryId: "food", priority: 2 },
      { id: "a", contains: "FICTÍV", categoryId: "other", priority: 1 },
    ];
    expect(categorize("Magazin fictiv", rules)?.categoryId).toBe("other");
    expect(categorize("Necunoscut", rules)).toBeNull();
  });
});
