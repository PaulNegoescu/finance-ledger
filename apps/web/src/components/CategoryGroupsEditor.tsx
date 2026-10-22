import { useState } from "react";
import {
  createCategoryGroup,
  updateCategoryGroup,
  deleteCategoryGroup,
} from "../server/rules";
type Group = { id: string; name: string };
type Props = {
  groups: Group[];
  categories: { groupId?: string | null }[];
  locked: boolean;
  run: (action: () => Promise<string>) => Promise<void>;
};
export function CategoryGroupsEditor({
  groups,
  categories,
  locked,
  run,
}: Props) {
  const [editing, setEditing] = useState<Group | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  return (
    <details className="category-groups-editor">
      <summary>Category groups</summary>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const name = String(new FormData(form).get("groupName"));
          void run(async () => {
            await createCategoryGroup({ data: { name } });
            form.reset();
            return "Group added.";
          });
        }}
      >
        <fieldset disabled={locked}>
          <label>
            New group
            <input
              name="groupName"
              required
              maxLength={80}
              placeholder="Group name"
            />
          </label>
          <button>Add group</button>
        </fieldset>
      </form>
      <ul className="management-list" aria-label="Category groups">
        {groups.map((group) => {
          const count = categories.filter(
            (category) => category.groupId === group.id,
          ).length;
          return (
            <li key={group.id}>
              {editing?.id === group.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(async () => {
                      await updateCategoryGroup({ data: editing });
                      setEditing(null);
                      return "Group updated.";
                    });
                  }}
                >
                  <fieldset disabled={locked}>
                    <label>
                      Group name
                      <input
                        value={editing.name}
                        required
                        maxLength={80}
                        onChange={(event) =>
                          setEditing({ ...editing, name: event.target.value })
                        }
                      />
                    </label>
                    <div className="actions">
                      <button>Save group</button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </fieldset>
                </form>
              ) : (
                <div className="management-row">
                  <span>
                    {group.name}
                    <small className="category-group-label">
                      {count} {count === 1 ? "category" : "categories"}
                    </small>
                  </span>
                  <div className="actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={locked}
                      aria-label={`Rename group ${group.name}`}
                      onClick={() => {
                        setEditing(group);
                        setRemoving(null);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={locked || count > 0}
                      title={
                        count > 0
                          ? "Move categories to another group before deleting."
                          : undefined
                      }
                      aria-label={`Delete group ${group.name}`}
                      onClick={() => setRemoving(group.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
              {removing === group.id && (
                <div className="actions">
                  <span>Delete {group.name}?</span>
                  <button
                    type="button"
                    disabled={locked || count > 0}
                    onClick={() =>
                      void run(async () => {
                        await deleteCategoryGroup({ data: { id: group.id } });
                        setRemoving(null);
                        return "Group deleted.";
                      })
                    }
                  >
                    Confirm delete group
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
          );
        })}
      </ul>
    </details>
  );
}
