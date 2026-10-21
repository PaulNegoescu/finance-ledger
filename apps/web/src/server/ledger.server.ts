import { createLedger } from "@ledger/db";
let ledger: ReturnType<typeof createLedger> | undefined;
export function getLedger() {
  const url = process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      "DATABASE_URL is required. Configure the database connection.",
    );
  return (ledger ??= createLedger(url));
}
