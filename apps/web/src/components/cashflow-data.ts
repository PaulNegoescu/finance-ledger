export type CashflowMonth = {
  month: string;
  currency: string;
  incomeMinor: string;
  expenseMinor: string;
  netMinor: string;
  count: number;
};

export function cashflowAmount(minor: string, currency: string) {
  const value = BigInt(minor);
  const absolute = value < 0n ? -value : value;
  return `${currency} ${value < 0n ? "−" : ""}${new Intl.NumberFormat("en-GB").format(absolute / 100n)}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function cashflowTick(minor: bigint) {
  if (minor < 100_000n) {
    const whole = new Intl.NumberFormat("en-GB").format(minor / 100n);
    const fraction = minor % 100n;
    return fraction ? `${whole}.${String(fraction).padStart(2, "0")}` : whole;
  }
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(minor / 100n);
}

// Convert only the bounded ratio to Number; totals may exceed safe integer range.
export function cashflowRatio(value: bigint, maximum: bigint) {
  if (maximum <= 0n) return 0;
  return Number((value * 1_000_000n) / maximum) / 1_000_000;
}

export function cashflowYear(
  rows: readonly CashflowMonth[],
  year: string,
  currency: string,
  from?: string,
  to?: string,
): CashflowMonth[] {
  const selected = new Map(
    rows
      .filter((row) => row.currency === currency)
      .map((row) => [row.month, row]),
  );
  return Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  )
    .filter(
      (month) =>
        (!from || month >= from.slice(0, 7)) &&
        (!to || month <= to.slice(0, 7)),
    )
    .map(
      (month) =>
        selected.get(month) ?? {
          month,
          currency,
          incomeMinor: "0",
          expenseMinor: "0",
          netMinor: "0",
          count: 0,
        },
    );
}

export type CashflowPreset = "month" | "previous" | "year" | "all";
export function cashflowPeriod(preset: CashflowPreset, now = new Date()) {
  if (preset === "all") return {};
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  let year = Number(parts.find((part) => part.type === "year")!.value);
  let month = Number(parts.find((part) => part.type === "month")!.value);
  if (preset === "previous" && --month === 0) {
    year--;
    month = 12;
  }
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return preset === "year"
    ? { from: `${year}-01-01`, to: `${year}-12-31` }
    : {
        from: `${year}-${String(month).padStart(2, "0")}-01`,
        to: `${year}-${String(month).padStart(2, "0")}-${end}`,
      };
}
