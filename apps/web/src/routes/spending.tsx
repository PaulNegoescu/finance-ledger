import { readSpendingSearch } from "../components/report-search";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Spending } from "../components/Spending";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/spending")({
  validateSearch: readSpendingSearch,
  head: () => ({ meta: [{ title: "Spending · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: SpendingPage,
});
function SpendingPage() {
  const { data, unavailable } = Route.useLoaderData();
  const router = useRouter();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [revision, setRevision] = useState(0);
  async function refresh() {
    await router.invalidate();
    setRevision((value) => value + 1);
  }
  return (
    <main>
      <PageHeader data={data} unavailable={unavailable} onChanged={refresh} />
      <h1 className="page-title">Spending</h1>
      {search.invalidFilters && (
        <p role="alert" className="notice">
          Some report filters were invalid and have been reset.
        </p>
      )}
      <Spending
        key={JSON.stringify([search.accountId, search.from, search.to])}
        initialFilters={{
          accountId: search.accountId,
          from: search.from,
          to: search.to,
        }}
        initialCurrency={search.currency}
        onFiltersChanged={(filters) => {
          void navigate({ search: { ...filters, currency: search.currency } });
        }}
        onCurrencyChanged={(currency) => {
          void navigate({
            search: { ...search, invalidFilters: undefined, currency },
          });
        }}
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
      />
    </main>
  );
}
