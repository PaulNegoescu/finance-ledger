import { describe, expect, it } from "vitest";
import {
  readOverviewSearch,
  readSpendingSearch,
  readComparisonSearch,
  comparisonDefaults,
} from "./report-search";
const accountId = "00000000-0000-4000-8000-000000000001";
describe("Report URL filters", () => {
  it("defaults the baseline to the selected month’s predecessor, including year rollover", () => {
    expect(comparisonDefaults({ selected: "2026-01" }, "2026-10")).toEqual({
      selected: "2026-01",
      baseline: "2025-12",
      accountId: "",
    });
    expect(
      comparisonDefaults(
        { selected: "2026-04", baseline: "2025-08", accountId },
        "2026-10",
      ),
    ).toEqual({ selected: "2026-04", baseline: "2025-08", accountId });
  });
  it("preserves applied account/dates and each report display selection", () => {
    const filter = { accountId, from: "2026-01-01", to: "2026-10-31" };
    expect(
      readOverviewSearch({ ...filter, year: "2026", ignored: "value" }),
    ).toEqual({ ...filter, year: "2026" });
    expect(readSpendingSearch({ ...filter, currency: "RON" })).toEqual({
      ...filter,
      currency: "RON",
    });
    expect(
      readComparisonSearch({
        accountId,
        selected: "2026-10",
        baseline: "2026-09",
      }),
    ).toEqual({ accountId, selected: "2026-10", baseline: "2026-09" });
    expect(readOverviewSearch({})).toEqual({});
    expect(readSpendingSearch({})).toEqual({});
    expect(readComparisonSearch({})).toEqual({});
  });
  it("resets invalid incoming links with a visible notice rather than throwing", () => {
    for (const invalid of [
      { accountId: "invalid" },
      { from: "2026-02-31" },
      { from: "2026-02-01", to: "2026-01-31" },
    ]) {
      expect(readOverviewSearch(invalid)).toEqual({ invalidFilters: true });
      expect(readSpendingSearch(invalid)).toEqual({ invalidFilters: true });
    }
    for (const invalid of [{ year: "2026<script>" }, { year: 2026 }])
      expect(readOverviewSearch(invalid)).toEqual({ invalidFilters: true });
    expect(readSpendingSearch({ currency: "ron" })).toEqual({
      invalidFilters: true,
    });
    expect(readComparisonSearch({ selected: "1000-01" })).toEqual({
      invalidFilters: true,
    });
    expect(readComparisonSearch({ selected: "2026-13" })).toEqual({
      invalidFilters: true,
    });
    expect(readComparisonSearch({ baseline: "2026-00" })).toEqual({
      invalidFilters: true,
    });
    expect(readComparisonSearch({ accountId: "invalid" })).toEqual({
      invalidFilters: true,
    });
  });
});
