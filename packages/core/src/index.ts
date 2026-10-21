import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { z } from "zod";

export * from "./validation";
export type LedgerRow = {
  date: string;
  description: string;
  amountMinor: number;
  currency: string;
  reference: string;
  fingerprint: string;
};
export type Rule = {
  id: string;
  contains: string;
  categoryId: string;
  priority: number;
};
export const hash = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

// Integer minor units only: never parse monetary values through floating point.
export function money(value: string): number {
  let text = value.trim().replace(/[\u00a0\u202f]/g, " ");
  // Spaces are permitted only as complete thousands groups, never inside digits.
  if (text.includes(" ")) {
    if (!/^-?\d{1,3}( \d{3})+([.,]\d{1,2})?$/.test(text))
      throw new Error("Invalid thousands grouping in amount.");
    text = text.replace(/ /g, "");
  }
  if (/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(text))
    text = text.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d{2}$/.test(text)) text = text.replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(text))
    throw new Error(
      "Invalid or ambiguous amount. Use at most two decimal places.",
    );
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 999_999_999_999)
    throw new Error("Amount is too large.");
  return negative ? -result : result;
}
function date(value: string) {
  let result = value.trim();
  const ro = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(result);
  if (ro) result = `${ro[3]}-${ro[2]}-${ro[1]}`;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(result) ||
    !Number.isFinite(Date.parse(result)) ||
    new Date(result).toISOString().slice(0, 10) !== result
  )
    throw new Error("Invalid date. Use DD.MM.YYYY, DD/MM/YYYY or YYYY-MM-DD.");
  return result;
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
export type CsvIssue = { row: number | null; message: string };
export type CsvReview = {
  rows: (LedgerRow & { sourceRow: number })[];
  issues: CsvIssue[];
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
  try {
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
        {
          row: null,
          message: "The file must contain between 1 and 5000 transactions.",
        },
      ],
    };
  const issues: CsvIssue[] = [];
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
        date: date(r.date ?? ""),
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
export function categorize(description: string, rules: Rule[]) {
  return (
    [...rules]
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .find((r) => normalize(description).includes(normalize(r.contains))) ??
    null
  );
}
