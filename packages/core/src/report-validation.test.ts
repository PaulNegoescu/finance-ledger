import { expect, it } from "vitest";
import { overviewInput, comparisonInput } from "./report-validation";
it("uses the same date/account validation for both comparison periods", () => {
  const selected = { from: "2026-02-01", to: "2026-02-28" };
  const baseline = { from: "2026-01-01", to: "2026-01-31" };
  expect(comparisonInput.parse({ selected, baseline })).toEqual({
    selected,
    baseline,
  });
  for (const invalid of [
    { from: "2026-02-29" },
    { from: "2026-02-01", to: "2026-01-31" },
    { accountId: "invalid" },
  ]) {
    expect(() => overviewInput.parse(invalid)).toThrow();
    expect(() =>
      comparisonInput.parse({ selected: invalid, baseline }),
    ).toThrow();
    expect(() =>
      comparisonInput.parse({ selected, baseline: invalid }),
    ).toThrow();
  }
});
