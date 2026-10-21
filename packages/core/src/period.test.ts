import { expect, it } from "vitest";
import { currentMonthRange } from "./period";
it("uses the current month in Bucharest across a UTC year boundary", () => {
  expect(currentMonthRange(new Date("2026-12-31T22:30:00Z"))).toEqual({
    from: "2027-01-01",
    to: "2027-01-31",
    label: "January 2027",
  });
});
it("includes the final leap-year day", () => {
  expect(currentMonthRange(new Date("2024-02-15T12:00:00Z")).to).toBe(
    "2024-02-29",
  );
});
