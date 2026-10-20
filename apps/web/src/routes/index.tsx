import { useState } from "react";
import type { FormEvent } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import {
  addCategory,
  addRule,
  assignCategory,
  importCsv,
  listLedger,
} from "../server/functions";
export const Route = createFileRoute("/")({
  loader: () => listLedger(),
  component: Home,
});
function Home() {
  const { data, unavailable } = Route.useLoaderData();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try {
      setMessage(await action());
      await router.invalidate();
    } catch {
      setMessage(
        "Operația a eșuat. Verifică formatul CSV, valuta contului și conexiunea PostgreSQL. Nu s-au salvat date parțiale.",
      );
    } finally {
      setBusy(false);
    }
  }
  function submitImport(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    void run(async () => {
      const file = form.get("file") as File;
      if (!file || file.size > 2_000_000 || !file.size)
        return "Selectează un CSV UTF-8 de maximum 2 MB.";
      const result = await importCsv({
        data: {
          account: String(form.get("account")),
          currency: String(form.get("currency")),
          csv: await file.text(),
        },
      });
      return `${result.inserted} tranzacții importate; ${result.skipped} deja existente.`;
    });
  }
  const rows = data.transactions.filter(
    (t) => !onlyUnassigned || !t.categoryId,
  );
  return (
    <main>
      <header>
        <span className="brand">FL / FINANCE LEDGER</span>
        <span className="badge">Local · PostgreSQL</span>
      </header>
      <section className="intro">
        <p className="eyebrow">FINANȚELE TALE, ÎN ORDINE</p>
        <h1>Claritate în fiecare tranzacție.</h1>
        <p>
          Importă extrasul, definește reguli și decide tu unde se încadrează
          fiecare cheltuială. Fără AI și fără servicii externe pentru datele
          bancare.
        </p>
      </section>
      {unavailable && (
        <p role="alert" className="notice">
          PostgreSQL nu este disponibil. Configurează conexiunea și rulează
          migrările.
        </p>
      )}
      <p role="status" aria-live="polite">
        {message}
      </p>
      <div className="grid">
        <section className="panel">
          <h2>01 / Import ING CSV</h2>
          <p>
            Profil: Data, Descriere, Debit, Credit, Valuta, Referinta. CSV
            UTF-8, maximum 2 MB / 5000 rânduri.
          </p>
          <form onSubmit={submitImport}>
            <fieldset disabled={busy || unavailable}>
              <label>
                Nume cont
                <input
                  name="account"
                  placeholder="Cont curent"
                  maxLength={100}
                  required
                />
              </label>
              <label>
                Valută
                <select name="currency">
                  <option>RON</option>
                  <option>EUR</option>
                  <option>USD</option>
                </select>
              </label>
              <label>
                Fișier CSV
                <input
                  name="file"
                  type="file"
                  accept=".csv,text/csv"
                  required
                />
              </label>
              <button>Importă tranzacții</button>
            </fieldset>
          </form>
        </section>
        <section className="panel">
          <h2>02 / Categorii și reguli</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                await addCategory({ data: { name: String(form.get("name")) } });
                return "Categoria este disponibilă.";
              });
            }}
          >
            <fieldset disabled={busy || unavailable}>
              <label>
                Categorie nouă
                <input
                  name="name"
                  placeholder="Alimente"
                  maxLength={80}
                  required
                />
              </label>
              <button>Adaugă categoria</button>
            </fieldset>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                await addRule({
                  data: {
                    contains: String(form.get("contains")),
                    categoryId: String(form.get("categoryId")),
                  },
                });
                return "Regula se aplică importurilor viitoare.";
              });
            }}
          >
            <fieldset disabled={busy || unavailable || !data.categories.length}>
              <label>
                Descrierea conține
                <input
                  name="contains"
                  minLength={2}
                  maxLength={120}
                  placeholder="magazin fictiv"
                  required
                />
              </label>
              <label>
                Categorie
                <select name="categoryId">
                  {data.categories.map((c) => (
                    <option value={c.id} key={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button>Adaugă regulă</button>
            </fieldset>
          </form>
          <p>
            {data.rules.length} reguli active. Prima potrivire după prioritate
            și ID câștigă. Regulile noi se aplică doar importurilor viitoare.
          </p>
          <ul>
            {data.rules.map((r) => (
              <li key={r.id}>
                „{r.contains}” →{" "}
                {data.categories.find((c) => c.id === r.categoryId)?.name}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="panel ledger">
        <div className="tableTitle">
          <h2>Tranzacții</h2>
          <label>
            <input
              type="checkbox"
              checked={onlyUnassigned}
              onChange={(e) => setOnlyUnassigned(e.target.checked)}
            />{" "}
            Doar necategorisite
          </label>
        </div>
        <p>
          Ultimele maximum 500 de tranzacții. Sumele sunt păstrate în unități
          minore întregi, separat pe valută.
        </p>
        {!rows.length ? (
          <div className="empty">
            Nicio tranzacție de afișat. Începe cu un import CSV.
          </div>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Data / cont</th>
                  <th>Descriere</th>
                  <th>Sumă</th>
                  <th>Categorie</th>
                  <th>Sursă</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.date}
                      <small>{t.account}</small>
                    </td>
                    <td>{t.description}</td>
                    <td className={t.amountMinor > 0 ? "positive" : ""}>
                      {new Intl.NumberFormat("ro-RO", {
                        style: "currency",
                        currency: t.currency,
                      }).format(t.amountMinor / 100)}
                    </td>
                    <td>
                      <select
                        aria-label={`Categorie pentru ${t.description}`}
                        disabled={busy}
                        value={t.categoryId ?? ""}
                        onChange={(e) => {
                          const categoryId = e.target.value || null;
                          void run(async () => {
                            await assignCategory({
                              data: { id: t.id, categoryId },
                            });
                            return "Categoria a fost actualizată manual.";
                          });
                        }}
                      >
                        <option value="">De clasificat</option>
                        {data.categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{t.categorySource}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <footer>
        CSV-urile originale nu sunt păstrate. PDF și rapoarte avansate: etape
        ulterioare.
      </footer>
    </main>
  );
}
