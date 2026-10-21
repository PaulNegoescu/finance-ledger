import { Link } from "@tanstack/react-router";
import { RuleManager } from "./RuleManager";
type Props = {
  data: {
    categories: { id: string; name: string }[];
    rules: {
      id: string;
      contains: string;
      categoryId: string;
      priority: number;
    }[];
  };
  unavailable: boolean;
  onChanged: () => Promise<void>;
};
export function PageHeader({ data, unavailable, onChanged }: Props) {
  return (
    <header className="page-header">
      <Link to="/" className="brand-home">
        Finance Ledger
      </Link>
      <div className="header-navigation">
        <nav aria-label="Pages" className="management-links">
          <Link
            to="/"
            activeOptions={{ exact: true }}
            activeProps={{ "aria-current": "page" }}
          >
            Home
          </Link>
          <Link to="/transactions" activeProps={{ "aria-current": "page" }}>
            Transactions
          </Link>
          <Link to="/overview" activeProps={{ "aria-current": "page" }}>
            Overview
          </Link>
          <Link to="/imports" activeProps={{ "aria-current": "page" }}>
            Import history
          </Link>
        </nav>
        <RuleManager
          categories={data.categories}
          rules={data.rules}
          disabled={unavailable}
          onChanged={onChanged}
        />
      </div>
    </header>
  );
}
