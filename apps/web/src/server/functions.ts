import { createServerFn } from "@tanstack/react-start";
import {
  importInput,
  categoryInput,
  assignmentInput,
  ruleInput,
} from "@ledger/core/validation";

async function safeWrite<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch {
    throw new Error(
      "Unable to save changes. Check your input and connection, then try again.",
    );
  }
}

// Dynamic server-only imports prevent database credentials/drivers entering browser bundles.
export const listLedger = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getLedger } = await import("./ledger.server");
    try {
      return { data: await getLedger().list(), unavailable: false as const };
    } catch {
      return {
        data: { transactions: [], categories: [], rules: [] },
        unavailable: true as const,
      };
    }
  },
);
export const previewCsv = createServerFn({ method: "POST" })
  .validator(importInput)
  .handler(async ({ data }) => {
    const { getLedger } = await import("./ledger.server");
    return safeWrite(() => getLedger().previewCsv(data));
  });
export const importCsv = createServerFn({ method: "POST" })
  .validator(importInput)
  .handler(async ({ data }) => {
    const { getLedger } = await import("./ledger.server");
    return safeWrite(() => getLedger().importCsv(data));
  });
export const addCategory = createServerFn({ method: "POST" })
  .validator(categoryInput)
  .handler(async ({ data }) => {
    const { getLedger } = await import("./ledger.server");
    await safeWrite(() => getLedger().addCategory(data));
    return { ok: true };
  });
export const assignCategory = createServerFn({ method: "POST" })
  .validator(assignmentInput)
  .handler(async ({ data }) => {
    const { getLedger } = await import("./ledger.server");
    return safeWrite(() => getLedger().assign(data));
  });
export const addRule = createServerFn({ method: "POST" })
  .validator(ruleInput)
  .handler(async ({ data }) => {
    const { getLedger } = await import("./ledger.server");
    await safeWrite(() => getLedger().addRule(data));
    return { ok: true };
  });
