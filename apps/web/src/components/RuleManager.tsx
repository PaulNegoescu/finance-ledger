import { useState } from "react";
import "./category-groups.css";
import { CategoryGroupsEditor } from "./CategoryGroupsEditor";
import { Modal } from "./Modal";
import {
  applyRules,
  createCategory,
  createRule,
  deleteCategory,
  deleteRule,
  updateCategory,
  updateRule,
} from "../server/rules";

type Category = { id: string; name: string; groupId?: string | null };
type Rule = {
  id: string;
  contains: string;
  categoryId: string;
  priority: number;
};
type Props = {
  categories: Category[];
  groups?: { id: string; name: string }[];
  rules: Rule[];
  disabled: boolean;
  onChanged: () => Promise<void>;
};

export function RuleManager({
  categories,
  groups = [],
  rules,
  disabled,
  onChanged,
}: Props) {
  const [mode, setMode] = useState<"categories" | "rules" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [removing, setRemoving] = useState<{
    kind: "category" | "rule";
    id: string;
  } | null>(null);
  const locked = disabled || busy;
  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage("");
    try {
      const result = await action();
      setEditingCategory(null);
      setEditingRule(null);
      setRemoving(null);
      setMessage(result);
      try {
        await onChanged();
      } catch {
        setMessage(`${result} Refresh the page to see the latest changes.`);
      }
    } catch {
      setMessage(
        "Unable to save changes. Check your connection, use unique category and group names, and clear category assignments or group memberships before deleting.",
      );
    } finally {
      setBusy(false);
    }
  }
  function open(next: "categories" | "rules") {
    setMessage("");
    setEditingCategory(null);
    setEditingRule(null);
    setRemoving(null);
    setMode(next);
  }
  return (
    <>
      <nav className="management-links" aria-label="Management">
        <button
          type="button"
          className="header-link"
          aria-haspopup="dialog"
          disabled={locked}
          onClick={() => open("categories")}
        >
          Manage categories
        </button>
        <button
          type="button"
          className="header-link"
          aria-haspopup="dialog"
          disabled={locked}
          onClick={() => open("rules")}
        >
          Manage rules
        </button>
      </nav>
      {mode && (
        <Modal
          title={mode === "categories" ? "Manage categories" : "Manage rules"}
          busy={busy}
          onClose={() => setMode(null)}
        >
          <div role="status" aria-live="polite">
            {message && <p>{message}</p>}
          </div>
          {mode === "categories" ? (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const values = new FormData(form);
                  void run(async () => {
                    await createCategory({
                      data: {
                        name: String(values.get("name")),
                        groupId: String(values.get("groupId")) || null,
                      },
                    });
                    form.reset();
                    return "Category added.";
                  });
                }}
              >
                <fieldset disabled={locked}>
                  <label>
                    New category
                    <input
                      name="name"
                      placeholder="Groceries"
                      maxLength={80}
                      required
                    />
                  </label>
                  <label>
                    Group
                    <select name="groupId" defaultValue="">
                      <option value="">Ungrouped</option>
                      {groups.map((group) => (
                        <option key={group.id} value={group.id}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button>Add category</button>
                </fieldset>
              </form>
              <CategoryGroupsEditor
                groups={groups}
                categories={categories}
                locked={locked}
                run={run}
              />
              {categories.length > 0 && (
                <ul className="management-list" aria-label="Categories">
                  {categories.map((category) => (
                    <li key={category.id}>
                      {editingCategory?.id === category.id ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void run(async () => {
                              await updateCategory({ data: editingCategory });
                              return "Category updated.";
                            });
                          }}
                        >
                          <fieldset disabled={locked}>
                            <label>
                              Category name
                              <input
                                value={editingCategory.name}
                                onChange={(event) =>
                                  setEditingCategory({
                                    ...editingCategory,
                                    name: event.target.value,
                                  })
                                }
                                maxLength={80}
                                required
                              />
                            </label>
                            <label>
                              Group
                              <select
                                value={editingCategory.groupId ?? ""}
                                onChange={(event) =>
                                  setEditingCategory({
                                    ...editingCategory,
                                    groupId: event.target.value || null,
                                  })
                                }
                              >
                                <option value="">Ungrouped</option>
                                {groups.map((group) => (
                                  <option key={group.id} value={group.id}>
                                    {group.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="actions">
                              <button>Save category</button>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setEditingCategory(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </fieldset>
                        </form>
                      ) : (
                        <div className="management-row">
                          <span>
                            {category.name}
                            <small className="category-group-label">
                              {groups.find(
                                (group) => group.id === category.groupId,
                              )?.name ?? "Ungrouped"}
                            </small>
                          </span>
                          <div className="actions">
                            <button
                              type="button"
                              className="secondary"
                              disabled={locked}
                              onClick={() => {
                                setEditingCategory(category);
                                setRemoving(null);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              disabled={locked}
                              onClick={() =>
                                setRemoving({
                                  kind: "category",
                                  id: category.id,
                                })
                              }
                              aria-label={`Delete category ${category.name}`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                      {removing?.kind === "category" &&
                        removing.id === category.id && (
                          <div className="actions">
                            <span>
                              Delete {category.name}? Categories in use cannot
                              be deleted.
                            </span>
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() =>
                                void run(async () => {
                                  await deleteCategory({
                                    data: { id: category.id },
                                  });
                                  return "Category deleted.";
                                })
                              }
                            >
                              Confirm delete category
                            </button>
                            <button
                              type="button"
                              className="secondary"
                              disabled={locked}
                              onClick={() => setRemoving(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                    </li>
                  ))}
                </ul>
              )}{" "}
            </>
          ) : (
            <>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  const values = new FormData(form);
                  void run(async () => {
                    await createRule({
                      data: {
                        contains: String(values.get("contains")),
                        categoryId: String(values.get("categoryId")),
                        priority: Number(values.get("priority")),
                      },
                    });
                    form.reset();
                    return "Rule added for future imports.";
                  });
                }}
              >
                <fieldset disabled={locked || !categories.length}>
                  <label>
                    Description contains
                    <input
                      name="contains"
                      minLength={2}
                      maxLength={120}
                      placeholder="Merchant name"
                      required
                    />
                  </label>
                  <label>
                    Category
                    <select name="categoryId">
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Priority (lower number first)
                    <input
                      name="priority"
                      type="number"
                      min={0}
                      max={10000}
                      step={1}
                      defaultValue={100}
                      required
                    />
                  </label>
                  <button>Add rule</button>
                </fieldset>
              </form>
              {rules.length > 0 && (
                <ul
                  className="management-list"
                  aria-label="Categorization rules"
                >
                  {[...rules]
                    .sort(
                      (a, b) =>
                        a.priority - b.priority || a.id.localeCompare(b.id),
                    )
                    .map((rule) => (
                      <li key={rule.id}>
                        {editingRule?.id === rule.id ? (
                          <form
                            onSubmit={(event) => {
                              event.preventDefault();
                              void run(async () => {
                                await updateRule({ data: editingRule });
                                return "Rule updated for future imports.";
                              });
                            }}
                          >
                            <fieldset disabled={locked}>
                              <label>
                                Description contains
                                <input
                                  value={editingRule.contains}
                                  onChange={(event) =>
                                    setEditingRule({
                                      ...editingRule,
                                      contains: event.target.value,
                                    })
                                  }
                                  minLength={2}
                                  maxLength={120}
                                  required
                                />
                              </label>
                              <label>
                                Category
                                <select
                                  value={editingRule.categoryId}
                                  onChange={(event) =>
                                    setEditingRule({
                                      ...editingRule,
                                      categoryId: event.target.value,
                                    })
                                  }
                                >
                                  {categories.map((category) => (
                                    <option
                                      key={category.id}
                                      value={category.id}
                                    >
                                      {category.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                Priority (lower number first)
                                <input
                                  type="number"
                                  min={0}
                                  max={10000}
                                  step={1}
                                  value={
                                    Number.isFinite(editingRule.priority)
                                      ? editingRule.priority
                                      : ""
                                  }
                                  onChange={(event) =>
                                    setEditingRule({
                                      ...editingRule,
                                      priority: event.target.valueAsNumber,
                                    })
                                  }
                                  required
                                />
                              </label>
                              <div className="actions">
                                <button>Save rule</button>
                                <button
                                  type="button"
                                  className="secondary"
                                  onClick={() => setEditingRule(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </fieldset>
                          </form>
                        ) : (
                          <div className="management-row">
                            <span>
                              {rule.priority}: “{rule.contains}” →{" "}
                              {
                                categories.find(
                                  (category) => category.id === rule.categoryId,
                                )?.name
                              }
                            </span>
                            <div className="actions">
                              <button
                                type="button"
                                className="secondary"
                                disabled={locked}
                                onClick={() => {
                                  setEditingRule(rule);
                                  setRemoving(null);
                                }}
                                aria-label={`Edit rule ${rule.contains}`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={locked}
                                onClick={() =>
                                  setRemoving({ kind: "rule", id: rule.id })
                                }
                                aria-label={`Delete rule ${rule.contains}`}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                        {removing?.kind === "rule" &&
                          removing.id === rule.id && (
                            <div className="actions">
                              <span>
                                Delete this rule? Existing categories will be
                                kept.
                              </span>
                              <button
                                type="button"
                                disabled={locked}
                                onClick={() =>
                                  void run(async () => {
                                    await deleteRule({ data: { id: rule.id } });
                                    return "Rule deleted. Existing categories were kept.";
                                  })
                                }
                              >
                                Confirm delete rule
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                disabled={locked}
                                onClick={() => setRemoving(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                      </li>
                    ))}
                </ul>
              )}
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={locked || !rules.length}
                  onClick={() =>
                    void run(async () => {
                      const result = await applyRules();
                      return `${result.updated} uncategorized transactions categorized. Existing categories were kept.`;
                    })
                  }
                >
                  Apply rules to uncategorized
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}
