import { expect, it } from "vitest";
import {
  cashflowAmount,
  cashflowPeriod,
  cashflowRatio,
  cashflowTick,
  cashflowYear,
} from "../../../apps/web/src/components/cashflow-data";
it("scales arbitrarily large amounts without unsafe numeric conversion", () => {
  const huge = 10n ** 400n;
  expect(cashflowRatio(huge / 2n, huge)).toBe(0.5);
  expect(cashflowRatio(-huge, huge)).toBe(-1);
  expect(cashflowRatio(0n, 0n)).toBe(0);
  expect(cashflowTick(99n)).toBe("0.99");
  expect(cashflowTick(1050n)).toBe("10.50");
  expect(cashflowAmount("-900719925474099301", "RON")).toBe(
    "RON −9,007,199,254,740,993.01",
  );
});
it("fills only currency-specific gaps between observed months and clips to filters", () => {
  const row = {
    month: "2026-01",
    currency: "RON",
    incomeMinor: "200",
    expenseMinor: "300",
    netMinor: "-100",
    count: 2,
  };
  const input = [
    row,
    { ...row, month: "2026-03" },
    { ...row, currency: "EUR", month: "2026-12", incomeMinor: "9999" },
  ];
  const rows = cashflowYear(input, "2026", "RON");
  expect(rows.map((row) => row.month)).toEqual([
    "2026-01",
    "2026-02",
    "2026-03",
  ]);
  expect(rows[0]).toEqual(row);
  expect(rows[1]).toMatchObject({ count: 0, netMinor: "0" });
  expect(
    cashflowYear(input, "2026", "RON", "2026-02-15", "2026-12-31").map(
      (row) => row.month,
    ),
  ).toEqual(["2026-02", "2026-03"]);
  expect(cashflowYear(input, "2026", "EUR").map((row) => row.month)).toEqual([
    "2026-12",
  ]);
  expect(cashflowYear(input, "2025", "RON")).toEqual([]);
});
it("uses Bucharest month boundaries and handles previous January and leap years", () => {
  expect(cashflowPeriod("month", new Date("2025-12-31T22:30:00Z"))).toEqual({
    from: "2026-01-01",
    to: "2026-01-31",
  });
  expect(cashflowPeriod("previous", new Date("2025-12-31T22:30:00Z"))).toEqual({
    from: "2025-12-01",
    to: "2025-12-31",
  });
  expect(cashflowPeriod("previous", new Date("2024-03-02T00:00:00Z"))).toEqual({
    from: "2024-02-01",
    to: "2024-02-29",
  });
  expect(cashflowPeriod("year", new Date("2026-10-01T00:00:00Z"))).toEqual({
    from: "2026-01-01",
    to: "2026-12-31",
  });
  expect(cashflowPeriod("all")).toEqual({});
});
