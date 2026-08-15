import { useReflog, useCreateBranchAt } from "../hooks/useGit";
import { History, Copy, GitBranch } from "lucide-react";
import { PanelHeader } from "./PanelHeader";
import { relativeTime } from "../lib/format";

export function ReflogPanel() {
  const reflog = useReflog();
  const createBranch = useCreateBranchAt();
  const items = reflog.data ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: "var(--bg-card)" }}>
      <PanelHeader title="Reflog" count={items.length} icon={<History size={13} />} />
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
            No reflog entries.
          </div>
        ) : (
          items.map((e, i) => (
            <div
              key={`${e.oid}-${i}`}
              className="group flex items-center gap-2 px-3 py-1.5 text-sm"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span
                className="shrink-0 text-xs"
                style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}
              >
                {e.short_oid}
              </span>
              <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                {e.message}
              </span>
              <span className="shrink-0 text-[10px]" style={{ color: "var(--text-muted)" }}>
                {relativeTime(e.timestamp)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(e.oid)}
                className="p-0.5 rounded transition-colors hover:bg-white/10"
                title="Copy SHA"
                style={{ color: "var(--text-muted)", display: "flex" }}
              >
                <Copy size={12} />
              </button>
              <button
                onClick={() => {
                  const name = window.prompt("Branch name:");
                  if (name?.trim()) createBranch.mutate({ name: name.trim(), oid: e.oid });
                }}
                className="p-0.5 rounded transition-colors hover:bg-white/10"
                title="Create a branch at this commit"
                style={{ color: "var(--text-muted)", display: "flex" }}
              >
                <GitBranch size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
