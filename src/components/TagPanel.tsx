import { useTags, useCreateTag, useDeleteTag } from "../hooks/useGit";
import { Tag, Plus, Trash2 } from "lucide-react";
import { PanelHeader } from "./PanelHeader";

export function TagPanel() {
  const tags = useTags();
  const create = useCreateTag();
  const del = useDeleteTag();
  const items = tags.data ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: "var(--bg-card)" }}>
      <PanelHeader title="Tags" count={items.length} icon={<Tag size={13} />}>
        <button
          onClick={() => {
            const name = window.prompt("Tag name:");
            if (name?.trim()) create.mutate(name.trim());
          }}
          className="p-1 rounded transition-colors hover:bg-white/10"
          title="Create tag"
          style={{ color: "var(--text-muted)", display: "flex" }}
        >
          <Plus size={13} />
        </button>
      </PanelHeader>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
            No tags.
          </div>
        ) : (
          items.map((t) => (
            <div
              key={t.name}
              className="group flex items-center gap-2 px-3 py-1.5 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <Tag size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="flex-1 truncate">{t.name}</span>
              <button
                onClick={() => del.mutate(t.name)}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity hover:bg-red-500/20"
                title="Delete tag"
                style={{ color: "var(--text-muted)", display: "flex" }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
