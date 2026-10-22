import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { PeriodComparison } from "../components/PeriodComparison";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/comparison")({
  head: () => ({ meta: [{ title: "Comparison · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: ComparisonPage,
});
function ComparisonPage() {
  const { data, unavailable } = Route.useLoaderData();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  async function refresh() {
    await router.invalidate();
    setRevision((value) => value + 1);
  }
  return (
    <main>
      <PageHeader data={data} unavailable={unavailable} onChanged={refresh} />
      <h1 className="page-title">Comparison</h1>
      <PeriodComparison
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
      />
    </main>
  );
}
