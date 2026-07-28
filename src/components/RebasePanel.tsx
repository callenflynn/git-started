import { useState } from "react";
import {
  useRebaseCommits,
  useRebaseStatus,
  useStartRebase,
  useRebaseContinue,
  useRebaseAbort,
} from "../hooks/useGit";
import { useRepoStore } from "../stores/repo-store";
import type { RebaseCommit } from "../lib/types";
import { GitBranch, Play, X, AlertTriangle } from "lucide-react";

const OPS = ["pick", "squash", "fixup", "reword", "edit", "drop"] as const;

interface Props {
  branch: string;
  base: string;
  onClose: () => void;
}

export function RebasePanel({ branch, base, onClose }: Props) {
  const repoPath = useRepoStore((s) => s.repoPath);
  const commitsQ = useRebaseCommits(branch, base);
  const statusQ = useRebaseStatus();
  const startMut = useStartRebase();
  const continueMut = useRebaseContinue();
  const abortMut = useRebaseAbort();

  const [operations, setOperations] = useState<RebaseCommit[]>([]);

  // Initialize operations from fetched commits.
  if (commitsQ.data && operations.length === 0 && !statusQ.data?.in_progress) {
    setOperations(
      commitsQ.data.map((c) => ({ ...c, operation: "pick", new_message: null }))
    );
  }

  function updateOp(index: number, field: string, value: string) {
    setOperations((prev) =>
      prev.map((op, i) =>
        i === index ? { ...op, [field]: value } : op
      )
    );
  }

  function moveOp(index: number, direction: -1 | 1) {
    setOperations((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleStart() {
    if (!repoPath || operations.length === 0) return;
    startMut.mutate(
      { onto: base, operations },
      { onSuccess: () => onClose() }
    );
  }

  if (statusQ.data?.in_progress) {
    return (
      <div className="p-4" style={{ background: "var(--bg-card)" }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} style={{ color: "#F59E0B" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Rebase in progress on {statusQ.data.current_head ?? "unknown"}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => continueMut.mutate()}
            disabled={continueMut.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm"
            style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
          >
            <Play size={13} />
            Continue
          </button>
          <button
            onClick={() => abortMut.mutate()}
            disabled={abortMut.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm"
            style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            <X size={13} />
            Abort
          </button>
        </div>
      </div>
    );
  }

  if (commitsQ.isLoading) {
    return (
      <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
        Loading commits...
      </div>
    );
  }

  if (commitsQ.isError) {
    return (
      <div className="p-4 text-sm" style={{ color: "#EF4444" }}>
        Error: {String(commitsQ.error)}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--bg-card)" }}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2">
          <GitBranch size={14} style={{ color: "var(--accent)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Interactive Rebase
          </span>
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {branch} ← {base}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10"
          title="Close"
        >
          <X size={14} style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {/* Commit list */}
      <div className="flex-1 overflow-y-auto">
        {operations.map((op, i) => (
          <div
            key={op.oid}
            className="flex items-center gap-2 px-3 py-1.5 group"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {/* Reorder buttons */}
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => moveOp(i, -1)}
                className="text-[10px] leading-none"
                style={{ color: "var(--text-muted)" }}
                title="Move up"
              >
                ▲
              </button>
              <button
                onClick={() => moveOp(i, 1)}
                className="text-[10px] leading-none"
                style={{ color: "var(--text-muted)" }}
                title="Move down"
              >
                ▼
              </button>
            </div>

            {/* Operation selector */}
            <select
              value={op.operation}
              onChange={(e) => updateOp(i, "operation", e.target.value)}
              className="text-xs px-1 py-0.5 rounded outline-none"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-strong)",
              }}
            >
              {OPS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>

            {/* SHA */}
            <span
              className="text-xs w-16 shrink-0"
              style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              {op.short_oid}
            </span>

            {/* Message (editable for reword/squash) */}
            {(op.operation === "reword" || op.operation === "squash") ? (
              <input
                value={op.new_message ?? op.message}
                onChange={(e) => updateOp(i, "new_message", e.target.value)}
                className="flex-1 text-xs px-2 py-0.5 rounded outline-none"
                style={{
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              />
            ) : (
              <span
                className="flex-1 text-xs truncate"
                style={{ color: "var(--text-secondary)" }}
              >
                {op.message}
              </span>
            )}

            {/* Author */}
            <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>
              {op.author}
            </span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {operations.length} commit{operations.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-sm"
            style={{ background: "var(--bg-secondary)", color: "var(--text-primary)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={startMut.isPending || operations.length === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
          >
            <Play size={13} />
            Start Rebase
          </button>
        </div>
      </div>
    </div>
  );
}
