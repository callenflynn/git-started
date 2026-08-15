import { useState } from "react";
import { useDialogStore } from "../stores/dialog-store";
import { useReflog, useCreateBranchAt } from "../hooks/useGit";
import { relativeTime } from "../lib/format";
import { X, Copy, GitBranch } from "lucide-react";

export function ReflogDialog() {
  const dialog = useDialogStore((s) => s.dialog);
  const closeDialog = useDialogStore((s) => s.closeDialog);
  const reflog = useReflog();
  const createBranchAt = useCreateBranchAt();
  const [restoring, setRestoring] = useState<string | null>(null);

  if (dialog !== "reflog") return null;

  const entries = reflog.data ?? [];

  function handleRestore(oid: string) {
    const name = window.prompt("Branch name for this commit:");
    if (!name?.trim()) return;
    setRestoring(oid);
    createBranchAt.mutate(
      { name: name.trim(), oid },
      { onSettled: () => setRestoring(null) }
    );
  }

  return (
    <div className="modal-overlay" onClick={closeDialog}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="flex items-center justify-between px-5 h-12 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}>
            <GitBranch size={16} />
            Reflog — recover lost commits
          </span>
          <button onClick={closeDialog} className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto">
          {reflog.isLoading && (
            <div className="p-5 text-sm" style={{ color: "var(--text-muted)" }}>
              Loading reflog...
            </div>
          )}
          {reflog.isError && (
            <div className="p-5 text-sm" style={{ color: "var(--text-muted)" }}>
              Could not load reflog.
            </div>
          )}
          {entries.map((e) => (
            <div
              key={e.oid + e.message}
              className="flex items-center gap-3 px-4 py-2 text-sm"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="shrink-0" style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }} title={e.oid}>
                {e.short_oid}
              </span>
              <span className="flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                {e.message || "(no message)"}
              </span>
              <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                {relativeTime(e.timestamp)}
              </span>
              <button
                onClick={() => handleRestore(e.oid)}
                disabled={restoring === e.oid}
                className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors disabled:opacity-60"
                style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
                title="Create a branch at this commit"
              >
                <GitBranch size={12} />
                {restoring === e.oid ? "…" : "Restore"}
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(e.oid)}
                className="shrink-0 p-1 rounded hover:opacity-70"
                style={{ color: "var(--text-muted)" }}
                title="Copy SHA"
              >
                <Copy size={13} />
              </button>
            </div>
          ))}
          {!reflog.isLoading && !reflog.isError && entries.length === 0 && (
            <div className="p-5 text-sm" style={{ color: "var(--text-muted)" }}>
              No reflog entries.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
