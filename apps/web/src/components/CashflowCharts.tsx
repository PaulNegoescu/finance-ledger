import { useId, useState } from "react";
import {
  cashflowAmount,
  cashflowRatio,
  cashflowTick,
  cashflowYear,
  type CashflowMonth,
} from "./cashflow-data";
import "./cashflow.css";

export function CashflowCharts({
  months,
  from,
  to,
}: {
  months: CashflowMonth[];
  from?: string;
  to?: string;
}) {
  const years = [...new Set(months.map((row) => row.month.slice(0, 4)))]
    .sort()
    .reverse();
  const [year, setYear] = useState(years[0]);
  const selectedYear = years.includes(year) ? year : years[0];
  const currencies = [
    ...new Set(
      months
        .filter((row) => row.month.startsWith(selectedYear))
        .map((row) => row.currency),
    ),
  ].sort();
  return (
    <section className="cashflow-reports" aria-labelledby="cashflow-title">
      <div className="cashflow-heading">
        <h2 id="cashflow-title">Cash flow</h2>
        <label>
          Chart year
          <select
            value={selectedYear}
            onChange={(event) => setYear(event.target.value)}
          >
            {years.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="cashflow-legend">
        <span>
          <i className="cashflow-in" />
          Money in
        </span>
        <span>
          <i className="cashflow-out" />
          Money out
        </span>
        <span>
          <i className="cashflow-net" />
          Net flow
        </span>
      </div>
      {currencies.map((currency) => (
        <CurrencyChart
          key={currency}
          currency={currency}
          rows={cashflowYear(months, selectedYear, currency, from, to)}
        />
      ))}
    </section>
  );
}

function CurrencyChart({
  currency,
  rows,
}: {
  currency: string;
  rows: CashflowMonth[];
}) {
  const id = useId();
  const maximum = rows.reduce(
    (max, row) =>
      [BigInt(row.incomeMinor), BigInt(row.expenseMinor)].reduce(
        (a, b) => (a > b ? a : b),
        max,
      ),
    0n,
  );
  const negative = rows.some((row) => BigInt(row.netMinor) < 0n);
  const width = 900,
    left = 92,
    right = 24,
    plot = width - left - right;
  const top = 24,
    baseline = negative ? 175 : 226,
    bottom = negative ? 326 : baseline;
  const step = plot / rows.length;
  const scale = (value: bigint) =>
    cashflowRatio(value, maximum) * (baseline - top);
  const netScale = (value: bigint) =>
    value >= 0n
      ? baseline - scale(value)
      : baseline + cashflowRatio(-value, maximum) * (bottom - baseline);
  const points = rows
    .map(
      (row, index) =>
        `${left + (index + 0.5) * step},${netScale(BigInt(row.netMinor))}`,
    )
    .join(" ");
  const monthLabel = (month: string) =>
    new Intl.DateTimeFormat("en-GB", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T00:00:00Z`));
  return (
    <article className="cashflow-currency">
      <h3>{currency}</h3>
      <div className="cashflow-plot">
        <svg
          viewBox={`0 0 ${width} ${bottom + 42}`}
          role="img"
          aria-labelledby={`${id}-title ${id}-description`}
        >
          <title id={`${id}-title`}>{currency} monthly cash flow</title>
          <desc id={`${id}-description`}>
            Money in and money out bars with a net flow line. Gaps between the
            first and last recorded months are zero. Exact values are in the
            table below.
          </desc>
          {[0, 1, 2].map((index) => {
            const minor = (maximum * BigInt(index)) / 2n;
            const y = baseline - scale(minor);
            return (
              <g key={index}>
                <line
                  className="cashflow-grid"
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                />
                <text
                  className="cashflow-tick"
                  x={left - 8}
                  y={y + 4}
                  textAnchor="end"
                >
                  {cashflowTick(minor)}
                </text>
              </g>
            );
          })}
          {negative && (
            <line
              className="cashflow-grid"
              x1={left}
              x2={width - right}
              y1={bottom}
              y2={bottom}
            />
          )}
          {negative && (
            <text
              className="cashflow-tick"
              x={left - 8}
              y={bottom + 4}
              textAnchor="end"
            >
              −{cashflowTick(maximum)}
            </text>
          )}
          {rows.map((row, index) => {
            const center = left + (index + 0.5) * step;
            const bar = Math.min(22, step * 0.28);
            return (
              <g key={row.month}>
                <rect
                  className="cashflow-in"
                  x={center - bar - 2}
                  y={baseline - scale(BigInt(row.incomeMinor))}
                  width={bar}
                  height={scale(BigInt(row.incomeMinor))}
                >
                  <title>
                    {row.month}: money in{" "}
                    {cashflowAmount(row.incomeMinor, currency)}
                  </title>
                </rect>
                <rect
                  className="cashflow-out"
                  x={center + 2}
                  y={baseline - scale(BigInt(row.expenseMinor))}
                  width={bar}
                  height={scale(BigInt(row.expenseMinor))}
                >
                  <title>
                    {row.month}: money out{" "}
                    {cashflowAmount(row.expenseMinor, currency)}
                  </title>
                </rect>
                <text
                  className="cashflow-tick"
                  x={center}
                  y={bottom + 25}
                  textAnchor="middle"
                >
                  {monthLabel(row.month)}
                </text>
              </g>
            );
          })}
          <polyline points={points} className="cashflow-line" />
          {rows.map((row, index) => (
            <circle
              key={row.month}
              cx={left + (index + 0.5) * step}
              cy={netScale(BigInt(row.netMinor))}
              r="3"
              className="cashflow-point"
            >
              <title>
                {row.month}: net flow {cashflowAmount(row.netMinor, currency)};{" "}
                {row.count} recorded transactions
              </title>
            </circle>
          ))}
        </svg>
      </div>
      <details className="cashflow-values">
        <summary>{currency} chart values</summary>
        <div className="scroll">
          <table aria-label={`${currency} cash flow chart values`}>
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col">Money in</th>
                <th scope="col">Money out</th>
                <th scope="col">Net flow</th>
                <th scope="col">Transactions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.month}>
                  <th scope="row">{row.month}</th>
                  <td>{cashflowAmount(row.incomeMinor, currency)}</td>
                  <td>{cashflowAmount(row.expenseMinor, currency)}</td>
                  <td>{cashflowAmount(row.netMinor, currency)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </article>
  );
}
