import { useState } from "react";
import { ImportCsv } from "../components/ImportCsv";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  addCategory,
  addRule,
  assignCategory,
  listLedger,
} from "../server/functions";
export const Route = createFileRoute("/")({
  loader: () => listLedger(),
  component: Home,
});
function Home() {
  const { data, unavailable } = Route.useLoaderData();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await action());
      await router.invalidate();
    } catch {
      setMessage(
        "Unable to save changes. Check your input and connection, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const rows = data.transactions.filter(
    (t) => !onlyUnassigned || !t.categoryId,
  );
  return (
    <main>
      <h1>Finance Ledger</h1>
      {unavailable && (
        <p role="alert" className="notice">
          Transactions are unavailable. Check the database connection.
        </p>
      )}
      <div role="status" aria-live="polite" className="status">
        {message && <p>{message}</p>}
      </div>
      <div className="grid">
        <ImportCsv
          disabled={busy || unavailable}
          onImported={async () => {
            await router.invalidate();
          }}
        />
        <section className="panel">
          <h2>Categories and rules</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                await addCategory({ data: { name: String(form.get("name")) } });
                return "Category added.";
              });
            }}
          >
            <fieldset disabled={busy || unavailable}>
              <label>
                New category
                <input
                  name="name"
                  placeholder="Groceries"
                  maxLength={80}
                  required
                />
              </label>
              <button>Add category</button>
            </fieldset>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                await addRule({
                  data: {
                    contains: String(form.get("contains")),
                    categoryId: String(form.get("categoryId")),
                  },
                });
                return "Rule added for future imports.";
              });
            }}
          >
            <fieldset disabled={busy || unavailable || !data.categories.length}>
              <label>
                Description contains
                <input
                  name="contains"
                  minLength={2}
                  maxLength={120}
                  placeholder="Merchant name"
                  required
                />
              </label>
              <label>
                Category
                <select name="categoryId">
                  {data.categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button>Add rule</button>
            </fieldset>
          </form>
          <ul>
            {data.rules.map((r) => (
              <li key={r.id}>
                “{r.contains}” →{" "}
                {data.categories.find((c) => c.id === r.categoryId)?.name}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="panel ledger">
        <div className="tableTitle">
          <h2>Transactions</h2>
          <label>
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
            />{" "}
            Uncategorized only
          </label>
        </div>
        {!rows.length ? (
          <div className="empty">No transactions to display.</div>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Date / account</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Category</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.date}
                      <small>{t.account}</small>
                    </td>
                    <td>{t.description}</td>
                    <td className={t.amountMinor > 0 ? "positive" : ""}>
                      {new Intl.NumberFormat("en-GB", {
                        style: "currency",
                        currency: t.currency,
                      }).format(t.amountMinor / 100)}
                    </td>
                    <td>
                      <select
                        aria-label={`Category for ${t.description}`}
                        disabled={busy}
                        value={t.categoryId ?? ""}
                        onChange={(e) => {
                          const categoryId = e.target.value || null;
                          void run(async () => {
                            await assignCategory({
                              data: { id: t.id, categoryId },
                            });
                            return "Category updated.";
                          });
                        }}
                      >
                        <option value="">Uncategorized</option>
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {t.categorySource === "manual"
                        ? "Manual"
                        : t.categorySource === "rule"
                          ? "Rule"
                          : "Uncategorized"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
