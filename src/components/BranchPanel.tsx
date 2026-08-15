import { useBranches, useCheckout } from "../hooks/useGit";
import { GitBranch } from "lucide-react";
import { PanelHeader } from "./PanelHeader";

export function BranchPanel() {
  const branches = useBranches();
  const checkout = useCheckout();
  const local = (branches.data ?? []).filter((b) => !b.is_remote);

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: "var(--bg-card)" }}>
      <PanelHeader title="Branches" count={local.length} icon={<GitBranch size={13} />} />
      <div className="flex-1 overflow-y-auto">
        {branches.isLoading ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        ) : local.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
            No branches.
          </div>
        ) : (
          local.map((b) => (
            <div
              key={b.name}
              className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors"
              style={{ color: b.is_head ? "var(--accent)" : "var(--text-secondary)" }}
              onDoubleClick={() => checkout.mutate(b.name)}
              title="Double-click to checkout"
            >
              <GitBranch size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="flex-1 truncate">{b.name}</span>
              {b.is_head && (
                <span
                  className="text-[10px] px-1 py-0.5 rounded"
                  style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
                >
                  HEAD
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
