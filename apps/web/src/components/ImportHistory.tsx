import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { listImportHistory } from "../server/import-history";

type Props = {
  accounts: { id: string; name: string; currency: string }[];
  revision: number;
  disabled: boolean;
};
type HistoryPage = Awaited<ReturnType<typeof listImportHistory>>;
const pageSize = 20;
export function ImportHistory({ accounts, revision, disabled }: Props) {
  const [accountId, setAccountId] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<HistoryPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    setPage(1);
  }, [revision]);
  useEffect(() => {
    const id = ++request.current;
    if (disabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void listImportHistory({
      data: { accountId: accountId || undefined, page, pageSize },
    })
      .then((data) => {
        if (request.current === id) setResult(data);
      })
      .catch(() => {
        if (request.current === id)
          setError("Unable to load import history. Try again.");
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      if (request.current === id) request.current++;
    };
  }, [disabled, accountId, page, revision, refresh]);
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1;
  return (
    <section className="panel" aria-label="Import history">
      <div className="history-content">
        <label>
          Import account
          <select
            value={accountId}
            disabled={disabled || loading}
            onChange={(event) => {
              setAccountId(event.target.value);
              setPage(1);
            }}
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currency})
              </option>
            ))}
          </select>
        </label>
        {disabled && (
          <p role="alert">
            Import history is unavailable while the connection is offline.
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            {error}{" "}
            <button
              type="button"
              className="secondary"
              disabled={disabled || loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry
            </button>
          </p>
        )}
        <div role="status" aria-live="polite">
          {loading ? (
            <p>Loading import history…</p>
          ) : (
            !error && !disabled && result && <p>{result.total} imports</p>
          )}
        </div>
        <div aria-busy={loading}>
          {!loading &&
            !error &&
            !disabled &&
            result &&
            (result.imports.length ? (
              <div className="scroll">
                <table aria-label="Import history">
                  <thead>
                    <tr>
                      <th scope="col">Imported</th>
                      <th scope="col">Account</th>
                      <th scope="col">Currency</th>
                      <th scope="col">Source</th>
                      <th scope="col">Added</th>
                      <th scope="col">Skipped</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.imports.map((batch) => (
                      <tr key={batch.id}>
                        <td>
                          <time dateTime={batch.createdAt}>
                            {new Intl.DateTimeFormat("en-GB", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(batch.createdAt))}
                          </time>
                        </td>
                        <td>{batch.account}</td>
                        <td>{batch.currency}</td>
                        <td>
                          {batch.adapterId === "ing" ? "ING" : batch.adapterId}{" "}
                          · {batch.format.toUpperCase()}
                        </td>
                        <td>{batch.transactionCount}</td>
                        <td>{batch.skippedCount ?? "—"}</td>
                        <td>
                          <Link
                            to="/transactions"
                            search={{ importId: batch.id }}
                          >
                            View transactions
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No imports to display.</p>
            ))}
        </div>
        {result && (
          <nav className="actions" aria-label="Import history pages">
            <button
              type="button"
              className="secondary"
              disabled={disabled || loading || !!error || result.page <= 1}
              onClick={() => setPage(result.page - 1)}
            >
              Previous
            </button>
            <span>
              Page {result.page} of {totalPages}
            </span>
            <button
              type="button"
              className="secondary"
              disabled={
                disabled || loading || !!error || result.page >= totalPages
              }
              onClick={() => setPage(result.page + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
