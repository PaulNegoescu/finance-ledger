import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getOverview } from "../server/overview";

type Filters = { accountId?: string; from?: string; to?: string };
type Summary = Awaited<ReturnType<typeof getOverview>>;
type Props = {
  accounts: { id: string; name: string; currency: string }[];
  revision: number;
  disabled: boolean;
};
// Avoid floating-point conversion even when a sum exceeds Number.MAX_SAFE_INTEGER.
function amount(minor: string, currency: string) {
  const value = BigInt(minor);
  const absolute = value < 0n ? -value : value;
  return `${currency} ${value < 0n ? "-" : ""}${new Intl.NumberFormat("en-GB").format(absolute / 100n)}.${String(absolute % 100n).padStart(2, "0")}`;
}
export function Overview({ accounts, revision, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Filters>({});
  const [filters, setFilters] = useState<Filters>({});
  const [result, setResult] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const id = ++request.current;
    if (disabled || !open) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void getOverview({ data: filters })
      .then((data) => {
        if (request.current === id) setResult(data);
      })
      .catch(() => {
        if (request.current === id) {
          setResult(null);
          setError(
            "Unable to load the overview. Check your filters and connection, then try again.",
          );
        }
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      if (request.current === id) request.current++;
    };
  }, [filters, revision, disabled, refresh, open]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("The start date must be on or before the end date.");
      return;
    }
    setFilters({ ...draft });
  }
  return (
    <section className="panel ledger" aria-labelledby="overview-heading">
      <details
        onToggle={(event) => {
          if (event.target === event.currentTarget)
            setOpen(event.currentTarget.open);
        }}
      >
        <summary id="overview-heading">Financial overview</summary>
        <form onSubmit={apply}>
          <fieldset disabled={disabled}>
            <div className="transaction-filters">
              <label>
                Account
                <select
                  value={draft.accountId ?? ""}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      accountId: e.target.value || undefined,
                    }))
                  }
                >
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                From
                <input
                  type="date"
                  value={draft.from ?? ""}
                  max={draft.to}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      from: e.target.value || undefined,
                    }))
                  }
                />
              </label>
              <label>
                To
                <input
                  type="date"
                  value={draft.to ?? ""}
                  min={draft.from}
                  onChange={(e) =>
                    setDraft((current) => ({
                      ...current,
                      to: e.target.value || undefined,
                    }))
                  }
                />
              </label>
            </div>
            <div className="actions">
              <button>Apply overview filters</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setDraft({});
                  setFilters({});
                }}
              >
                Clear overview filters
              </button>
            </div>
          </fieldset>
        </form>
        {error && (
          <p role="alert" className="notice">
            {error}{" "}
            <button
              type="button"
              className="secondary"
              disabled={disabled}
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry overview
            </button>
          </p>
        )}
        <div role="status" aria-live="polite">
          {loading && <p>Loading overview…</p>}
        </div>
        {!loading &&
          result &&
          (!result.totals.length ? (
            <p>No transactions match these filters.</p>
          ) : (
            <>
              <div className="scroll">
                <table aria-label="Totals by currency">
                  <thead>
                    <tr>
                      <th>Currency</th>
                      <th>Money in</th>
                      <th>Money out</th>
                      <th>Net flow</th>
                      <th>Transactions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.totals.map((row) => (
                      <tr key={row.currency}>
                        <td>{row.currency}</td>
                        <td>{amount(row.incomeMinor, row.currency)}</td>
                        <td>{amount(row.expenseMinor, row.currency)}</td>
                        <td>{amount(row.netMinor, row.currency)}</td>
                        <td>{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <details>
                <summary>Monthly totals and category spending</summary>
                <h3>Monthly totals</h3>
                <div className="scroll">
                  <table aria-label="Monthly totals">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Currency</th>
                        <th>Money in</th>
                        <th>Money out</th>
                        <th>Net flow</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.months.map((row) => (
                        <tr key={`${row.month}-${row.currency}`}>
                          <td>{row.month}</td>
                          <td>{row.currency}</td>
                          <td>{amount(row.incomeMinor, row.currency)}</td>
                          <td>{amount(row.expenseMinor, row.currency)}</td>
                          <td>{amount(row.netMinor, row.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3>Category spending</h3>
                {!result.categories.length ? (
                  <p>No expenses match these filters.</p>
                ) : (
                  <div className="scroll">
                    <table aria-label="Category spending">
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>Currency</th>
                          <th>Money out</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.categories.map((row) => (
                          <tr
                            key={`${row.currency}-${row.categoryId ?? "uncategorized"}`}
                          >
                            <td>{row.category}</td>
                            <td>{row.currency}</td>
                            <td>{amount(row.expenseMinor, row.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </details>
            </>
          ))}
      </details>
    </section>
  );
}
