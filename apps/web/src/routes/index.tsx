import { useState } from "react";
import { ImportCsv } from "../components/ImportCsv";
import { Overview } from "../components/Overview";
import { PageHeader } from "../components/PageHeader";
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
      <PageHeader data={data} unavailable={unavailable} onChanged={refresh} />
      {unavailable && (
        <p role="alert" className="notice">
          Transactions are unavailable. Check the database connection.
        </p>
      )}
      <ImportCsv disabled={unavailable} onImported={refresh} />
      <div className="home-overview">
        <Overview
          accounts={data.accounts}
          revision={revision}
          disabled={unavailable}
          currentMonth
        />
      </div>
    </main>
  );
}
