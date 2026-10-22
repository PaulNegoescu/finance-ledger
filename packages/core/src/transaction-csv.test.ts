import { expect, it } from "vitest";
import { parse } from "csv-parse/sync";
import {
  decimalAmount,
  transactionCsv,
  type TransactionCsvRow,
} from "./transaction-csv";
const row: TransactionCsvRow = {
  id: "00000000-0000-4000-8000-000000000001",
  date: "2026-01-01",
  account: "Fictional account",
  description: 'Fictional, "quoted"\ntransaction',
  amountMinor: "-12345",
  currency: "RON",
  category: null,
  categoryGroup: null,
  categorySource: "unassigned",
  reference: "DEMO",
};
it("exports UTF-8 CSV with quoted multiline text, CRLF and exact monetary decimals", () => {
  const csv = transactionCsv([row]);
  expect(csv.startsWith("\uFEFF")).toBe(true);
  expect(csv.endsWith("\r\n")).toBe(true);
  expect(parse(csv, { bom: true, columns: true })).toEqual([
    {
      Date: row.date,
      Account: row.account,
      Description: row.description,
      Amount: "-123.45",
      Currency: "RON",
      Category: "Uncategorized",
      "Category group": "Ungrouped",
      "Category source": "unassigned",
      Reference: "DEMO",
      "Transaction ID": row.id,
    },
  ]);
  expect(decimalAmount("9223372036854775807")).toBe("92233720368547758.07");
  expect(decimalAmount("-9223372036854775808")).toBe("-92233720368547758.08");
  expect(decimalAmount("1")).toBe("0.01");
  expect(decimalAmount("0")).toBe("0.00");
  expect(parse(transactionCsv([]), { bom: true, columns: true })).toEqual([]);
});
it("neutralizes spreadsheet formulas in every untrusted text field without changing numeric amounts", () => {
  for (const formula of [
    "=1+1",
    "+123",
    "-1+2",
    "@SUM(A1)",
    "  =1+1",
    "\t=1+1",
    "\r=1+1",
    "\n=1+1",
    "\tplain",
    "\0=1+1",
    "\u001f=1+1",
  ]) {
    const [parsed] = parse(
      transactionCsv([
        {
          ...row,
          account: formula,
          description: formula,
          category: formula,
          categoryGroup: formula,
          reference: formula,
        },
      ]),
      { bom: true, columns: true },
    ) as Record<string, string>[];
    for (const field of [
      "Account",
      "Description",
      "Category",
      "Category group",
      "Reference",
    ])
      expect(parsed[field]).toBe("'" + formula);
    expect(parsed.Amount).toBe("-123.45");
  }
});
