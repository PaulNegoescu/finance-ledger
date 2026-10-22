# Period comparison

Open **Comparison** to compare two calendar months and optionally one account.
The selected month defaults to the current month in Europe/Bucharest; the comparison
month defaults to the previous month. **Use previous month** changes the draft
comparison month; **Compare months** applies the form.

Each currency has separate money-in, money-out and net-flow totals, paired bars, and
category money-out comparisons. Values and deltas stay exact integer minor units;
only chart geometry is scaled. Percentage changes use the absolute baseline magnitude
and one decimal place, truncated toward zero. Nonzero changes below 0.1% keep their
direction as **+<0.1%** or **−<0.1%**. A zero baseline is shown as **No baseline**.
An absent currency in one month is marked as no recorded activity, with zero recorded
amounts. The current month is explicitly marked incomplete when included.

Both periods load from one database snapshot, so concurrent imports or category changes
cannot leave the two sides inconsistent.

These are recorded transaction cash flows. Transfers remain included, currencies are
not converted, and no account balances are inferred. Categories use their current
assignments; uncategorized activity remains visible. The comparison is a read-only
report and does not alter transactions or categorization rules.
