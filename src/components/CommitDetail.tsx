import { useRepoStore } from "../stores/repo-store";
import { useLayoutStore } from "../stores/layout-store";
import { useLog, useCommitDiff } from "../hooks/useGit";
import { relativeTime } from "../lib/format";
import { ResizeHandle } from "./ResizeHandle";
import { GitBranch, GitCommit, Tag, User, Clock, X, FileText } from "lucide-react";

function statusLetter(status: string): string {
  switch (status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    default:
      return "M";
  }
}

function statusColor(status: string): string {
  switch (status) {
    case "added":
      return "#22C55E";
    case "deleted":
      return "#EF4444";
    case "renamed":
      return "#A855F7";
    default:
      return "#F59E0B";
  }
}

/**
 * Details for the commit selected in the graph.
 * Metadata only for now; commit diff + changed files arrive with the
 * backend `get_commit_diff` command in a later milestone.
 */
export function CommitDetail() {
  const selectedCommit = useRepoStore((s) => s.selectedCommit);
  const selectCommit = useRepoStore((s) => s.selectCommit);
  const detailWidth = useLayoutStore((s) => s.detailWidth);
  const setDetailWidth = useLayoutStore((s) => s.setDetailWidth);
  const log = useLog();
  const commit = log.data?.find((c) => c.oid === selectedCommit);
  const files = useCommitDiff(selectedCommit);

  if (!selectedCommit || !commit) return null;

  const date = new Date(commit.timestamp * 1000);

  return (
    <>
      <ResizeHandle
        direction="vertical"
        onDelta={(d) => setDetailWidth((w) => w + d)}
        title="Resize commit details"
      />
      <aside
        className="shrink-0 flex flex-col overflow-y-auto"
        style={{
          width: detailWidth,
          background: "var(--bg-secondary)",
          borderLeft: "1px solid var(--border)",
        }}
      >
      <div
        className="flex items-center justify-between px-3 py-2 sticky top-0 z-10"
        style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Commit
        </span>
        <button
          className="p-0.5 rounded hover:bg-white/10"
          onClick={() => selectCommit(null)}
          title="Close"
        >
          <X size={14} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      <div className="p-3 flex flex-col gap-3">
        {/* Message */}
        <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {commit.message}
        </p>

        {/* OID */}
        <div className="flex items-center gap-1.5">
          <GitCommit size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span className="text-xs font-mono break-all select-text" style={{ color: "var(--text-muted)" }}>
            {commit.oid}
          </span>
        </div>

        {/* Author */}
        <div className="flex items-center gap-1.5">
          <User size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {commit.author}
            {commit.author_email ? (
              <span style={{ color: "var(--text-muted)" }}> &lt;{commit.author_email}&gt;</span>
            ) : null}
          </span>
        </div>

        {/* Date */}
        <div className="flex items-center gap-1.5">
          <Clock size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {date.toLocaleString()} ({relativeTime(commit.timestamp)})
          </span>
        </div>

        {/* Branches */}
        {commit.branch_names.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <GitBranch size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            {commit.branch_names.map((bn) => (
              <span
                key={bn}
                className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
              >
                {bn}
              </span>
            ))}
          </div>
        )}

        {/* Parents */}
        {commit.parent_oids.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Tag size={12} style={{ color: "var(--text-muted)" }} />
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {commit.parent_oids.length} parent{commit.parent_oids.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 pl-5">
              {commit.parent_oids.map((p) => (
                <button
                  key={p}
                  className="text-xs font-mono text-left hover:underline"
                  style={{ color: "var(--text-secondary)" }}
                  onClick={() => selectCommit(p)}
                  title="Select parent commit"
                >
                  {p.slice(0, 10)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Files changed */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <FileText size={12} style={{ color: "var(--text-muted)" }} />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Files changed{files.data ? ` (${files.data.length})` : ""}
            </span>
          </div>
          {files.isLoading ? (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              Loading…
            </span>
          ) : (
            <div className="flex flex-col gap-0.5 pl-5">
              {(files.data ?? []).map((f) => (
                <span
                  key={f.path}
                  className="text-xs font-mono break-all"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <span style={{ color: statusColor(f.status), fontWeight: 700 }}>
                    {statusLetter(f.status)}
                  </span>{" "}
                  {f.path}
                  {f.old_path ? ` ← ${f.old_path}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      </aside>
    </>
  );
}
