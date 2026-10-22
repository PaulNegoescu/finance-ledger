export const transactionExportLimit = 10_000;
export type TransactionCsvRow = {
  id: string;
  date: string;
  account: string;
  description: string;
  amountMinor: string;
  currency: string;
  category: string | null;
  categoryGroup: string | null;
  categorySource: string;
  reference: string;
};
export function decimalAmount(minor: string) {
  const value = BigInt(minor);
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}
function cell(value: string, text = true) {
  // Quote CSV syntax separately from spreadsheet formulas. Quoting alone does
  // not stop formulas when a spreadsheet opens a CSV file.
  const safe =
    text &&
    (/^[\s\u0000-\u0020\u007f-\u009f\uFEFF]*[=+@-]/u.test(value) ||
      /^[\t\r\n]/.test(value))
      ? `'${value}`
      : value;
  return `"${safe.replaceAll('"', '\"\"')}"`;
}
export function transactionCsv(rows: readonly TransactionCsvRow[]) {
  const header = [
    "Date",
    "Account",
    "Description",
    "Amount",
    "Currency",
    "Category",
    "Category group",
    "Category source",
    "Reference",
    "Transaction ID",
  ];
  const lines = [header.map((value) => cell(value)).join(",")];
  for (const row of rows) {
    lines.push(
      [
        cell(row.date),
        cell(row.account),
        cell(row.description),
        cell(decimalAmount(row.amountMinor), false),
        cell(row.currency),
        cell(row.category ?? "Uncategorized"),
        cell(row.categoryGroup ?? "Ungrouped"),
        cell(row.categorySource),
        cell(row.reference),
        cell(row.id),
      ].join(","),
    );
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
