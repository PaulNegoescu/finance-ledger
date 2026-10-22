import { readComparisonSearch } from "../components/report-search";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PeriodComparison } from "../components/PeriodComparison";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/comparison")({
  validateSearch: readComparisonSearch,
  head: () => ({ meta: [{ title: "Comparison · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: ComparisonPage,
});
function ComparisonPage() {
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
      <h1 className="page-title">Comparison</h1>
      {search.invalidFilters && (
        <p role="alert" className="notice">
          Some report filters were invalid and have been reset.
        </p>
      )}
      <PeriodComparison
        key={JSON.stringify(search)}
        initialFilters={search}
        onFiltersChanged={(filters) => {
          void navigate({
            search: { ...filters, accountId: filters.accountId || undefined },
          });
        }}
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
      />
    </main>
  );
}
