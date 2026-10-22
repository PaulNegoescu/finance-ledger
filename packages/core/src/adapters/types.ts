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
export type ImportIssue = { row: number | null; message: string };
export type ImportReview = {
  rows: (LedgerRow & { sourceRow: number })[];
  issues: ImportIssue[];
};

export type ImportContent = string | Uint8Array;
// Compatibility aliases for existing CSV callers.
export type CsvIssue = ImportIssue;
export type CsvReview = ImportReview;
export type FormatHandler = {
  label: string;
  mediaTypes: readonly string[];
  review: (
    content: ImportContent,
    currency: string,
  ) => ImportReview | Promise<ImportReview>;
};
export type BankAdapter = {
  id: string;
  name: string;
  formats: Readonly<Record<string, FormatHandler>>;
};
