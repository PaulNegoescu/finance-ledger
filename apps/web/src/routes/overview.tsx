import { readOverviewSearch } from "../components/report-search";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Overview } from "../components/Overview";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/overview")({
  validateSearch: readOverviewSearch,
  head: () => ({ meta: [{ title: "Overview · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: OverviewPage,
});
function OverviewPage() {
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
      <h1 className="page-title">Overview</h1>
      {search.invalidFilters && (
        <p role="alert" className="notice">
          Some report filters were invalid and have been reset.
        </p>
      )}
      <Overview
        key={JSON.stringify([search.accountId, search.from, search.to])}
        initialFilters={{
          accountId: search.accountId,
          from: search.from,
          to: search.to,
        }}
        chartYear={search.year}
        onFiltersChanged={(filters) => {
          void navigate({ search: { ...filters } });
        }}
        onChartYearChanged={(year) => {
          void navigate({
            search: { ...search, invalidFilters: undefined, year },
          });
        }}
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
      />
    </main>
  );
}
