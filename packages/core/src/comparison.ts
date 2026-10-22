export type PeriodTotal = {
  currency: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  count: number;
};
export type PeriodCategory = {
  currency: string;
  categoryId: string | null;
  category: string;
  expenseMinor: string;
};
export type PeriodSummary = {
  totals: PeriodTotal[];
  categories: PeriodCategory[];
};

export function monthRange(month: string) {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error("Choose a valid month.");
  const [year, number] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${lastDay}` };
}
export function previousMonth(month: string) {
  monthRange(month);
  const [year, number] = month.split("-").map(Number);
  if (year === 1000 && number === 1) throw new Error("Choose a later month.");
  return `${number === 1 ? year - 1 : year}-${String(number === 1 ? 12 : number - 1).padStart(2, "0")}`;
}
export function comparisonAmount(minor: string, currency: string) {
  const value = BigInt(minor);
  const absolute = value < 0n ? -value : value;
  return `${currency} ${value < 0n ? "−" : ""}${new Intl.NumberFormat("en-GB").format(absolute / 100n)}.${String(absolute % 100n).padStart(2, "0")}`;
}
// Percentages use absolute baseline magnitude so net-flow direction remains meaningful.
export function periodChange(selected: string, baseline: string) {
  const difference = BigInt(selected) - BigInt(baseline);
  const base = BigInt(baseline);
  const percentTenths =
    base === 0n ? null : (difference * 1000n) / (base < 0n ? -base : base);
  return {
    difference: difference.toString(),
    percentTenths: percentTenths?.toString() ?? null,
  };
}
export function percentageChange(tenths: string | null, difference = "0") {
  if (tenths === null) return "No baseline";
  const value = BigInt(tenths);
  if (value === 0n && BigInt(difference) !== 0n)
    return `${BigInt(difference) > 0n ? "+" : "−"}<0.1%`;
  const absolute = value < 0n ? -value : value;
  return `${value > 0n ? "+" : value < 0n ? "−" : ""}${absolute / 10n}.${absolute % 10n}%`;
}
export function comparePeriods(
  selected: PeriodSummary,
  baseline: PeriodSummary,
) {
  const currencies = [
    ...new Set(
      [...selected.totals, ...baseline.totals].map((row) => row.currency),
    ),
  ].sort();
  return currencies.map((currency) => {
    const empty = {
      currency,
      incomeMinor: "0",
      expenseMinor: "0",
      netMinor: "0",
      count: 0,
    };
    const current = selected.totals.find((row) => row.currency === currency);
    const previous = baseline.totals.find((row) => row.currency === currency);
    const currentCategories = selected.categories.filter(
      (row) => row.currency === currency,
    );
    const previousCategories = baseline.categories.filter(
      (row) => row.currency === currency,
    );
    const ids = [
      ...new Set(
        [...currentCategories, ...previousCategories].map(
          (row) => row.categoryId,
        ),
      ),
    ];
    const categories = ids
      .map((id) => {
        const a = currentCategories.find((row) => row.categoryId === id);
        const b = previousCategories.find((row) => row.categoryId === id);
        return {
          id,
          category: a?.category ?? b!.category,
          selected: a?.expenseMinor ?? "0",
          baseline: b?.expenseMinor ?? "0",
          ...periodChange(a?.expenseMinor ?? "0", b?.expenseMinor ?? "0"),
        };
      })
      .sort((a, b) => {
        const aMax =
          BigInt(a.selected) > BigInt(a.baseline)
            ? BigInt(a.selected)
            : BigInt(a.baseline);
        const bMax =
          BigInt(b.selected) > BigInt(b.baseline)
            ? BigInt(b.selected)
            : BigInt(b.baseline);
        return aMax === bMax
          ? a.category.localeCompare(b.category)
          : aMax > bMax
            ? -1
            : 1;
      });
    return {
      currency,
      selected: current ?? empty,
      baseline: previous ?? empty,
      categories,
    };
  });
}
export function comparisonBarPercent(value: string, max: string) {
  const amount = BigInt(value);
  const ceiling = BigInt(max);
  if (ceiling <= 0n || amount <= 0n) return 0;
  return Number((amount * 10_000n) / ceiling) / 100;
}
