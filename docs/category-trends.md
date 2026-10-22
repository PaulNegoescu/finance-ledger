# Category trends

Open **Trends** in the header to see monthly money out by category. Select an account,
category group, year and currency. Applied filters are in the URL, so reload and browser
Back restore the report. Invalid URL filters reset to the current-year defaults.

The chart shows the five largest categories and combines the remainder as **Other
categories**. The matrix retains every category and all twelve months, with exact
amounts and group labels. The chart stops at the first and last recorded months;
internal gaps and empty matrix cells mean no recorded money out, not verified bank
statement coverage. Money out includes transfers.

Click a nonempty category/month cell to open its transactions. Account, currency,
calendar-month date boundaries, category (or Uncategorized) and money-out direction
are preserved, so the transaction list reconciles to that cell. Category-group filters
use current category assignments; moving a category to another group changes the report
for its earlier transactions too.

Reports aggregate all matching rows in one database snapshot and keep currencies
separate. SQL returns exact integer strings; displayed amounts and ratios use BigInt.
