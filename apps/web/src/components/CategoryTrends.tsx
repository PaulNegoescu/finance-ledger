import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { currentMonthRange } from "@ledger/core/period";
import { monthBounds } from "@ledger/core/trends";
import { getTrends } from "../server/trends";
import { categoryTrends, trendAmount, trendRatio } from "./trends-data";
import "./category-trends.css";

type Search = { year?: number; accountId?: string; currency?: string };
type Props = {
  search: Search;
  accounts: { id: string; name: string; currency: string }[];
  disabled: boolean;
  revision: number;
  onApply: (search: Search) => void;
};
type Result = Awaited<ReturnType<typeof getTrends>>;
export function CategoryTrends({
  search,
  accounts,
  disabled,
  revision,
  onApply,
}: Props) {
  const [year] = useState(
    () => search.year ?? Number(currentMonthRange().from.slice(0, 4)),
  );
  const [draft, setDraft] = useState({
    year: String(year),
    accountId: search.accountId ?? "",
  });
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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
    void getTrends({
      data: { year, accountId: search.accountId, currency: search.currency },
    })
      .then((data) => {
        if (request.current === id) setResult(data);
      })
      .catch(() => {
        if (request.current === id)
          setError("Unable to load category trends. Try again.");
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      if (request.current === id) request.current++;
    };
  }, [year, search.accountId, search.currency, revision, disabled, refresh]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(draft.year);
    if (!Number.isInteger(value) || value < 1000 || value > 9998) {
      setError("Choose a year between 1000 and 9998.");
      return;
    }
    setRefresh((value) => value + 1);
    onApply({
      year: value,
      accountId: draft.accountId || undefined,
      currency: search.currency,
    });
  }
  const currency = search.currency ?? result?.currencies[0] ?? "";
  const report = categoryTrends(result?.rows ?? [], year, currency);
  const label = (month: string) =>
    new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`));
  return (
    <div className="category-trends">
      <section className="panel">
        <form onSubmit={apply}>
          <fieldset disabled={disabled || loading}>
            <div className="trends-filters">
              <label>
                Account
                <select
                  value={draft.accountId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      accountId: event.target.value,
                    }))
                  }
                >
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option value={account.id} key={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <input
                  type="number"
                  min="1000"
                  max="9998"
                  required
                  value={draft.year}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      year: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Currency
                <select
                  value={currency}
                  onChange={(event) =>
                    onApply({
                      ...search,
                      year,
                      currency: event.target.value || undefined,
                    })
                  }
                  disabled={!result?.currencies.length}
                >
                  <option value="" disabled>
                    Choose currency
                  </option>
                  {[
                    ...new Set([
                      ...(result?.currencies ?? []),
                      ...(search.currency ? [search.currency] : []),
                    ]),
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="actions">
              <button>Apply filters</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setRefresh((value) => value + 1);
                  onApply({});
                }}
              >
                Clear filters
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      {disabled && (
        <p role="alert">
          Category trends are unavailable while the connection is offline.
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
      {loading && <p role="status">Loading category trends…</p>}
      {!loading &&
        result &&
        (report.categories.length ? (
          <>
            <section className="panel" aria-labelledby="trends-chart-title">
              <div className="trends-heading">
                <h2 id="trends-chart-title">Monthly money out</h2>
                <strong>{trendAmount(report.total, currency)}</strong>
              </div>
              <div className="trends-legend">
                {report.series.map((series) => (
                  <span key={series.key}>
                    <i style={{ backgroundColor: series.color }} />
                    {series.name}
                  </span>
                ))}
              </div>
              <div
                className="trends-chart"
                role="img"
                aria-label={`${currency} monthly category money out for ${year}. Exact values are in the category table below.`}
              >
                {report.months
                  .slice(report.first, report.last + 1)
                  .map((month, index) => {
                    const i = index + report.first;
                    return (
                      <div className="trends-chart-month" key={month}>
                        <span className="trends-month-total">
                          {trendAmount(report.totals[i], currency)}
                        </span>
                        <div className="trends-stack">
                          {report.series.map((series) => (
                            <span
                              key={series.key}
                              style={{
                                height: `${trendRatio(series.values[i], report.maximum) * 100}%`,
                                backgroundColor: series.color,
                              }}
                              title={`${series.name}: ${trendAmount(series.values[i], currency)}`}
                            />
                          ))}
                        </div>
                        <span>{label(month)}</span>
                      </div>
                    );
                  })}
              </div>
              <p className="trends-note">
                Money out includes transfers. Empty cells mean no recorded money
                out.
              </p>
            </section>
            <section className="panel">
              <h2>Category by month</h2>
              <div className="scroll">
                <table
                  className="trends-matrix"
                  aria-label={`${currency} category money out by month in ${year}`}
                >
                  <thead>
                    <tr>
                      <th scope="col">Category</th>
                      {report.months.map((month) => (
                        <th scope="col" key={month}>
                          {label(month)}
                        </th>
                      ))}
                      <th scope="col">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.categories.map((category) => (
                      <tr key={category.id ?? "uncategorized"}>
                        <th scope="row">{category.name}</th>
                        {category.values.map((value, i) => (
                          <td
                            key={report.months[i]}
                            style={
                              value > 0n
                                ? {
                                    backgroundColor: `rgba(40, 126, 131, ${0.08 + trendRatio(value, report.maxCell) * 0.3})`,
                                  }
                                : undefined
                            }
                          >
                            {value > 0n ? (
                              <Link
                                to="/transactions"
                                search={{
                                  accountId: search.accountId,
                                  currency,
                                  flow: "out",
                                  ...monthBounds(report.months[i]),
                                  ...(category.id
                                    ? { categoryId: category.id }
                                    : { uncategorized: true }),
                                }}
                                aria-label={`${category.name}, ${report.months[i]}: ${trendAmount(value, currency)}, ${category.counts[i]} transactions`}
                              >
                                {trendAmount(value, currency).replace(
                                  `${currency} `,
                                  "",
                                )}
                              </Link>
                            ) : (
                              <span aria-label="No recorded money out">—</span>
                            )}
                          </td>
                        ))}
                        <td>{trendAmount(category.total, currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th scope="row">Total</th>
                      {report.totals.map((value, i) => (
                        <td key={i}>
                          {trendAmount(value, currency).replace(
                            `${currency} `,
                            "",
                          )}
                        </td>
                      ))}
                      <td>{trendAmount(report.total, currency)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        ) : (
          <section className="panel">
            <p>No money out matches these filters.</p>
          </section>
        ))}
    </div>
  );
}
