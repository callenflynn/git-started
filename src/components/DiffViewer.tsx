import { useRepoStore } from "../stores/repo-store";
import { useDiff } from "../hooks/useGit";

export function DiffViewer() {
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const selectedStaged = useRepoStore((s) => s.selectedStaged);
  const diff = useDiff(selectedFile, selectedStaged);

  if (!selectedFile) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        Select a file to view its diff.
      </div>
    );
  }

  if (diff.isLoading) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        Loading diff...
      </div>
    );
  }

  if (diff.isError) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        Could not load diff.
      </div>
    );
  }

  const lines = (diff.data ?? "").split("\n");

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: "var(--bg-card)" }}
    >
      {/* File name header */}
      <div
        className="sticky top-0 px-4 py-2 text-sm font-medium z-10"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {selectedFile}
        {selectedStaged && (
          <span
            className="ml-2 text-xs px-1.5 py-0.5 rounded"
            style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
          >
            staged
          </span>
        )}
      </div>

      {/* Diff lines */}
      <pre className="text-sm leading-6" style={{ fontFamily: "var(--font-mono)" }}>
        {lines.map((line, i) => {
          let bg = "transparent";
          let color = "var(--text-secondary)";

          if (line.startsWith("+")) {
            bg = "var(--diff-add-bg)";
            color = "#4ADE80";
          } else if (line.startsWith("-")) {
            bg = "var(--diff-del-bg)";
            color = "#F87171";
          } else if (line.startsWith("@@")) {
            bg = "var(--bg-hover)";
            color = "var(--accent)";
          }

          return (
            <div
              key={i}
              className="px-4"
              style={{ background: bg, color }}
            >
              <span className="inline-block w-10 text-right mr-3 select-none opacity-40">
                {line.startsWith("@@") ? "" : i + 1}
              </span>
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
}
