import { expect, it } from "vitest";
import { spendingReport, spendingAmount } from "./spending-data";
it("keeps currencies separate, exact shares and tiny amounts above zero", () => {
  const report = spendingReport(
    [
      {
        categoryId: "a",
        category: "Fictional food",
        currency: "RON",
        expenseMinor: "900719925474099300",
      },
      {
        categoryId: null,
        category: "Uncategorized",
        currency: "RON",
        expenseMinor: "1",
      },
      {
        categoryId: "b",
        category: "Other currency",
        currency: "EUR",
        expenseMinor: "500",
      },
    ],
    "RON",
  );
  expect(report.total).toBe("900719925474099301");
  expect(report.share("1")).toBe("<0.01%");
  expect(report.ranked.map((row) => row.category)).toEqual([
    "Fictional food",
    "Uncategorized",
  ]);
  expect(report.chart.every((row) => Number.isFinite(row.width))).toBe(true);
  expect(spendingAmount(report.total, "RON")).toBe(
    "RON 9,007,199,254,740,993.01",
  );
});
it("combines the chart tail without dropping any ranked rows or amounts", () => {
  const rows = Array.from({ length: 11 }, (_, i) => ({
    categoryId: String(i),
    category: `Demo ${i}`,
    currency: "RON",
    expenseMinor: String((i + 1) * 100),
  }));
  const report = spendingReport(rows, "RON");
  expect(report.ranked).toHaveLength(11);
  expect(report.chart).toHaveLength(9);
  expect(report.chart.at(-1)?.expenseMinor).toBe("600");
  expect(
    report.chart
      .reduce((sum, row) => sum + BigInt(row.expenseMinor), 0n)
      .toString(),
  ).toBe(report.total);
  expect(spendingReport(rows, "EUR")).toMatchObject({
    ranked: [],
    chart: [],
    total: "0",
  });
});
