import { spendingReport, type SpendingCategory } from "./spending-data";
type GroupedCategory = SpendingCategory & {
  groupId?: string | null;
  group?: string;
};
export function groupSpending(rows: GroupedCategory[], currency: string) {
  const groups = new Map<string | null, SpendingCategory>();
  for (const row of rows) {
    if (row.currency !== currency || BigInt(row.expenseMinor) <= 0n) continue;
    const id = row.groupId ?? null;
    const previous = groups.get(id);
    groups.set(id, {
      categoryId: id,
      category: id === null ? "Ungrouped" : (row.group ?? "Unnamed group"),
      currency,
      expenseMinor: (
        BigInt(previous?.expenseMinor ?? "0") + BigInt(row.expenseMinor)
      ).toString(),
    });
  }
  return spendingReport([...groups.values()], currency);
}
