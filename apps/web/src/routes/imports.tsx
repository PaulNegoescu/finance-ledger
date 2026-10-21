import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ImportHistory } from "../components/ImportHistory";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/imports")({
  head: () => ({ meta: [{ title: "Import history · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: ImportsPage,
});
function ImportsPage() {
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
      <h1 className="page-title">Import history</h1>
      <ImportHistory
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
      />
    </main>
  );
}
