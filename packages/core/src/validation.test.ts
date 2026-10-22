import { expect, it } from "vitest";
import {
  importInput,
  importRequest,
  transactionSearch,
  transactionQuery,
} from "./validation";
const base = { account: "Demo", currency: "RON", csv: "demo" };
it("enforces byte rather than character limits for UTF-8 uploads", () => {
  expect(() =>
    importInput.parse({ ...base, csv: "é".repeat(1_000_001) }),
  ).toThrow();
  expect(
    importInput.parse({ ...base, csv: "é".repeat(1_000_000) }).csv.length,
  ).toBe(1_000_000);
});
it("requires exactly one account selection mode at the server boundary", () => {
  expect(() => importRequest.parse(base)).toThrow();
  expect(() =>
    importRequest.parse({
      ...base,
      createAccount: true,
      accountId: "00000000-0000-4000-8000-000000000001",
    }),
  ).toThrow();
  expect(
    importRequest.parse({ ...base, createAccount: true }).createAccount,
  ).toBe(true);
  expect(
    importRequest.parse({
      ...base,
      accountId: "00000000-0000-4000-8000-000000000001",
    }).accountId,
  ).toBeTruthy();
});

it("validates report drill-down links with the same filters as transaction queries", () => {
  const link = {
    accountId: "00000000-0000-4000-8000-000000000001",
    from: "2026-01-01",
    to: "2026-01-31",
    uncategorized: true,
    search: "  Demo  ",
  };
  expect(transactionSearch.parse(link)).toEqual({ ...link, search: "Demo" });
  expect(transactionQuery.parse(link)).toMatchObject(
    transactionSearch.parse(link),
  );
  expect(transactionSearch.parse({})).toEqual({});
  for (const value of [
    { from: "2026-02-31" },
    { from: "2026-02-01", to: "2026-01-01" },
    { categoryId: "invalid" },
    { uncategorized: "true" },
    { search: "a".repeat(201) },
  ]) {
    expect(() => transactionSearch.parse(value)).toThrow();
    expect(() => transactionQuery.parse(value)).toThrow();
  }
});
