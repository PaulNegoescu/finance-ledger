export type TrendRow = {
  month: string;
  currency: string;
  categoryId: string | null;
  category: string;
  expenseMinor: string;
  count: number;
  groupId?: string | null;
  group?: string;
};
const palette = [
  "#287e83",
  "#af754e",
  "#566d95",
  "#82964c",
  "#8a638b",
  "#4d8d70",
  "#b08034",
  "#5a8d9f",
];
export function trendColor(id: string | null) {
  let hash = 0;
  for (const char of id ?? "uncategorized")
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
export function trendAmount(value: string | bigint, currency: string) {
  const minor = BigInt(value);
  return `${currency} ${new Intl.NumberFormat("en-GB").format(minor / 100n)}.${String(minor % 100n).padStart(2, "0")}`;
}
export function trendRatio(value: bigint, maximum: bigint) {
  return maximum > 0n ? Number((value * 10000n) / maximum) / 10000 : 0;
}
export function categoryTrends(
  rows: readonly TrendRow[],
  year: number,
  currency: string,
) {
  const months = Array.from(
    { length: 12 },
    (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
  );
  const grouped = new Map<
    string | null,
    {
      id: string | null;
      name: string;
      total: bigint;
      values: bigint[];
      counts: number[];
      color: string;
      groupId: string | null;
      group: string;
    }
  >();
  for (const row of rows) {
    const month = months.indexOf(row.month);
    if (row.currency !== currency || month < 0) continue;
    let category = grouped.get(row.categoryId);
    if (!category) {
      category = {
        id: row.categoryId,
        groupId: row.groupId ?? null,
        group: row.group ?? "Ungrouped",
        name: row.category,
        total: 0n,
        values: months.map(() => 0n),
        counts: months.map(() => 0),
        color: trendColor(row.categoryId),
      };
      grouped.set(row.categoryId, category);
    }
    category.values[month] += BigInt(row.expenseMinor);
    category.counts[month] += row.count;
    category.total += BigInt(row.expenseMinor);
  }
  const categories = [...grouped.values()].sort((a, b) =>
    a.total === b.total
      ? a.name.localeCompare(b.name)
      : a.total > b.total
        ? -1
        : 1,
  );
  const totals = months.map((_, i) =>
    categories.reduce((sum, category) => sum + category.values[i], 0n),
  );
  const maximum = totals.reduce(
    (max, value) => (value > max ? value : max),
    0n,
  );
  const maxCell = categories.reduce(
    (max, category) => category.values.reduce((a, b) => (a > b ? a : b), max),
    0n,
  );
  const visible = categories.slice(0, 5);
  const colors = new Map(
    [...visible]
      .sort((a, b) => (a.id ?? "").localeCompare(b.id ?? ""))
      .map((category, index) => [category.id, palette[index]]),
  );
  const series = visible.map((category) => ({
    key: category.id ?? "uncategorized",
    name: category.name,
    values: category.values,
    color: colors.get(category.id)!,
  }));
  if (categories.length > 5)
    series.push({
      key: "other",
      name: "Other categories",
      values: months.map((_, i) =>
        categories
          .slice(5)
          .reduce((sum, category) => sum + category.values[i], 0n),
      ),
      color: "#8a969e",
    });
  const observed = totals
    .map((value, i) => (value > 0n ? i : -1))
    .filter((i) => i >= 0);
  return {
    months,
    categories,
    totals,
    maximum,
    maxCell,
    series,
    first: observed[0] ?? 0,
    last: observed.at(-1) ?? -1,
    total: totals.reduce((sum, value) => sum + value, 0n),
  };
}
