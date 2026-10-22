import type { BankAdapter, ImportContent, ImportReview } from "./types";
import { ingAdapter } from "./ing";
export function createAdapterRegistry(adapters: readonly BankAdapter[]) {
  const registered = new Map<string, BankAdapter>();
  for (const adapter of adapters) {
    if (registered.has(adapter.id))
      throw new Error(`Duplicate adapter ID: ${adapter.id}`);
    registered.set(adapter.id, adapter);
  }
  return {
    list: () =>
      [...registered.values()].map((adapter) => ({
        id: adapter.id,
        name: adapter.name,
        formats: Object.entries(adapter.formats).map(([id, handler]) => ({
          id,
          label: handler.label,
          mediaTypes: [...handler.mediaTypes],
        })),
      })),
    async review(input: {
      adapterId: string;
      format: string;
      content: ImportContent;
      currency: string;
    }): Promise<ImportReview> {
      const adapter = registered.get(input.adapterId);
      if (!adapter)
        return {
          rows: [],
          issues: [{ row: null, message: "Unsupported bank adapter." }],
        };
      const handler = Object.hasOwn(adapter.formats, input.format)
        ? adapter.formats[input.format]
        : undefined;
      if (!handler)
        return {
          rows: [],
          issues: [
            {
              row: null,
              message:
                "This file format is not supported by the selected adapter.",
            },
          ],
        };
      const size =
        typeof input.content === "string"
          ? new TextEncoder().encode(input.content).length
          : input.content.byteLength;
      if (size > 2_000_000)
        return {
          rows: [],
          issues: [{ row: null, message: "File must not exceed 2 MB." }],
        };
      return handler.review(input.content, input.currency);
    },
  };
}
export const importAdapters = createAdapterRegistry([ingAdapter]);
export const reviewImport = importAdapters.review;
