import { useDialogStore } from "../stores/dialog-store";
import { useRepoStats } from "../hooks/useGit";
import { X, BarChart3 } from "lucide-react";

function fmtDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-3 px-2 rounded-lg"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
    >
      <span className="text-xl font-semibold" style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
        {value}
      </span>
      <span className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

export function RepoSummaryDialog() {
  const dialog = useDialogStore((s) => s.dialog);
  const closeDialog = useDialogStore((s) => s.closeDialog);
  const stats = useRepoStats();

  if (dialog !== "summary") return null;

  const s = stats.data;

  return (
    <div className="modal-overlay" onClick={closeDialog}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div
          className="flex items-center justify-between px-5 h-12 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="flex items-center gap-2 font-semibold" style={{ color: "var(--text-primary)" }}>
            <BarChart3 size={16} />
            Repository summary
          </span>
          <button onClick={closeDialog} className="p-1 rounded hover:opacity-70" style={{ color: "var(--text-muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {stats.isLoading && (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Loading summary...
            </div>
          )}
          {stats.isError && (
            <div className="text-sm" style={{ color: "var(--text-muted)" }}>
              Could not load summary.
            </div>
          )}
          {s && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <Stat label="Commits" value={s.commits} />
                <Stat label="Branches" value={s.branches} />
                <Stat label="Tags" value={s.tags} />
                <Stat label="Remotes" value={s.remotes} />
                <Stat label="Stashes" value={s.stashes} />
                <Stat label="Contributors" value={s.contributors} />
              </div>
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>Current branch</span>
                  <span style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{s.head_branch}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>Working tree</span>
                  <span style={{ color: s.is_dirty ? "#F59E0B" : "#22C55E" }}>
                    {s.is_dirty ? "Modified" : "Clean"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>First commit</span>
                  <span style={{ color: "var(--text-secondary)" }}>{fmtDate(s.first_commit_time)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--text-muted)" }}>Latest commit</span>
                  <span style={{ color: "var(--text-secondary)" }}>{fmtDate(s.last_commit_time)}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
