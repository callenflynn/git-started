import { useStashes, useStashPop } from "../hooks/useGit";
import { Archive, ArrowDownToLine } from "lucide-react";
import { PanelHeader } from "./PanelHeader";

export function StashPanel() {
  const stashes = useStashes();
  const pop = useStashPop();
  const items = stashes.data ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: "var(--bg-card)" }}>
      <PanelHeader title="Stashes" count={items.length} icon={<Archive size={13} />} />
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
            No stashes.
          </div>
        ) : (
          items.map((s) => (
            <button
              key={s.index}
              onClick={() => pop.mutate()}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-white/10"
              style={{ color: "var(--text-secondary)" }}
              title="Apply and drop the most recent stash"
            >
              <ArrowDownToLine size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="flex-1 truncate">{s.message}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
