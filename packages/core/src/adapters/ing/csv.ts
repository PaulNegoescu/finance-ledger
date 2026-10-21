import { parse } from "csv-parse/sync";
import { z } from "zod";
import { groupedHomebank } from "./grouped-csv";
import { hash, normalize, money, date } from "../../shared";
import type { LedgerRow, CsvReview, CsvIssue } from "../types";
function ingDate(value: string) {
  let result = value.trim();
  const months = [
    "ianuarie",
    "februarie",
    "martie",
    "aprilie",
    "mai",
    "iunie",
    "iulie",
    "august",
    "septembrie",
    "octombrie",
    "noiembrie",
    "decembrie",
  ];
  const words = /^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/.exec(normalize(result));
  if (words && months.includes(words[2]))
    result = `${words[3]}-${String(months.indexOf(words[2]) + 1).padStart(2, "0")}-${words[1].padStart(2, "0")}`;
  return date(result);
}

const aliases: Record<string, string> = {
  data: "date",
  "data tranzactiei": "date",
  "data tranzactie": "date",
  date: "date",
  descriere: "description",
  detalii: "description",
  "detalii tranzactie": "description",
  description: "description",
  suma: "amount",
  amount: "amount",
  debit: "debit",
  credit: "credit",
  valuta: "currency",
  moneda: "currency",
  currency: "currency",
  referinta: "reference",
  reference: "reference",
};
function mapHeaders(headers: string[]) {
  const mapped = headers.map((h) => aliases[normalize(h)] ?? normalize(h));
  if (new Set(mapped).size !== mapped.length)
    throw new Error("duplicate headers");
  if (
    !mapped.includes("date") ||
    !mapped.includes("description") ||
    (!mapped.includes("amount") &&
      !(mapped.includes("debit") && mapped.includes("credit")))
  )
    throw new Error("headers");
  if (
    mapped.includes("amount") &&
    (mapped.includes("debit") || mapped.includes("credit"))
  )
    throw new Error("ambiguous amount columns");
  return mapped;
}

function detectDelimiter(csv: string) {
  // Parse the first logical record for each candidate so quoted punctuation and
  // multiline fields do not influence delimiter selection.
  const candidates = [";", ","].filter((delimiter) => {
    try {
      const [headers] = parse(csv, {
        delimiter,
        to: 1,
        skip_empty_lines: true,
        trim: true,
      }) as string[][];
      mapHeaders(headers ?? []);
      return true;
    } catch {
      return false;
    }
  });
  if (candidates.length !== 1) throw new Error("unknown delimiter or headers");
  return candidates[0];
}

export function reviewIngCsv(csv: string, currency: string): CsvReview {
  const clean = csv.replace(/^\uFEFF/, "");
  let records: { record: Record<string, string>; info: { lines: number } }[];
  let adapterIssues: CsvIssue[] = [];
  try {
    const grouped = groupedHomebank(clean);
    if (grouped) {
      records = grouped.records;
      adapterIssues = grouped.issues;
    } else
      records = parse(clean, {
        delimiter: detectDelimiter(clean),
        info: true,
        skip_empty_lines: true,
        trim: true,
        columns: mapHeaders,
      });
  } catch (error) {
    const line = (error as { lines?: number }).lines;
    return {
      rows: [],
      issues: [
        {
          row: line ?? null,
          message:
            "Invalid CSV. Check headers, delimiters, column counts and quotation marks.",
        },
      ],
    };
  }
  if (!records.length || records.length > 5000)
    return {
      rows: [],
      issues: [
        ...adapterIssues,
        {
          row: null,
          message: "The file must contain between 1 and 5000 transactions.",
        },
      ],
    };
  const issues: CsvIssue[] = [...adapterIssues];
  const rows: CsvReview["rows"] = [];
  const occurrences = new Map<string, number>();
  for (const { record: r, info } of records) {
    try {
      const rowCurrency = (r.currency || currency).trim().toUpperCase();
      if (rowCurrency !== currency)
        throw new Error(
          "Currency does not match the selected account currency.",
        );
      const description = z
        .string()
        .trim()
        .min(1)
        .max(2000)
        .parse(r.description);
      const reference = z
        .string()
        .max(200)
        .parse(r.reference ?? "");
      let amountMinor: number;
      if (r.amount !== undefined) amountMinor = money(r.amount);
      else {
        const debit = r.debit ? money(r.debit) : 0;
        const credit = r.credit ? money(r.credit) : 0;
        if (debit < 0 || credit < 0 || (debit !== 0 && credit !== 0))
          throw new Error(
            "Debit and credit must be positive, with only one non-zero value.",
          );
        amountMinor = credit - debit;
      }
      if (amountMinor === 0) throw new Error("Amount must not be zero.");
      const row = {
        date: ingDate(r.date ?? ""),
        description,
        amountMinor,
        currency: rowCurrency,
        reference,
      };
      const identity = hash(
        JSON.stringify([
          row.date,
          normalize(description),
          amountMinor,
          rowCurrency,
          reference,
        ]),
      );
      const occurrence = (occurrences.get(identity) ?? 0) + 1;
      occurrences.set(identity, occurrence);
      rows.push({
        ...row,
        fingerprint: hash(`${identity}:${occurrence}`),
        sourceRow: info.lines,
      });
    } catch (error) {
      issues.push({
        row: info.lines,
        message:
          error instanceof z.ZodError
            ? "Description must contain 1–2000 characters; reference must be at most 200 characters."
            : (error as Error).message,
      });
    }
  }
  return { rows, issues };
}
export function parseIngCsv(csv: string, currency: string): LedgerRow[] {
  const review = reviewIngCsv(csv, currency);
  if (review.issues.length) {
    const issue = review.issues[0];
    throw new Error(`${issue.row ? `Row ${issue.row}: ` : ""}${issue.message}`);
  }
  return review.rows.map(({ sourceRow, ...row }) => row);
}
