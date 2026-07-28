import { useConflicts, useResolveConflict } from "../hooks/useGit";
import type { ConflictFile } from "../lib/types";
import { AlertTriangle, Check } from "lucide-react";

function ConflictItem({ conflict }: { conflict: ConflictFile }) {
  const resolveMut = useResolveConflict();

  function resolve(side: string) {
    resolveMut.mutate({ filePath: conflict.path, side });
  }

  return (
    <div
      className="flex flex-col gap-2 px-3 py-2"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={13} style={{ color: "#F59E0B", flexShrink: 0 }} />
        <span className="text-sm truncate flex-1"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
          {conflict.path}
        </span>
      </div>

      <div className="flex gap-1.5">
        {conflict.ours !== null && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-green-500/20"
            style={{ color: "#22C55E", border: "1px solid #22C55E/30" }}
            onClick={() => resolve("ours")}
            disabled={resolveMut.isPending}
            title="Keep our version"
          >
            <Check size={11} />
            Ours
          </button>
        )}
        {conflict.theirs !== null && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-blue-500/20"
            style={{ color: "#3B82F6", border: "1px solid #3B82F6/30" }}
            onClick={() => resolve("theirs")}
            disabled={resolveMut.isPending}
            title="Keep their version"
          >
            <Check size={11} />
            Theirs
          </button>
        )}
        {conflict.ancestor !== null && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors hover:bg-purple-500/20"
            style={{ color: "#A855F7", border: "1px solid #A855F7/30" }}
            onClick={() => resolve("base")}
            disabled={resolveMut.isPending}
            title="Keep base version"
          >
            <Check size={11} />
            Base
          </button>
        )}
      </div>
    </div>
  );
}

export function ConflictPanel() {
  const conflicts = useConflicts();
  const conflictFiles = conflicts.data ?? [];

  if (conflicts.isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-sm"
           style={{ color: "var(--text-muted)" }}>
        Checking for conflicts...
      </div>
    );
  }

  if (conflictFiles.length === 0) {
    return null;
  }

  return (
    <div
      className="overflow-y-auto shrink-0"
      style={{
        background: "rgba(245,158,11,0.05)",
        borderBottom: "1px solid #F59E0B/30",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2"
           style={{ borderBottom: "1px solid #F59E0B/20" }}>
        <AlertTriangle size={14} style={{ color: "#F59E0B" }} />
        <span className="text-sm font-semibold" style={{ color: "#F59E0B" }}>
          Merge Conflicts ({conflictFiles.length})
        </span>
      </div>
      {conflictFiles.map((c) => (
        <ConflictItem key={c.path} conflict={c} />
      ))}
    </div>
  );
}
