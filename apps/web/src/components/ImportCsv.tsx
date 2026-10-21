import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { importCsv, previewCsv } from "../server/functions";

type Review = Awaited<ReturnType<typeof previewCsv>>;
type Input = { account: string; currency: string; csv: string };
const pageSize = 25;
export function ImportCsv({
  disabled,
  onImported,
  children,
}: {
  children?: ReactNode;
  disabled: boolean;
  onImported: () => Promise<void>;
}) {
  const [review, setReview] = useState<{ input: Input; result: Review } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(0);
  async function preview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || disabled) return;
    const form = new FormData(event.currentTarget);
    setReview(null);
    setPage(0);
    setMessage("");
    const file = form.get("file") as File;
    if (!file || !file.size || file.size > 2_000_000) {
      setMessage("Select a UTF-8 CSV file up to 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const bytes = await file.arrayBuffer();
      let csv: string;
      try {
        csv = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        setMessage(
          "The file is not valid UTF-8. Export or save it as UTF-8 and try again.",
        );
        return;
      }
      const input = {
        account: String(form.get("account")),
        currency: String(form.get("currency")),
        csv,
      };
      setReview({ input, result: await previewCsv({ data: input }) });
    } catch {
      setMessage(
        "Unable to preview this file. Check your input and connection, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (
      busy ||
      disabled ||
      !review ||
      review.result.issues.length ||
      !review.result.newCount
    )
      return;
    setBusy(true);
    setMessage("");
    try {
      const result = await importCsv({ data: review.input });
      setReview(null);
      setMessage(
        `${result.inserted} transactions imported; ${result.skipped} already exist.`,
      );
      try {
        await onImported();
      } catch {
        setMessage(
          "Import saved. Refresh the page to update the transaction list.",
        );
      }
    } catch {
      // A lost response cannot tell us whether the atomic import committed.
      setReview(null);
      setMessage(
        "Unable to confirm import. Preview again to check what was saved before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  const result = review?.result;
  const pageCount = Math.ceil((result?.rows.length ?? 0) / pageSize);
  return (
    <div className="grid">
      <section className="panel">
        <h2>Import ING CSV</h2>
        <form
          onSubmit={preview}
          onChange={() => {
            setReview(null);
            setMessage("");
            setPage(0);
          }}
        >
          <fieldset disabled={busy || disabled}>
            <label>
              Account name
              <input
                name="account"
                placeholder="Current account"
                maxLength={100}
                required
              />
            </label>
            <label>
              Currency
              <select name="currency">
                <option>RON</option>
                <option>EUR</option>
                <option>USD</option>
              </select>
            </label>
            <label>
              CSV file (UTF-8, up to 2 MB)
              <input name="file" type="file" accept=".csv,text/csv" required />
            </label>
            <button>{busy ? "Working…" : "Preview import"}</button>
          </fieldset>
        </form>
        <div role="status" aria-live="polite">
          {message && <p>{message}</p>}
        </div>
      </section>
      {children}
      {review && result && (
        <section className="panel import-review">
          <h2>Review import</h2>
          <p>
            {review.input.account} · {review.input.currency}
          </p>
          <p>
            {result.newCount} new · {result.duplicateCount} already imported ·{" "}
            {result.issues.length} errors
          </p>
          {result.issues.length > 0 && (
            <div role="alert" className="notice">
              <p>
                Fix the errors in your CSV and preview it again. Nothing has
                been saved.
              </p>
              <ul className="import-errors">
                {result.issues.map((issue, index) => (
                  <li key={index}>
                    {issue.row ? `Row ${issue.row}: ` : "File: "}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.rows.length > 0 && (
            <>
              <div className="scroll">
                <table aria-label="Import preview">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows
                      .slice(page * pageSize, (page + 1) * pageSize)
                      .map((row) => (
                        <tr key={row.sourceRow}>
                          <td>{row.sourceRow}</td>
                          <td>{row.date}</td>
                          <td>{row.description}</td>
                          <td>
                            {new Intl.NumberFormat("en-GB", {
                              style: "currency",
                              currency: row.currency,
                            }).format(row.amountMinor / 100)}
                          </td>
                          <td>{row.duplicate ? "Already imported" : "New"}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {pageCount > 1 && (
                <nav aria-label="Preview pages" className="actions">
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || page === 0}
                    onClick={() => setPage(page - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page + 1} of {pageCount}
                  </span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || page + 1 >= pageCount}
                    onClick={() => setPage(page + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
          {!result.issues.length && !result.newCount && (
            <p>All transactions have already been imported.</p>
          )}
          <div className="actions">
            <button
              type="button"
              disabled={
                busy || disabled || !!result.issues.length || !result.newCount
              }
              onClick={() => void confirm()}
            >
              Confirm import
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setReview(null);
                setMessage("");
              }}
            >
              Cancel
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
