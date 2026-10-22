import { expect, it } from "vitest";
import {
  comparePeriods,
  comparisonAmount,
  comparisonBarPercent,
  monthRange,
  percentageChange,
  periodChange,
  previousMonth,
} from "./comparison";
it("handles month boundaries and leap years without timezone shifts", () => {
  expect(previousMonth("2026-01")).toBe("2025-12");
  expect(monthRange("2024-02")).toEqual({
    from: "2024-02-01",
    to: "2024-02-29",
  });
  expect(monthRange("2026-02").to).toBe("2026-02-28");
  expect(() => monthRange("2026-13")).toThrow();
  expect(() => previousMonth("1000-01")).toThrow();
});
it("computes exact deltas beyond floating point and handles absent baselines", () => {
  expect(
    periodChange("9007199254740993123", "9007199254740993000").difference,
  ).toBe("123");
  expect(percentageChange(periodChange("150", "100").percentTenths)).toBe(
    "+50.0%",
  );
  expect(percentageChange(periodChange("0", "100").percentTenths)).toBe(
    "−100.0%",
  );
  expect(percentageChange(periodChange("100", "0").percentTenths)).toBe(
    "No baseline",
  );
  expect(percentageChange(periodChange("0", "0").percentTenths)).toBe(
    "No baseline",
  );
  expect(periodChange("-50", "-100").percentTenths).toBe("500");
  expect(percentageChange("0", "1")).toBe("+<0.1%");
  expect(percentageChange("0", "-1")).toBe("−<0.1%");
  expect(percentageChange("0", "0")).toBe("0.0%");
  expect(comparisonAmount("9007199254740993123", "RON")).toBe(
    "RON 90,071,992,547,409,931.23",
  );
  expect(
    comparisonBarPercent("9007199254740993123", "18014398509481986246"),
  ).toBe(50);
});
it("keeps currencies and uncategorized identities separate, including empty periods", () => {
  const total = (currency: string, expenseMinor: string) => ({
    currency,
    expenseMinor,
    incomeMinor: "0",
    netMinor: `-${expenseMinor}`,
    count: 1,
  });
  const result = comparePeriods(
    {
      totals: [total("RON", "200")],
      categories: [
        {
          currency: "RON",
          categoryId: null,
          category: "Uncategorized",
          expenseMinor: "200",
        },
      ],
    },
    {
      totals: [total("EUR", "300"), total("RON", "100")],
      categories: [
        {
          currency: "RON",
          categoryId: "named",
          category: "Uncategorized",
          expenseMinor: "100",
        },
      ],
    },
  );
  expect(result.map((row) => row.currency)).toEqual(["EUR", "RON"]);
  expect(result[0].selected.count).toBe(0);
  expect(result[1].categories).toHaveLength(2);
  expect(result[1].categories[0]).toMatchObject({
    id: null,
    selected: "200",
    baseline: "0",
    percentTenths: null,
  });
  expect(
    comparePeriods(
      { totals: [], categories: [] },
      { totals: [], categories: [] },
    ),
  ).toEqual([]);
});
