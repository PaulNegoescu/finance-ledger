import { parse } from "csv-parse/sync";

type RecordLine = { record: Record<string, string>; info: { lines: number } };
type Issue = { row: number | null; message: string };
const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

// Home'Bank's grouped export shifts header labels one column to the right.
// This adapter deliberately accepts only the two verified header positions.
export function groupedHomebank(
  csv: string,
): { records: RecordLine[]; issues: Issue[] } | null {
  const first = csv.trimStart().split(/\r?\n/)[0] ?? "";
  if (!/^(Titular cont:|,?Data,,,Detalii tranzac)/i.test(first)) return null;
  const lines = parse(csv, {
    delimiter: ",",
    info: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  }) as unknown as { record: string[]; info: { lines: number } }[];
  const records: RecordLine[] = [];
  const issues: Issue[] = [];
  let header = false;
  let current: RecordLine | undefined;
  for (const { record: cells, info } of lines) {
    if (cells.every((cell) => !cell)) continue;
    if (!header) {
      if (
        key(cells[0] ?? "").startsWith("titular cont:") &&
        cells.slice(1).every((cell) => !cell)
      )
        continue;
      const labels = cells.map(key);
      const shifted =
        labels[1] === "data" &&
        labels[4] === "detalii tranzactie" &&
        labels[7] === "debit" &&
        labels[9] === "credit";
      const aligned =
        labels[0] === "data" &&
        labels[3] === "detalii tranzactie" &&
        labels[6] === "debit" &&
        labels[8] === "credit";
      const positions = shifted ? [1, 4, 7, 9] : [0, 3, 6, 8];
      if (
        (shifted || aligned) &&
        cells.every((cell, index) => !cell || positions.includes(index))
      ) {
        header = true;
        continue;
      }
      issues.push({
        row: info.lines,
        message: "Unrecognized Home’Bank preamble or header.",
      });
      continue;
    }
    const allowed = [0, 3, 6, 8];
    if (cells.some((cell, index) => cell && !allowed.includes(index))) {
      issues.push({
        row: info.lines,
        message: "Unexpected content outside Home’Bank transaction columns.",
      });
      continue;
    }
    if (cells[0]) {
      current = {
        record: {
          date: cells[0],
          description: cells[3] ?? "",
          debit: cells[6] ?? "",
          credit: cells[8] ?? "",
          reference: "",
        },
        info: { lines: info.lines },
      };
      records.push(current);
    } else {
      if (!current || cells[6] || cells[8] || !cells[3]) {
        issues.push({
          row: info.lines,
          message: "Invalid or orphaned Home’Bank continuation row.",
        });
        continue;
      }
      const detail = cells[3];
      const normalized = key(detail);
      if (normalized.startsWith("terminal:"))
        current.record.description += ` · ${detail}`;
      else if (normalized.startsWith("numar autorizare:"))
        current.record.reference = `authorization:${detail.slice(detail.indexOf(":") + 1).trim()}`;
      else if (
        !/^(numar card:|data autorizarii:|din contul:)/.test(normalized)
      ) {
        // Unknown continuation details must be reviewed rather than silently lost.
        current.record.description += ` · ${detail}`;
      }
    }
  }
  if (!header)
    issues.push({
      row: null,
      message: "Missing Home’Bank transaction header.",
    });
  return { records, issues };
}
