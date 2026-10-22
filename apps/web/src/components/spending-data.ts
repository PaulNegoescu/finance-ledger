export type SpendingCategory = {
  categoryId: string | null;
  category: string;
  currency: string;
  expenseMinor: string;
};
export function spendingReport(rows: SpendingCategory[], currency: string) {
  const ranked = rows
    .filter((row) => row.currency === currency && BigInt(row.expenseMinor) > 0n)
    .sort((a, b) => {
      const difference = BigInt(b.expenseMinor) - BigInt(a.expenseMinor);
      return difference > 0n
        ? 1
        : difference < 0n
          ? -1
          : a.category.localeCompare(b.category) ||
            (a.categoryId ?? "").localeCompare(b.categoryId ?? "");
    });
  const total = ranked.reduce((sum, row) => sum + BigInt(row.expenseMinor), 0n);
  const share = (value: string) => {
    const minor = BigInt(value);
    const hundredths = total ? (minor * 10_000n) / total : 0n;
    return minor > 0n && hundredths === 0n
      ? "<0.01%"
      : `${hundredths / 100n}.${String(hundredths % 100n).padStart(2, "0")}%`;
  };
  const chart = ranked
    .slice(0, 8)
    .map((row) => ({ ...row, key: row.categoryId ?? "uncategorized" }));
  if (ranked.length > 8) {
    chart.push({
      key: "remaining",
      categoryId: null,
      category: `Remaining categories (${ranked.length - 8})`,
      currency,
      expenseMinor: ranked
        .slice(8)
        .reduce((sum, row) => sum + BigInt(row.expenseMinor), 0n)
        .toString(),
    });
  }
  const maximum = chart.reduce(
    (max, row) =>
      BigInt(row.expenseMinor) > max ? BigInt(row.expenseMinor) : max,
    0n,
  );
  return {
    ranked,
    chart: chart.map((row) => ({
      ...row,
      width: maximum
        ? Number((BigInt(row.expenseMinor) * 10_000n) / maximum) / 100
        : 0,
    })),
    total: total.toString(),
    share,
  };
}
export function spendingAmount(minor: string, currency: string) {
  const value = BigInt(minor);
  const absolute = value < 0n ? -value : value;
  return `${currency} ${value < 0n ? "-" : ""}${new Intl.NumberFormat("en-GB").format(absolute / 100n)}.${String(absolute % 100n).padStart(2, "0")}`;
}
