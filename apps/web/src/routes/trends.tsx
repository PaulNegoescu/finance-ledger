import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { trendsSearch } from "@ledger/core/trends";
import { CategoryTrends } from "../components/CategoryTrends";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/trends")({
  validateSearch: trendsSearch.catch({}),
  head: () => ({ meta: [{ title: "Category trends · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: TrendsPage,
});
function TrendsPage() {
  const { data, unavailable } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  async function refresh() {
    await router.invalidate();
    setRevision((value) => value + 1);
  }
  return (
    <main>
      <PageHeader data={data} unavailable={unavailable} onChanged={refresh} />
      <h1 className="page-title">Category trends</h1>
      <CategoryTrends
        key={JSON.stringify(search)}
        search={search}
        accounts={data.accounts}
        disabled={unavailable}
        revision={revision}
        onApply={(next) => {
          void navigate({ search: next });
        }}
      />
    </main>
  );
}
