import { useFileHistory } from "../hooks/useGit";
import { useRepoStore } from "../stores/repo-store";
import { relativeTime } from "../lib/format";

export function HistoryView({ file }: { file: string }) {
  const history = useFileHistory(file);
  const selectCommit = useRepoStore((s) => s.selectCommit);

  if (history.isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Loading history...
      </div>
    );
  }
  if (history.isError) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Could not load history.
      </div>
    );
  }

  const commits = history.data ?? [];

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
        No history found for this file.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto text-sm" style={{ background: "var(--bg-card)" }}>
      {commits.map((c) => (
        <button
          key={c.oid}
          onClick={() => selectCommit(c.oid)}
          className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
          style={{ borderBottom: "1px solid var(--border)", background: "transparent" }}
          title={`${c.oid} · ${c.author}`}
        >
          <span className="shrink-0" style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>
            {c.short_oid}
          </span>
          <span className="flex-1 truncate" style={{ color: "var(--text-primary)" }}>
            {c.message}
          </span>
          <span className="shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
            {c.author} · {relativeTime(c.timestamp)}
          </span>
        </button>
      ))}
    </div>
  );
}
