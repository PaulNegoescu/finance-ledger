import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { assignBulkCategories } from "../server/bulk-categories";
import { assignCategory } from "../server/functions";
import { listTransactions } from "../server/transactions";

type Filters = {
  currency?: string;
  flow?: "in" | "out";
  search: string;
  accountId?: string;
  categoryId?: string;
  uncategorized: boolean;
  from?: string;
  to?: string;
};
type Page = Awaited<ReturnType<typeof listTransactions>>;
type Props = {
  categories: { id: string; name: string }[];
  accounts: { id: string; name: string; currency: string }[];
  importId?: string;
  initialFilters?: Partial<Filters>;
  onFiltersChanged?: (filters: Filters) => void;
  revision: number;
  disabled: boolean;
  onAssigned: () => Promise<void>;
};
const emptyFilters: Filters = { search: "", uncategorized: false };
const pageSize = 25;

export function Transactions({
  categories,
  accounts,
  revision,
  disabled,
  onAssigned,
  importId,
  initialFilters,
  onFiltersChanged,
}: Props) {
  const [initial] = useState<Filters>(() => ({
    ...emptyFilters,
    ...initialFilters,
  }));
  const [draft, setDraft] = useState<Filters>(initial);
  const [query, setQuery] = useState({ filters: initial, page: 1 });
  const [result, setResult] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);
  const mutation = useRef(false);
  const selectAll = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkCategory, setBulkCategory] = useState("");
  useEffect(() => {
    if (selectAll.current)
      selectAll.current.indeterminate =
        selected.length > 0 &&
        selected.length < (result?.transactions.length ?? 0);
  }, [selected, result, loading]);

  useEffect(() => {
    setQuery((current) =>
      current.page === 1 ? current : { ...current, page: 1 },
    );
  }, [revision]);

  useEffect(() => {
    const id = ++request.current;
    setLoading(true);
    setSelected([]);
    setBulkCategory("");
    setError("");
    setLoadError(false);
    void listTransactions({
      data: { ...query.filters, importId, page: query.page, pageSize },
    })
      .then((data) => {
        if (request.current !== id) return;
        // Clamp locally as well if a server returns an empty former last page.
        const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
        if (data.page > lastPage) {
          setQuery((current) => ({ ...current, page: lastPage }));
          return;
        }
        setResult(data);
      })
      .catch(() => {
        if (request.current === id) {
          setError("Unable to load transactions. Try again.");
          setLoadError(true);
        }
      })
      .finally(() => {
        if (request.current === id) setLoading(false);
      });
    return () => {
      if (request.current === id) request.current++;
    };
  }, [query, revision, refresh, importId]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("The start date must be on or before the end date.");
      setLoadError(false);
      return;
    }
    setMessage("");
    setSelected([]);
    setBulkCategory("");
    const filters = {
      ...draft,
      search: draft.search.trim(),
      categoryId: draft.uncategorized ? undefined : draft.categoryId,
    };
    if (onFiltersChanged) onFiltersChanged(filters);
    else setQuery({ filters, page: 1 });
  }

  async function assign(id: string, categoryId: string | null) {
    if (disabled || saving || mutation.current) return;
    mutation.current = true;
    setSaving(true);
    setMessage("");
    setError("");
    setLoadError(false);
    let saved = false;
    try {
      await assignCategory({ data: { id, categoryId } });
      saved = true;
      setMessage("Category updated.");
      await onAssigned();
    } catch {
      if (saved)
        setMessage(
          "Category updated. Refresh the page if other data is out of date.",
        );
      else setError("Unable to update the category. Try again.");
    } finally {
      if (saved) setRefresh((value) => value + 1);
      setSaving(false);
      mutation.current = false;
    }
  }

  async function assignSelected() {
    if (
      disabled ||
      saving ||
      loading ||
      loadError ||
      mutation.current ||
      !selected.length ||
      !bulkCategory ||
      !result
    )
      return;
    if (
      selected.some((id) => !result.transactions.some((row) => row.id === id))
    ) {
      setSelected([]);
      return;
    }
    mutation.current = true;
    setSaving(true);
    setError("");
    setLoadError(false);
    setMessage("");
    let saved = false;
    try {
      const response = await assignBulkCategories({
        data: {
          ids: selected,
          categoryId: bulkCategory === "__clear__" ? null : bulkCategory,
        },
      });
      saved = true;
      setSelected([]);
      setBulkCategory("");
      setMessage(`${response.updated} transactions updated.`);
      await onAssigned();
    } catch {
      if (saved)
        setMessage(
          "Selected transactions updated. Refresh the page if other data is out of date.",
        );
      else {
        setSelected([]);
        setMessage(
          "Unable to confirm the bulk update. Review the refreshed transactions before trying again.",
        );
      }
    } finally {
      setRefresh((value) => value + 1);
      setSaving(false);
      mutation.current = false;
    }
  }

  const locked = disabled || saving;
  const totalPages = result
    ? Math.max(1, Math.ceil(result.total / result.pageSize))
    : 1;
  const start =
    result && result.total ? (result.page - 1) * result.pageSize + 1 : 0;
  const end = result
    ? Math.min(result.page * result.pageSize, result.total)
    : 0;
  return (
    <section className="panel ledger" aria-labelledby="transactions-heading">
      {importId && (
        <p className="notice">
          Transactions from one import.{" "}
          <Link to="/transactions" search={{}}>
            Show all transactions
          </Link>
        </p>
      )}
      <h1 id="transactions-heading" className="page-title">
        Transactions
      </h1>
      <form
        onSubmit={applyFilters}
        onChange={() => {
          setSelected([]);
          setBulkCategory("");
        }}
      >
        <fieldset disabled={locked}>
          <div className="transaction-filters">
            <label>
              Search
              <input
                type="search"
                name="search"
                maxLength={200}
                value={draft.search}
                placeholder="Description"
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    search: e.target.value,
                  }))
                }
              />
            </label>
            <label>
              Account
              <select
                name="accountId"
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
              Currency
              <select
                value={draft.currency ?? ""}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    currency: e.target.value || undefined,
                  }))
                }
              >
                <option value="">All currencies</option>
                {[
                  ...new Set([
                    ...accounts.map((account) => account.currency),
                    ...(draft.currency ? [draft.currency] : []),
                  ]),
                ]
                  .sort()
                  .map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
              </select>
            </label>
            <label>
              Flow
              <select
                value={draft.flow ?? ""}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    flow: (e.target.value || undefined) as Filters["flow"],
                  }))
                }
              >
                <option value="">All transactions</option>
                <option value="in">Money in</option>
                <option value="out">Money out</option>
              </select>
            </label>
            <label>
              Category
              <select
                name="categoryId"
                disabled={draft.uncategorized || locked}
                value={draft.categoryId ?? ""}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    categoryId: e.target.value || undefined,
                  }))
                }
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              From
              <input
                name="from"
                type="date"
                value={draft.from ?? ""}
                max={draft.to || undefined}
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
                name="to"
                type="date"
                value={draft.to ?? ""}
                min={draft.from || undefined}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    to: e.target.value || undefined,
                  }))
                }
              />
            </label>
          </div>
          <label>
            <input
              type="checkbox"
              name="uncategorized"
              checked={draft.uncategorized}
              onChange={(e) =>
                setDraft((current) => ({
                  ...current,
                  uncategorized: e.target.checked,
                  categoryId: e.target.checked ? undefined : current.categoryId,
                }))
              }
            />
            Uncategorized only
          </label>
          <div className="actions">
            <button>Apply filters</button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSelected([]);
                setBulkCategory("");
                setDraft(emptyFilters);
                if (onFiltersChanged) onFiltersChanged(emptyFilters);
                else setQuery({ filters: emptyFilters, page: 1 });
                setMessage("");
              }}
            >
              Clear filters
            </button>
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="notice">
          {error}{" "}
          {loadError && (
            <button
              type="button"
              className="secondary"
              disabled={locked || loading}
              onClick={() => setRefresh((value) => value + 1)}
            >
              Retry
            </button>
          )}
        </p>
      )}
      <div role="status" aria-live="polite">
        {message && <p>{message}</p>}
        {loading && <p>Loading transactions…</p>}
        {!loading && !loadError && result && (
          <p>
            {start}–{end} of {result.total} transactions
          </p>
        )}
      </div>
      {!loading &&
        !loadError &&
        selected.length > 0 &&
        !!result?.transactions.length && (
          <div className="bulk-controls">
            <p role="status">{selected.length} selected on this page</p>
            <fieldset className="actions" disabled={locked || !selected.length}>
              <select
                aria-label="Category for selected transactions"
                value={bulkCategory}
                onChange={(event) => setBulkCategory(event.target.value)}
                style={{ width: "auto", marginTop: 0 }}
              >
                <option value="">Choose category</option>
                <option value="__clear__">Clear category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={locked || !selected.length || !bulkCategory}
                onClick={() => void assignSelected()}
              >
                Apply to selected
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSelected([]);
                  setBulkCategory("");
                }}
              >
                Clear selection
              </button>
            </fieldset>
          </div>
        )}
      <div aria-busy={loading}>
        {!loading &&
          !loadError &&
          result &&
          (!result.transactions.length ? (
            <div className="empty">No transactions match these filters.</div>
          ) : (
            <div className="scroll">
              <table aria-label="Transactions">
                <thead>
                  <tr>
                    <th scope="col">
                      <input
                        ref={selectAll}
                        type="checkbox"
                        aria-label="Select all transactions on this page"
                        disabled={locked || loading}
                        checked={
                          !!result.transactions.length &&
                          selected.length === result.transactions.length
                        }
                        onChange={(event) =>
                          setSelected(
                            event.target.checked
                              ? result.transactions.map(
                                  (transaction) => transaction.id,
                                )
                              : [],
                          )
                        }
                      />
                    </th>
                    <th scope="col">Date / account</th>
                    <th scope="col">Description</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Category</th>
                    <th scope="col">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {result.transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${transaction.description} on ${transaction.date} in ${transaction.account}`}
                          checked={selected.includes(transaction.id)}
                          disabled={locked || loading}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked
                                ? Array.from(
                                    new Set([...current, transaction.id]),
                                  )
                                : current.filter((id) => id !== transaction.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        {transaction.date}
                        <small>{transaction.account}</small>
                      </td>
                      <td>{transaction.description}</td>
                      <td
                        className={
                          transaction.amountMinor > 0 ? "positive" : ""
                        }
                      >
                        {new Intl.NumberFormat("en-GB", {
                          style: "currency",
                          currency: transaction.currency,
                        }).format(transaction.amountMinor / 100)}
                      </td>
                      <td>
                        <select
                          aria-label={`Category for ${transaction.description} on ${transaction.date} in ${transaction.account}`}
                          disabled={locked || loading}
                          value={transaction.categoryId ?? ""}
                          onChange={(e) =>
                            void assign(transaction.id, e.target.value || null)
                          }
                        >
                          <option value="">Uncategorized</option>
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {transaction.categorySource === "manual"
                          ? "Manual"
                          : transaction.categorySource === "rule"
                            ? "Rule"
                            : "Uncategorized"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
      </div>
      {result && (
        <nav aria-label="Transaction pages" className="actions">
          <button
            type="button"
            className="secondary"
            disabled={locked || loading || loadError || result.page <= 1}
            onClick={() => {
              setSelected([]);
              setBulkCategory("");
              setQuery((current) => ({ ...current, page: result.page - 1 }));
            }}
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
              locked || loading || loadError || result.page >= totalPages
            }
            onClick={() => {
              setSelected([]);
              setBulkCategory("");
              setQuery((current) => ({ ...current, page: result.page + 1 }));
            }}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
