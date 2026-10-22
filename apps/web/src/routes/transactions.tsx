import { createFileRoute, useRouter } from "@tanstack/react-router";
import { transactionSearch } from "@ledger/core/validation";
import { useState } from "react";
import { Transactions } from "../components/Transactions";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/transactions")({
  validateSearch: transactionSearch,
  head: () => ({ meta: [{ title: "Transactions · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: TransactionsPage,
});
function TransactionsPage() {
  const { data, unavailable } = Route.useLoaderData();
  const router = useRouter();
  const search = Route.useSearch();
  const { importId, ...filters } = search;
  const navigate = Route.useNavigate();
  const [revision, setRevision] = useState(0);
  async function refresh() {
    await router.invalidate();
    setRevision((value) => value + 1);
  }
  return (
    <main>
      <PageHeader data={data} unavailable={unavailable} onChanged={refresh} />
      <Transactions
        key={JSON.stringify(search)}
        initialFilters={filters}
        onFiltersChanged={(next) => {
          void navigate({ search: { ...next, importId } });
        }}
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
