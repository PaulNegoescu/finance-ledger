import { useState } from "react";
import { ImportCsv } from "../components/ImportCsv";
import { Transactions } from "../components/Transactions";
import { RuleManager } from "../components/RuleManager";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { listLedger } from "../server/functions";
export const Route = createFileRoute("/")({
  loader: () => listLedger(),
  component: Home,
});
function Home() {
  const { data, unavailable } = Route.useLoaderData();
  const router = useRouter();
  const [revision, setRevision] = useState(0);
  async function refresh() {
    await router.invalidate();
    setRevision((value) => value + 1);
  }
  return (
    <main>
      <h1>Finance Ledger</h1>
      {unavailable && (
        <p role="alert" className="notice">
          Transactions are unavailable. Check the database connection.
        </p>
      )}
      <ImportCsv disabled={unavailable} onImported={refresh}>
        <RuleManager
          categories={data.categories}
          rules={data.rules}
          disabled={unavailable}
          onChanged={refresh}
        />
      </ImportCsv>
      <Transactions
        categories={data.categories}
        accounts={data.accounts}
        revision={revision}
        disabled={unavailable}
        onAssigned={refresh}
      />
    </main>
  );
}
