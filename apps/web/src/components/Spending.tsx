import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { getOverview } from "../server/overview";
import { groupSpending } from "./group-spending";
import { spendingAmount, spendingReport } from "./spending-data";
import "./spending.css";

type Filters = { accountId?: string; from?: string; to?: string };
type Summary = Awaited<ReturnType<typeof getOverview>>;
type Props = {
  accounts: { id: string; name: string; currency: string }[];
  revision: number;
  disabled: boolean;
  initialFilters?: Filters;
  initialCurrency?: string;
  initialView?: "categories" | "groups";
  onViewChanged?: (view: "categories" | "groups") => void;
  onFiltersChanged?: (filters: Filters) => void;
  onCurrencyChanged?: (currency: string) => void;
};
export function Spending({
  accounts,
  revision,
  disabled,
  initialFilters = {},
  initialCurrency,
  initialView,
  onViewChanged,
  onFiltersChanged,
  onCurrencyChanged,
}: Props) {
  const [draft, setDraft] = useState<Filters>(initialFilters);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [result, setResult] = useState<Summary | null>(null);
  const [currency, setCurrency] = useState(initialCurrency ?? "");
  useEffect(() => {
    setCurrency(
      initialCurrency ??
        result?.categories[0]?.currency ??
        result?.totals[0]?.currency ??
        "",
    );
  }, [initialCurrency, result]);
  const [view, setView] = useState<"categories" | "groups">(
    initialView ?? "groups",
  );
  useEffect(() => {
    setView(initialView ?? "groups");
  }, [initialView]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const id = ++request.current;
    if (disabled) {
      setResult(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    void getOverview({ data: filters })
      .then((data) => {
        if (request.current !== id) return;
        setResult(data);
      })
      .catch(() => {
        if (request.current === id)
          setError("Unable to load spending. Try again.");
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      if (request.current === id) request.current++;
    };
  }, [filters, disabled, revision, refresh]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setValidation("The start date must be on or before the end date.");
      return;
    }
    setValidation("");
    setFilters({ ...draft });
    onFiltersChanged?.({ ...draft });
  }
  const report = spendingReport(result?.categories ?? [], currency);
  const groups = groupSpending(result?.categories ?? [], currency);
  const chart = view === "groups" ? groups : report;
  const categoryGroups = new Map(
    (result?.categories ?? [])
      .filter((row) => row.currency === currency)
      .map((row) => [row.categoryId, row.group]),
  );
  return (
    <div className="spending-report">
      <section className="panel">
        <form onSubmit={apply}>
          <fieldset disabled={disabled || loading}>
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
              <button>Apply filters</button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  setDraft({});
                  setFilters({});
                  onFiltersChanged?.({});
                  setValidation("");
                }}
              >
                Clear filters
              </button>
            </div>
          </fieldset>
        </form>
        {validation && (
          <p role="alert" className="notice">
            {validation}
          </p>
        )}
        {disabled && (
          <p role="alert">
            Spending is unavailable while the connection is offline.
          </p>
        )}
        {error && (
          <p role="alert" className="notice">
            {error}{" "}
            <button
              type="button"
              className="secondary"
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry
            </button>
          </p>
        )}
        <div role="status" aria-live="polite">
          {loading && <p>Loading spending…</p>}
        </div>
        {!loading && !disabled && !error && result && !result.totals.length && (
          <p>No transactions match these filters.</p>
        )}
        {!loading &&
          !disabled &&
          !error &&
          result &&
          result.totals.length > 0 && (
            <label className="spending-currency">
              Currency
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  onCurrencyChanged?.(e.target.value);
                }}
              >
                {!result.totals.some((row) => row.currency === currency) && (
                  <option value={currency}>{currency}</option>
                )}
                {result.totals.map((row) => (
                  <option key={row.currency}>{row.currency}</option>
                ))}
              </select>
            </label>
          )}
      </section>
      {!loading && !disabled && !error && result && currency && (
        <>
          <section className="panel">
            <div className="spending-heading">
              <h2>Money out by {view === "groups" ? "group" : "category"}</h2>
              <strong>{spendingAmount(report.total, currency)}</strong>
            </div>
            <label className="spending-currency">
              Group by
              <select
                value={view}
                onChange={(event) => {
                  const next = event.target.value as "groups" | "categories";
                  setView(next);
                  onViewChanged?.(next);
                }}
              >
                <option value="groups">Groups</option>
                <option value="categories">Categories</option>
              </select>
            </label>
            {chart.chart.length ? (
              <figure
                className="spending-chart"
                aria-label={`Money out by ${view === "groups" ? "group" : "category"} in ${currency}`}
              >
                {chart.chart.map((row) => (
                  <div className="spending-bar-row" key={row.key}>
                    <div className="spending-bar-label">
                      {row.key === "remaining" ? (
                        <span>
                          {row.key === "remaining" && view === "groups"
                            ? `Remaining groups (${groups.ranked.length - 8})`
                            : row.category}
                        </span>
                      ) : (
                        <Link
                          to="/transactions"
                          search={{
                            ...filters,
                            currency,
                            flow: "out",
                            ...(view === "groups"
                              ? row.categoryId
                                ? { groupId: row.categoryId }
                                : { ungrouped: true }
                              : row.categoryId
                                ? { categoryId: row.categoryId }
                                : { uncategorized: true }),
                          }}
                        >
                          {row.category}
                        </Link>
                      )}
                      <span>
                        {spendingAmount(row.expenseMinor, currency)} ·{" "}
                        {chart.share(row.expenseMinor)}
                      </span>
                    </div>
                    <div className="spending-bar-track" aria-hidden="true">
                      <div
                        className={
                          row.key === "uncategorized"
                            ? "spending-bar uncategorized"
                            : "spending-bar"
                        }
                        style={{ width: `${row.width}%` }}
                      />
                    </div>
                  </div>
                ))}
              </figure>
            ) : (
              <p>No money out matches these filters in {currency}.</p>
            )}
            {view === "groups" && groups.ranked.length > 0 && (
              <details>
                <summary>Group breakdown</summary>
                <div className="scroll">
                  <table aria-label={`Group spending in ${currency}`}>
                    <thead>
                      <tr>
                        <th scope="col">Group</th>
                        <th scope="col">Money out</th>
                        <th scope="col">Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.ranked.map((row) => (
                        <tr key={row.categoryId ?? "ungrouped"}>
                          <th scope="row">
                            <Link
                              to="/transactions"
                              search={{
                                ...filters,
                                currency,
                                flow: "out",
                                ...(row.categoryId
                                  ? { groupId: row.categoryId }
                                  : { ungrouped: true }),
                              }}
                            >
                              {row.category}
                            </Link>
                          </th>
                          <td>{spendingAmount(row.expenseMinor, currency)}</td>
                          <td>{groups.share(row.expenseMinor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
            <p className="spending-note">Money out includes transfers.</p>
          </section>
          {report.ranked.length > 0 && (
            <section className="panel">
              <h2>Category breakdown</h2>
              <div className="scroll">
                <table aria-label={`Category spending in ${currency}`}>
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      <th scope="col">Group</th>
                      <th scope="col">Money out</th>
                      <th scope="col">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.ranked.map((row) => (
                      <tr key={row.categoryId ?? "uncategorized"}>
                        <th scope="row">
                          <Link
                            to="/transactions"
                            search={{
                              ...filters,
                              currency,
                              flow: "out",
                              ...(row.categoryId
                                ? { categoryId: row.categoryId }
                                : { uncategorized: true }),
                            }}
                          >
                            {row.category}
                          </Link>
                        </th>
                        <td>
                          {categoryGroups.get(row.categoryId) ?? "Ungrouped"}
                        </td>
                        <td>{spendingAmount(row.expenseMinor, currency)}</td>
                        <td>{report.share(row.expenseMinor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
