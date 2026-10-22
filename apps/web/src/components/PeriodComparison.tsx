import { useEffect, useRef, useState, type FormEvent } from "react";
import { currentMonthRange } from "@ledger/core/period";
import {
  comparePeriods,
  comparisonAmount,
  comparisonBarPercent,
  monthRange,
  percentageChange,
  periodChange,
  previousMonth,
} from "@ledger/core/comparison";
import { getComparison } from "../server/overview";
import { comparisonDefaults } from "./report-search";
import "./period-comparison.css";

type Props = {
  accounts: { id: string; name: string; currency: string }[];
  revision: number;
  disabled: boolean;
  initialFilters?: Partial<Filters>;
  onFiltersChanged?: (filters: Filters) => void;
};
type Result = Awaited<ReturnType<typeof getComparison>>;
type Filters = { selected: string; baseline: string; accountId: string };
function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T12:00:00Z`));
}
function delta(selected: string, baseline: string, currency: string) {
  const change = periodChange(selected, baseline);
  return (
    <>
      <span>
        {BigInt(change.difference) > 0n ? "+" : ""}
        {comparisonAmount(change.difference, currency)}
      </span>
      <small>{percentageChange(change.percentTenths, change.difference)}</small>
    </>
  );
}
export function PeriodComparison({
  accounts,
  revision,
  disabled,
  initialFilters,
  onFiltersChanged,
}: Props) {
  const [currentMonth] = useState(() => currentMonthRange().from.slice(0, 7));
  const [draft, setDraft] = useState<Filters>(() =>
    comparisonDefaults(initialFilters ?? {}, currentMonth),
  );
  const [filters, setFilters] = useState(draft);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const request = useRef(0);
  useEffect(() => {
    const id = ++request.current;
    if (disabled) {
      setResult(null);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    const accountId = filters.accountId || undefined;
    void getComparison({
      data: {
        selected: { ...monthRange(filters.selected), accountId },
        baseline: { ...monthRange(filters.baseline), accountId },
      },
    })
      .then((data) => {
        if (request.current === id) setResult(data);
      })
      .catch(() => {
        if (request.current === id)
          setError("Unable to load the comparison. Try again.");
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      if (request.current === id) request.current++;
    };
  }, [filters, disabled, revision, retry]);
  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      monthRange(draft.selected);
      monthRange(draft.baseline);
    } catch {
      setError("Choose two valid months.");
      return;
    }
    setFilters({ ...draft });
    onFiltersChanged?.({ ...draft });
  }
  const reports = result
    ? comparePeriods(result.selected, result.baseline)
    : [];
  return (
    <div className="comparison-report">
      <section className="panel">
        <form onSubmit={apply}>
          <fieldset disabled={disabled}>
            <div className="comparison-filters">
              <label>
                Selected month
                <input
                  type="month"
                  required
                  min="1000-02"
                  max="9999-12"
                  value={draft.selected}
                  onChange={(event) =>
                    setDraft({ ...draft, selected: event.target.value })
                  }
                />
              </label>
              <label>
                Compare with
                <input
                  type="month"
                  required
                  min="1000-01"
                  max="9999-12"
                  value={draft.baseline}
                  onChange={(event) =>
                    setDraft({ ...draft, baseline: event.target.value })
                  }
                />
              </label>
              <label>
                Account
                <select
                  value={draft.accountId}
                  onChange={(event) =>
                    setDraft({ ...draft, accountId: event.target.value })
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
            </div>
            <div className="actions">
              <button>Compare months</button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  try {
                    setDraft({
                      ...draft,
                      baseline: previousMonth(draft.selected),
                    });
                    setError("");
                  } catch {
                    setError("Choose a valid selected month first.");
                  }
                }}
              >
                Use previous month
              </button>
            </div>
          </fieldset>
        </form>
      </section>
      {disabled && (
        <p role="alert">
          Comparison is unavailable while the connection is offline.
        </p>
      )}
      {error && (
        <p role="alert" className="notice">
          {error}{" "}
          <button
            type="button"
            className="secondary"
            disabled={disabled}
            onClick={() => setRetry((value) => value + 1)}
          >
            Retry comparison
          </button>
        </p>
      )}
      {loading && (
        <p role="status" aria-live="polite">
          Loading comparison…
        </p>
      )}
      {!loading && result && (
        <>
          {(filters.selected === currentMonth ||
            filters.baseline === currentMonth) && (
            <p className="notice">
              The current month is incomplete. Both periods include all recorded
              transactions within each calendar month.
            </p>
          )}
          {!reports.length && <p>No transactions in either month.</p>}
          {reports.map((report) => {
            const selectedLabel = monthLabel(filters.selected);
            const baselineLabel = monthLabel(filters.baseline);
            const max = [
              report.selected.incomeMinor,
              report.selected.expenseMinor,
              report.baseline.incomeMinor,
              report.baseline.expenseMinor,
            ].reduce((a, b) => (BigInt(a) > BigInt(b) ? a : b), "0");
            const categoryMax = report.categories.reduce(
              (max, row) =>
                [max, row.selected, row.baseline].reduce((a, b) =>
                  BigInt(a) > BigInt(b) ? a : b,
                ),
              "0",
            );
            return (
              <section
                className="panel"
                key={report.currency}
                aria-label={`${report.currency} comparison`}
              >
                <h2>{report.currency}</h2>
                <div className="comparison-legend">
                  <span>
                    <i className="comparison-key selected" />
                    {selectedLabel}
                  </span>
                  <span>
                    <i className="comparison-key baseline" />
                    {baselineLabel}
                  </span>
                </div>
                {report.selected.count === 0 && (
                  <p>
                    No recorded activity in {selectedLabel} for{" "}
                    {report.currency}.
                  </p>
                )}
                {report.baseline.count === 0 && (
                  <p>
                    No recorded activity in {baselineLabel} for{" "}
                    {report.currency}.
                  </p>
                )}
                <div className="comparison-flow" aria-hidden="true">
                  {(
                    [
                      ["Money in", "incomeMinor"],
                      ["Money out", "expenseMinor"],
                    ] as const
                  ).map(([label, key]) => (
                    <div className="comparison-flow-group" key={key}>
                      <strong>{label}</strong>
                      <div className="comparison-bar-line">
                        <span
                          className="comparison-bar-track"
                          aria-hidden="true"
                        >
                          <span
                            className="comparison-bar selected"
                            style={{
                              width: `${comparisonBarPercent(report.selected[key], max)}%`,
                            }}
                          />
                        </span>
                        <span>
                          {comparisonAmount(
                            report.selected[key],
                            report.currency,
                          )}
                        </span>
                      </div>
                      <div className="comparison-bar-line">
                        <span
                          className="comparison-bar-track"
                          aria-hidden="true"
                        >
                          <span
                            className="comparison-bar baseline"
                            style={{
                              width: `${comparisonBarPercent(report.baseline[key], max)}%`,
                            }}
                          />
                        </span>
                        <span>
                          {comparisonAmount(
                            report.baseline[key],
                            report.currency,
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="scroll">
                  <table aria-label={`${report.currency} totals comparison`}>
                    <thead>
                      <tr>
                        <th>Measure</th>
                        <th>{selectedLabel}</th>
                        <th>{baselineLabel}</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Money in", "incomeMinor"],
                          ["Money out", "expenseMinor"],
                          ["Net flow", "netMinor"],
                        ] as const
                      ).map(([label, key]) => (
                        <tr key={key}>
                          <th scope="row">{label}</th>
                          <td>
                            {comparisonAmount(
                              report.selected[key],
                              report.currency,
                            )}
                          </td>
                          <td>
                            {comparisonAmount(
                              report.baseline[key],
                              report.currency,
                            )}
                          </td>
                          <td className="comparison-change">
                            {delta(
                              report.selected[key],
                              report.baseline[key],
                              report.currency,
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <th scope="row">Transactions</th>
                        <td>{report.selected.count}</td>
                        <td>{report.baseline.count}</td>
                        <td>{report.selected.count - report.baseline.count}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <h3>Category money out</h3>
                {!report.categories.length ? (
                  <p>No money out in either month.</p>
                ) : (
                  <div className="scroll">
                    <table
                      aria-label={`${report.currency} category comparison`}
                    >
                      <thead>
                        <tr>
                          <th>Category</th>
                          <th>{selectedLabel}</th>
                          <th>{baselineLabel}</th>
                          <th>Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.categories.map((row) => (
                          <tr key={row.id ?? "uncategorized"}>
                            <th scope="row">
                              {row.category}
                              <span
                                className="comparison-category-bars"
                                aria-hidden="true"
                              >
                                <span
                                  className="selected"
                                  style={{
                                    width: `${comparisonBarPercent(row.selected, categoryMax)}%`,
                                  }}
                                />
                                <span
                                  className="baseline"
                                  style={{
                                    width: `${comparisonBarPercent(row.baseline, categoryMax)}%`,
                                  }}
                                />
                              </span>
                            </th>
                            <td>
                              {comparisonAmount(row.selected, report.currency)}
                            </td>
                            <td>
                              {comparisonAmount(row.baseline, report.currency)}
                            </td>
                            <td className="comparison-change">
                              {delta(
                                row.selected,
                                row.baseline,
                                report.currency,
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
