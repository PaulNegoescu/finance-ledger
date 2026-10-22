import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Spending } from "../components/Spending";
import { PageHeader } from "../components/PageHeader";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/spending")({
  head: () => ({ meta: [{ title: "Spending · Finance Ledger" }] }),
  loader: () => listLedger(),
  component: SpendingPage,
});
function SpendingPage() {
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
      <h1 className="page-title">Spending</h1>
      <Spending
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
      />
    </main>
  );
}
