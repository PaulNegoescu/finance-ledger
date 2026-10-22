import { createFileRoute, useRouter } from "@tanstack/react-router";
import { z } from "zod";
import { useState } from "react";
import { Transactions } from "../components/Transactions";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/transactions")({
  validateSearch: z.object({ importId: z.uuid().optional() }),
  head: () => ({ meta: [{ title: "Transactions · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: TransactionsPage,
});
function TransactionsPage() {
  const { data, unavailable } = Route.useLoaderData();
  const router = useRouter();
  const { importId } = Route.useSearch();
  const [revision, setRevision] = useState(0);
  async function refresh() {
    await router.invalidate();
    setRevision((value) => value + 1);
  }
  return (
    <main>
      <PageHeader data={data} unavailable={unavailable} onChanged={refresh} />
      <Transactions
        key={importId ?? "all"}
        importId={importId}
        categories={data.categories}
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
        onAssigned={refresh}
      />
    </main>
  );
}
