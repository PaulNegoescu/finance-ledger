import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Overview } from "../components/Overview";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/overview")({
  head: () => ({ meta: [{ title: "Overview · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: OverviewPage,
});
function OverviewPage() {
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
      <h1 className="page-title">Overview</h1>
      <Overview
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
      />
    </main>
  );
}
