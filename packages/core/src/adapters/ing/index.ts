import type { BankAdapter } from "../types";
import { reviewIngCsv } from "./csv";
export const ingAdapter: BankAdapter = {
  id: "ing",
  name: "ING Home’Bank",
  formats: {
    csv: {
      label: "CSV",
      mediaTypes: ["text/csv", "application/csv"],
      review(content, currency) {
        if (typeof content !== "string") {
          try {
            content = new TextDecoder("utf-8", { fatal: true }).decode(content);
          } catch {
            return {
              rows: [],
              issues: [
                { row: null, message: "ING CSV must be UTF-8 encoded." },
              ],
            };
          }
        }
        return reviewIngCsv(content, currency);
      },
    },
  },
};
