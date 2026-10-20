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
  let text = value.trim().replace(/[\s\u00a0]/g, "");
  if (/^-?\d{1,3}(\.\d{3})*,\d{2}$/.test(text))
    text = text.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d{2}$/.test(text)) text = text.replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(text))
    throw new Error("Sumă invalidă sau ambiguă. Folosește două zecimale.");
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace("-", "").split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(result) || result > 999_999_999_999)
    throw new Error("Sumă prea mare.");
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
    throw new Error("Dată invalidă.");
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
export function parseIngCsv(csv: string, currency: string): LedgerRow[] {
  const clean = csv.replace(/^\uFEFF/, "");
  const first = clean.split(/\r?\n/)[0] ?? "";
  const delimiter = first.includes(";") ? ";" : ",";
  let records: Record<string, string>[];
  try {
    records = parse(clean, {
      delimiter,
      skip_empty_lines: true,
      trim: true,
      columns: (headers: string[]) => {
        const mapped = headers.map(
          (h) => aliases[normalize(h)] ?? normalize(h),
        );
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
      },
    });
  } catch {
    throw new Error(
      "CSV invalid. Verifică antetul, separatorul și ghilimelele conform profilului documentat.",
    );
  }
  if (!records.length || records.length > 5000)
    throw new Error(
      "Importul trebuie să conțină între 1 și 5000 de tranzacții.",
    );
  const occurrences = new Map<string, number>();
  return records.map((r, index) => {
    try {
      const rowCurrency = (r.currency || currency).trim().toUpperCase();
      if (rowCurrency !== currency)
        throw new Error("Valuta diferă de valuta contului.");
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
            "Debit/credit trebuie să fie pozitive, cu o singură valoare nenulă.",
          );
        amountMinor = credit - debit;
      }
      if (amountMinor === 0) throw new Error("Tranzacție cu sumă zero.");
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
      return { ...row, fingerprint: hash(`${identity}:${occurrence}`) };
    } catch (error) {
      throw new Error(
        `Rândul ${index + 2}: ${error instanceof z.ZodError ? "Descriere sau referință invalidă." : (error as Error).message}`,
      );
    }
  });
}
export function categorize(description: string, rules: Rule[]) {
  return (
    [...rules]
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .find((r) => normalize(description).includes(normalize(r.contains))) ??
    null
  );
}
