import { expect, it } from "vitest";
import { groupSpending } from "./group-spending";
it("sums categories into exact currency-isolated groups and keeps uncategorized activity visible", () => {
  const rows = [
    {
      categoryId: "food",
      category: "Groceries",
      groupId: "critical",
      group: "Critical spending",
      currency: "RON",
      expenseMinor: "9007199254740993",
    },
    {
      categoryId: "rent",
      category: "Housing",
      groupId: "critical",
      group: "Critical spending",
      currency: "RON",
      expenseMinor: "7",
    },
    {
      categoryId: "gift",
      category: "Gift",
      groupId: null,
      group: "Ungrouped",
      currency: "RON",
      expenseMinor: "200",
    },
    {
      categoryId: null,
      category: "Uncategorized",
      groupId: null,
      group: "Ungrouped",
      currency: "RON",
      expenseMinor: "100",
    },
    {
      categoryId: "food",
      category: "Groceries",
      groupId: "critical",
      group: "Critical spending",
      currency: "EUR",
      expenseMinor: "5000",
    },
  ];
  const report = groupSpending(rows, "RON");
  expect(report.total).toBe("9007199254741300");
  expect(report.ranked).toEqual([
    {
      categoryId: "critical",
      category: "Critical spending",
      currency: "RON",
      expenseMinor: "9007199254741000",
    },
    {
      categoryId: null,
      category: "Ungrouped",
      currency: "RON",
      expenseMinor: "300",
    },
  ]);
  expect(groupSpending(rows, "EUR").total).toBe("5000");
  expect(groupSpending(rows, "USD").ranked).toEqual([]);
});
it("groups by stable identity and never merges a real group into the ungrouped bucket", () => {
  const report = groupSpending(
    [
      {
        categoryId: "a",
        category: "A",
        groupId: "real",
        group: "Ungrouped",
        currency: "RON",
        expenseMinor: "100",
      },
      { categoryId: "b", category: "B", currency: "RON", expenseMinor: "200" },
    ],
    "RON",
  );
  expect(report.ranked).toHaveLength(2);
  expect(report.total).toBe("300");
});
