import { expect, it } from "vitest";
import { categoryTrends, trendRatio } from "./trends-data";
import { monthBounds, trendsInput } from "@ledger/core/trends";
it("separates currencies, preserves exact large sums and fills only internal chart gaps", () => {
  const rows = [
    {
      month: "2026-01",
      currency: "RON",
      categoryId: "a",
      category: "Demo",
      expenseMinor: "9007199254740993",
      count: 1,
    },
    {
      month: "2026-03",
      currency: "RON",
      categoryId: null,
      category: "Uncategorized",
      expenseMinor: "7",
      count: 1,
    },
    {
      month: "2026-01",
      currency: "EUR",
      categoryId: "a",
      category: "Demo",
      expenseMinor: "99",
      count: 1,
    },
    {
      month: "2025-12",
      currency: "RON",
      categoryId: "a",
      category: "Demo",
      expenseMinor: "99",
      count: 1,
    },
  ];
  const report = categoryTrends(rows, 2026, "RON");
  expect(report.total).toBe(9007199254741000n);
  expect([report.first, report.last]).toEqual([0, 2]);
  expect(report.totals[1]).toBe(0n);
  expect(report.categories.map((category) => category.id)).toEqual(["a", null]);
  expect(trendRatio(1n, 9007199254740993n)).toBe(0);
});
it("keeps top categories plus Other reconciled to monthly totals and validates year/month bounds", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({
    month: "2026-02",
    currency: "RON",
    categoryId: String(i),
    category: `Demo${i}`,
    expenseMinor: String(i + 1),
    count: 1,
  }));
  const report = categoryTrends(rows, 2026, "RON");
  expect(report.series).toHaveLength(6);
  expect(
    report.series.reduce((sum, series) => sum + series.values[1], 0n),
  ).toBe(report.totals[1]);
  expect(monthBounds("2024-02")).toEqual({
    from: "2024-02-01",
    to: "2024-02-29",
  });
  expect(() => monthBounds("2026-13")).toThrow();
  expect(() => trendsInput.parse({ year: 9999 })).toThrow();
});
