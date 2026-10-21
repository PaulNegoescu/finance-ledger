import { createHash } from "node:crypto";
import type { Rule } from "./adapters/types";
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
export function date(value: string) {
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
export function categorize(description: string, rules: Rule[]) {
  return (
    [...rules]
      .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
      .find((r) => normalize(description).includes(normalize(r.contains))) ??
    null
  );
}
