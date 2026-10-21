import { expect, it } from "vitest";
import { importInput, importRequest } from "./validation";
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
