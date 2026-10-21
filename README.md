# Finance Ledger

Fundație pentru o aplicație personală de analiză financiară: TanStack Start full-stack, TypeScript strict, PNPM workspaces și Turborepo. PostgreSQL este unica sursă de adevăr; browserul nu persistă tranzacții. Nu există integrare AI, analytics sau servicii externe pentru datele bancare.

## Structură

- `apps/web`: React + TanStack Start; UI și funcții server colocate, Nitro Node server.
- `packages/core`: validare Zod, profil CSV ING, bani în unități minore întregi, categorisire deterministă.
- `packages/db`: Drizzle ORM, migrări SQL versionate și operații tranzacționale PostgreSQL.
- `fixtures/ing-synthetic.csv`: exclusiv date inventate.

## Pornire cu Docker / Podman Compose

Cerințe: Docker Compose sau Podman cu un provider Compose și o mașină pornită. Porturile sunt publicate exclusiv pe localhost. Aplicația este pentru utilizare personală locală, fără autentificare în această etapă; înainte de acces prin rețea sunt necesare autentificare, autorizare și TLS.

```sh
cp .env.example .env
# Editează .env:
# POSTGRES_PASSWORD=<parolă aleatoare, URL-safe>
# DATABASE_URL=postgres://ledger:<aceeași-parolă>@db:5432/finance_ledger
docker compose up --build -d
docker compose ps
curl --fail http://localhost:3000/health
docker compose logs app
```

Înlocuiește `docker compose` cu `podman compose` dacă preferi Podman. Migrarea se execută înainte de pornirea serverului; un eșec oprește aplicația. Deschide `http://localhost:3000`, creează o categorie și o regulă, apoi importă fișierul fictiv. Poți modifica ulterior categoria fiecărei tranzacții din tabel.

```sh
docker compose down
```

Volumul `ledger_data` păstrează datele la oprire. Nu folosi `down -v` decât dacă vrei ștergerea bazei. Modificarea parolei în `.env` nu schimbă parola unui volum PostgreSQL deja inițializat.

## Dezvoltare locală

Node 24 și PNPM 11.25.0. Din directorul repository-ului:

```sh
pnpm install --frozen-lockfile
docker compose up -d db
# Pentru procesele locale, folosește host localhost, nu db.
export DATABASE_URL='postgres://ledger:<parolă>@localhost:5432/finance_ledger'
pnpm db:migrate
pnpm dev
```

PNPM nu încarcă automat `.env` în procesele CLI. Exportă `DATABASE_URL` înaintea comenzilor de migrare și dezvoltare. Compose citește `.env` automat.

```sh
pnpm build
pnpm typecheck
pnpm test
# Doar pe o bază de test separată; testele adaugă date fictive.
export TEST_DATABASE_URL='postgres://ledger:<parolă>@localhost:5432/ledger_test'
pnpm test:integration
# După modificarea schemei:
pnpm db:generate
pnpm db:migrate
```

Testele de integrare aplică migrările pe baza specificată și verifică importul concurent, deduplicarea, rollback-ul, integritatea referințelor, regulile și categoriile manuale. Sunt omise dacă lipsește `TEST_DATABASE_URL`. CI folosește un PostgreSQL efemer și exclusiv date sintetice. Credentialele din CI sunt demonstrative, nu secrete reale.

## Profil CSV ING Home’Bank — versiunea inițială

Formatul este un adaptor explicit testat pe date sintetice, **nu încă verificat pe un export real Home’Bank**. Nu încărca exporturi reale în Git sau în conversații pentru testare. Variațiile de antet/preambul trebuie adaptate local pe baza structurii anonimizate.

- UTF-8, BOM opțional, separator `;` sau `,`, ghilimele CSV standard, antet pe primul rând; maximum 2 MB și 5000 rânduri.
- Antet recomandat: `Data;Descriere;Debit;Credit;Valuta;Referinta`.
- Alternativ: `Date,Description,Amount,Currency,Reference`, cu sumă semnată. Nu combina `Amount` cu `Debit/Credit`.
- Aliasuri românești: Data tranzacției, Detalii, Detalii tranzacție, Suma, Moneda, Referința; diacriticele și majusculele sunt normalizate.
- Date `DD.MM.YYYY`, `DD/MM/YYYY` sau `YYYY-MM-DD`. Sume `1234,56`, `1.234,56`, `1234.56`; debit/credit sunt pozitive, cu o singură valoare nenulă. Valuta absentă preia valuta contului; valuta diferită este respinsă.
- Sumele se păstrează în bani/centi (două zecimale); RON/EUR/USD în UI. Fără conversie valutară.

Întregul fișier este validat înainte de salvare; toate scrierile unui import sunt atomice. CSV-ul brut nu este stocat. Baza păstrează hash-ul importului, tranzacțiile normalizate și proveniența categoriei. Același CSV pe același cont nu este reimportat. Exporturile suprapuse sunt deduplicate după dată, descriere normalizată, sumă, valută, referință și numărul apariției identice în fișier. Acest număr păstrează tranzacții identice legitime din același export; fără o referință bancară stabilă, exporturile parțiale cu tranzacții identice rămân ambigue. Verifică-le manual; nu tratăm această euristică drept identificator bancar garantat.

Regulile sunt potriviri de subșir fără diferențe de majuscule/diacritice. Ordinea este `priority ASC, id ASC`; valoarea implicită a priorității este 100. Prima regulă câștigă. Modificările regulilor afectează importuri viitoare; aplicarea pe tranzacții existente se declanșează explicit doar pentru cele necategorisite. Reimportul nu suprascrie categoriile manuale. Cazurile fără potrivire rămân de clasificat. Interfața paginează toate tranzacțiile și aplică filtrele pe întregul registru.

## Date și următorii pași

`.env`, importurile și backup-urile sunt ignorate în Git și excluse din imagine. Păstrează exporturile reale în afara repository-ului. Nu pune secrete în variabile `VITE_*`, deoarece acestea ajung în browser. Baza și volumul conțin date sensibile și au nevoie de backup și protecție locală.

Etape următoare: validarea profilului ING pe structură anonimizată, rapoarte, autentificare pentru acces nelocal. PDF este intenționat amânat. Categorisirea rămâne deterministă și manuală.

Configurarea TanStack Start urmează [ghidul oficial](https://tanstack.com/start/latest/docs/framework/react/build-from-scratch) și [integrarea Nitro](https://tanstack.com/start/latest/docs/framework/react/guide/hosting). Versiunile rezolvate sunt fixate în lockfile.

## CSV review before import

The import form now requires **Preview import** followed by **Confirm import**.
Preview does not create accounts, import records or transactions. It lists parsed
transactions (25 per page), identifies rows already present in the selected account,
and reports validation errors by CSV line. For quoted multiline records, the reported
line is the record's ending physical line. File/header errors are shown separately.

Any error blocks the entire import. Valid rows can still be reviewed, but no partial
import is offered. Fix the file and preview again. Changing the file, account or currency
clears the preview; cancel discards it. The browser holds the reviewed CSV only in memory.
Confirmation reparses the file and rechecks duplicates inside the existing atomic import,
so another import between preview and confirmation cannot create duplicates. Counts can
therefore change at confirmation. Reference-free deduplication retains the limitations
of the initial profile described above.

Use `fixtures/ing-synthetic-errors.csv` to check multiple row errors without real banking
data; `fixtures/ing-synthetic.csv` demonstrates valid imports and duplicate-only previews.

## Transaction and rule management

Transactions now use server-side pagination (25 rows per page) with exact counts,
rather than limiting the ledger to the latest 500 rows. Apply search, account,
category, uncategorized and inclusive date filters across the full ledger. Search
matches a literal, case-insensitive description substring; `%` and `_` are not
wildcards. Filters reset the page, and a shortened result set clamps to its last page.

Use the **Manage categories** and **Manage rules** links in the page header to open
separate modal dialogs. The import form uses a compact horizontal layout on wider screens.
Close returns focus to the opening button; Escape closes an idle dialog.
Categories can be renamed, and unused categories can be deleted. Rules can be edited,
prioritized or removed. Lower priority numbers win; ties use the existing stable ID
order. Changes affect future imports. Use **Apply rules to uncategorized** explicitly
to categorize existing unassigned transactions. Manual assignments and existing rule
assignments remain untouched. Deleting a rule retains historical transaction categories
and source labels, while clearing the deleted rule reference. Categories still in use
by transactions or rules cannot be deleted.

CSV validation also rejects malformed internal amount spacing and correctly recognizes
quoted delimiters in headers. After an uncertain confirmation response, preview again
to check what was saved instead of assuming the import failed.

## Overview, import history and bulk categories

Home shows the current month’s overview, using Europe/Bucharest month boundaries.
Use header navigation for **Transactions**, **Import history** and the full **Overview**
page. Reports load automatically on their pages. The full overview
reports money in, money out and net flow by currency, with account/date filters,
monthly totals and category spending. It summarizes all matching transactions rather
than the current page. These are transaction cash flows, not account balances: opening
balances, transfers and currency conversion are not inferred. Currencies are never
combined; SQL aggregates remain exact integer strings and display uses BigInt.

Import history lists saved batches with account, currency, import time and the number
of transactions actually added. Exact-file reimports create no new batch; distinct
fully overlapping exports can show a zero-transaction batch. Original row counts and
skipped counts were not stored, so history does not invent them. Raw CSV data and hashes
are not exposed. History is read-only and supports account filtering and pagination.

Select transaction checkboxes on the current page to reveal bulk category controls.
Choose a category or **Clear category**, then **Apply to selected**. Only explicitly
selected rows change. Every ID and category is validated atomically; a missing row or
invalid category leaves all rows unchanged. Assignments become manual and clear prior
rule references; clearing returns rows to uncategorized. Selection resets when filters,
pages or data change. No cross-page or implicit “all matching transactions” selection
is performed.

## Choosing an account for import

Choose an existing account in the import form; its currency is fixed. With multiple
accounts, the form requires an explicit choice. Select **Create new account…** to enter
a name and currency. The form rejects names matching an existing account after case
and surrounding-space normalization. New accounts are still created only by confirmed
imports, never by preview. After a successful new-account import, the form selects the
saved account. Changing account details clears the preview as before.
