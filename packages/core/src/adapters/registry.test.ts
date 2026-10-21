import { expect, it } from "vitest";
import { createAdapterRegistry, importAdapters } from "./registry";
import type { BankAdapter } from "./types";
it("supports several text/binary asynchronous formats per adapter without changing consumers", async () => {
  const adapter: BankAdapter = {
    id: "fictional",
    name: "Fictional bank",
    formats: {
      csv: {
        label: "CSV",
        mediaTypes: ["text/csv"],
        review: () => ({ rows: [], issues: [] }),
      },
      pdf: {
        label: "PDF",
        mediaTypes: ["application/pdf"],
        review: async (content) => ({
          rows: [],
          issues:
            typeof content === "string"
              ? [{ row: null, message: "Expected bytes" }]
              : [],
        }),
      },
    },
  };
  const registry = createAdapterRegistry([adapter]);
  expect(registry.list()[0].formats.map((f) => f.id)).toEqual(["csv", "pdf"]);
  expect(
    (
      await registry.review({
        adapterId: "fictional",
        format: "pdf",
        content: new Uint8Array([1, 2]),
        currency: "RON",
      })
    ).issues,
  ).toEqual([]);
  expect(() => createAdapterRegistry([adapter, adapter])).toThrow("Duplicate");
});
it("reports unsupported providers and formats and refuses oversized input", async () => {
  for (const [adapterId, format] of [
    ["missing", "csv"],
    ["ing", "pdf"],
    ["ing", "__proto__"],
  ])
    expect(
      (
        await importAdapters.review({
          adapterId,
          format,
          content: "",
          currency: "RON",
        })
      ).issues,
    ).toHaveLength(1);
  expect(
    (
      await importAdapters.review({
        adapterId: "ing",
        format: "csv",
        content: "é".repeat(1_000_001),
        currency: "RON",
      })
    ).issues,
  ).toHaveLength(1);
});
