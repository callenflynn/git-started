import { useEffect, useMemo, useState } from "react";
import { useRepoStore } from "../stores/repo-store";
import { useDiff, useImageVersions, useStageLines } from "../hooks/useGit";
import { Columns2, Rows3, Plus, Minus, X } from "lucide-react";

const IMAGE_RE = /\.(png|jpe?g|gif|webp|bmp|ico|tiff?)$/i;

function mimeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    ico: "image/x-icon",
    tif: "image/tiff",
    tiff: "image/tiff",
  };
  return map[ext] ?? "image/png";
}

type Row = {
  left: string | null;
  right: string | null;
  leftNum: number | null;
  rightNum: number | null;
  kind: "ctx" | "add" | "del" | "hdr";
};

// A single diff line with the line numbers it maps to in the old/new file.
type DiffLine = {
  key: number;
  prefix: string;
  content: string;
  oldNum: number | null;
  newNum: number | null;
};

function isMeta(line: string): boolean {
  return (
    line.startsWith("diff --git") ||
    line.startsWith("index ") ||
    line.startsWith("---") ||
    line.startsWith("+++") ||
    line.startsWith("new file") ||
    line.startsWith("deleted file") ||
    line.startsWith("similarity") ||
    line.startsWith("rename")
  );
}

// Parse a unified patch into a flat list of lines with accurate old/new
// line numbers (needed for line-level staging).
function parseLines(text: string): DiffLine[] {
  const out: DiffLine[] = [];
  const lines = text.split("\n");
  let oldNum = 0;
  let newNum = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      const m = /-(\d+)(?:,\d+)? \+(\d+)(?:,\d+)?/.exec(line);
      if (m) {
        oldNum = parseInt(m[1], 10);
        newNum = parseInt(m[2], 10);
      }
      out.push({ key: i, prefix: "@", content: line, oldNum: null, newNum: null });
    } else if (isMeta(line)) {
      out.push({ key: i, prefix: "", content: line, oldNum: null, newNum: null });
    } else if (line.startsWith("+")) {
      out.push({ key: i, prefix: "+", content: line, oldNum: null, newNum: newNum++ });
    } else if (line.startsWith("-")) {
      out.push({ key: i, prefix: "-", content: line, oldNum: oldNum++, newNum: null });
    } else if (line.startsWith("\\")) {
      out.push({ key: i, prefix: "\\", content: line, oldNum: null, newNum: null });
    } else {
      const content = line.startsWith(" ") ? line.slice(1) : line;
      out.push({ key: i, prefix: " ", content, oldNum: oldNum++, newNum: newNum++ });
    }
  }
  return out;
}

function parseUnified(text: string): Row[] {
  const rows: Row[] = [];
  const lines = text.split("\n");
  let oldNum = 0;
  let newNum = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      const m = /-(\d+)(?:,\d+)? \+(\d+)(?:,\d+)?/.exec(line);
      if (m) {
        oldNum = parseInt(m[1], 10);
        newNum = parseInt(m[2], 10);
      }
      rows.push({ left: line, right: line, leftNum: null, rightNum: null, kind: "hdr" });
      continue;
    }
    if (isMeta(line)) {
      rows.push({ left: line, right: line, leftNum: null, rightNum: null, kind: "hdr" });
      continue;
    }
    if (line.startsWith("+") || line.startsWith("-")) {
      const dels: string[] = [];
      const adds: string[] = [];
      let j = i;
      while (j < lines.length && (lines[j].startsWith("+") || lines[j].startsWith("-"))) {
        if (lines[j].startsWith("-")) dels.push(lines[j].slice(1));
        else adds.push(lines[j].slice(1));
        j++;
      }
      const n = Math.max(dels.length, adds.length);
      for (let k = 0; k < n; k++) {
        const left = k < dels.length ? dels[k] : null;
        const right = k < adds.length ? adds[k] : null;
        rows.push({
          left,
          right,
          leftNum: left !== null ? oldNum++ : null,
          rightNum: right !== null ? newNum++ : null,
          kind: left !== null && right !== null ? "ctx" : left !== null ? "del" : "add",
        });
      }
      i = j - 1;
      continue;
    }
    if (line.startsWith("\\")) continue;
    const content = line.startsWith(" ") ? line.slice(1) : line;
    rows.push({ left: content, right: content, leftNum: oldNum++, rightNum: newNum++, kind: "ctx" });
  }
  return rows;
}

export function DiffViewer() {
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const selectedStaged = useRepoStore((s) => s.selectedStaged);
  const [mode, setMode] = useState<"unified" | "split">("unified");
  const isImage = !!selectedFile && IMAGE_RE.test(selectedFile);
  const diff = useDiff(isImage ? null : selectedFile, selectedStaged);
  const imageDiff = useImageVersions(isImage ? selectedFile : null, selectedStaged);
  const stageLinesMut = useStageLines();

  const [adds, setAdds] = useState<Set<number>>(new Set());
  const [dels, setDels] = useState<Set<number>>(new Set());
  const [anchor, setAnchor] = useState<number | null>(null);

  // Reset the selection whenever the file or staged/unstaged context changes.
  useEffect(() => {
    setAdds(new Set());
    setDels(new Set());
    setAnchor(null);
  }, [selectedFile, selectedStaged]);

  const lines = useMemo(() => parseLines(diff.data ?? ""), [diff.data]);

  if (!selectedFile) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--text-muted)" }}>
        Select a file to view its diff.
      </div>
    );
  }

  const loading = isImage ? imageDiff.isLoading : diff.isLoading;
  const error = isImage ? imageDiff.isError : diff.isError;
  const selectedCount = adds.size + dels.size;

  function toggleLine(idx: number, shift: boolean) {
    const line = lines[idx];
    if (!line || (line.prefix !== "+" && line.prefix !== "-")) return;

    const targetNums: number[] = [];
    if (shift && anchor !== null) {
      const [lo, hi] = idx < anchor ? [idx, anchor] : [anchor, idx];
      for (let k = lo; k <= hi; k++) {
        const l = lines[k];
        if (l.prefix === "+" && l.newNum !== null) targetNums.push(l.newNum);
        if (l.prefix === "-" && l.oldNum !== null) targetNums.push(l.oldNum);
      }
    } else {
      if (line.prefix === "+" && line.newNum !== null) targetNums.push(line.newNum);
      if (line.prefix === "-" && line.oldNum !== null) targetNums.push(line.oldNum);
    }
    if (targetNums.length === 0) return;

    setAdds((prev) => {
      const next = new Set(prev);
      for (const n of targetNums) {
        if (line.prefix === "+") {
          if (next.has(n)) next.delete(n);
          else next.add(n);
        }
      }
      return next;
    });
    setDels((prev) => {
      const next = new Set(prev);
      for (const n of targetNums) {
        if (line.prefix === "-") {
          if (next.has(n)) next.delete(n);
          else next.add(n);
        }
      }
      return next;
    });
    if (!shift) setAnchor(idx);
  }

  function applySelection() {
    if (!selectedFile || selectedCount === 0) return;
    stageLinesMut.mutate(
      {
        filePath: selectedFile,
        staged: selectedStaged,
        addLines: [...adds].sort((a, b) => a - b),
        delLines: [...dels].sort((a, b) => a - b),
      },
      {
        onSuccess: () => {
          setAdds(new Set());
          setDels(new Set());
          setAnchor(null);
        },
        onError: (e) => window.alert(e.message),
      }
    );
  }

  return (
    <div className="flex-1 overflow-y-auto flex flex-col min-h-0" style={{ background: "var(--bg-card)" }}>
      {/* Header */}
      <div
        className="sticky top-0 px-4 py-2 flex items-center justify-between z-10"
        style={{
          background: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border)",
          color: "var(--text-primary)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span className="text-sm font-medium truncate">
          {selectedFile}
          {selectedStaged && (
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded"
              style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
            >
              staged
            </span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {!isImage && mode === "unified" && (
            <>
              {selectedCount > 0 && (
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
                  style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
                  onClick={applySelection}
                  disabled={stageLinesMut.isPending}
                  title={
                    selectedStaged
                      ? "Remove selected lines from the index"
                      : "Stage only the selected lines"
                  }
                >
                  {selectedStaged ? <Minus size={12} /> : <Plus size={12} />}
                  {selectedStaged ? "Unstage" : "Stage"} {selectedCount} line{selectedCount !== 1 ? "s" : ""}
                </button>
              )}
              {selectedCount > 0 && (
                <button
                  className="p-1 rounded hover:bg-white/10"
                  onClick={() => {
                    setAdds(new Set());
                    setDels(new Set());
                    setAnchor(null);
                  }}
                  title="Clear selection"
                >
                  <X size={14} style={{ color: "var(--text-muted)" }} />
                </button>
              )}
            </>
          )}
          {!isImage && (
            <button
              className="p-1 rounded transition-colors"
              style={{
                background: mode === "unified" ? "var(--bg-hover)" : "transparent",
                color: "var(--text-secondary)",
              }}
              onClick={() => setMode("unified")}
              title="Unified diff (click +/− lines to stage them)"
            >
              <Rows3 size={14} />
            </button>
          )}
          {!isImage && (
            <button
              className="p-1 rounded transition-colors"
              style={{
                background: mode === "split" ? "var(--bg-hover)" : "transparent",
                color: "var(--text-secondary)",
              }}
              onClick={() => setMode("split")}
              title="Side-by-side diff"
            >
              <Columns2 size={14} />
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Loading diff...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
          Could not load diff.
        </div>
      )}

      {!loading && !error && isImage && (
        <ImageDiff
          oldB64={imageDiff.data?.old ?? null}
          newB64={imageDiff.data?.new ?? null}
          mime={mimeFor(selectedFile)}
        />
      )}

      {!loading && !error && !isImage && mode === "unified" && (
        <InteractiveUnifiedDiff lines={lines} adds={adds} dels={dels} onToggle={toggleLine} />
      )}
      {!loading && !error && !isImage && mode === "split" && <SplitDiff text={diff.data ?? ""} />}

      {!isImage && mode === "unified" && !loading && !error && (
        <div className="px-4 py-1 text-[11px] shrink-0" style={{ color: "var(--text-muted)" }}>
          Click a + or − line to select it; shift-click for a range. Then stage or unstage the selection.
        </div>
      )}
    </div>
  );
}

function InteractiveUnifiedDiff({
  lines,
  adds,
  dels,
  onToggle,
}: {
  lines: DiffLine[];
  adds: Set<number>;
  dels: Set<number>;
  onToggle: (idx: number, shift: boolean) => void;
}) {
  return (
    <pre className="text-sm leading-6" style={{ fontFamily: "var(--font-mono)" }}>
      {lines.map((line, idx) => {
        let bg = "transparent";
        let color = "var(--text-secondary)";
        const isSel =
          (line.prefix === "+" && line.newNum !== null && adds.has(line.newNum)) ||
          (line.prefix === "-" && line.oldNum !== null && dels.has(line.oldNum));

        if (line.prefix === "+") {
          bg = isSel ? "var(--diff-add-sel-bg, rgba(34,197,94,0.30))" : "var(--diff-add-bg)";
          color = "#4ADE80";
        } else if (line.prefix === "-") {
          bg = isSel ? "var(--diff-del-sel-bg, rgba(239,68,68,0.30))" : "var(--diff-del-bg)";
          color = "#F87171";
        } else if (line.prefix === "@") {
          bg = "var(--bg-hover)";
          color = "var(--accent)";
        }

        const selectable = line.prefix === "+" || line.prefix === "-";

        return (
          <div
            key={line.key}
            className="px-4 flex select-none"
            style={{ background: bg, color, cursor: selectable ? "pointer" : "default" }}
            onClick={selectable ? (e) => onToggle(idx, e.shiftKey) : undefined}
          >
            <span className="inline-block w-10 text-right mr-3 shrink-0 opacity-40">
              {line.prefix === "@" ? "" : idx + 1}
            </span>
            <span className="whitespace-pre-wrap break-all">{line.content}</span>
          </div>
        );
      })}
    </pre>
  );
}

function ImageDiff({ oldB64, newB64, mime }: { oldB64: string | null; newB64: string | null; mime: string }) {
  return (
    <div className="flex gap-4 p-4 overflow-auto">
      <ImagePane label="Before" b64={oldB64} mime={mime} emptyText="New file" />
      <ImagePane label="After" b64={newB64} mime={mime} emptyText="Deleted" />
    </div>
  );
}

function ImagePane({ label, b64, mime, emptyText }: { label: string; b64: string | null; mime: string; emptyText: string }) {
  return (
    <figure className="flex-1 min-w-0 flex flex-col items-center gap-2">
      <figcaption className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
        {label}
      </figcaption>
      {b64 ? (
        <img
          src={`data:${mime};base64,${b64}`}
          alt={label}
          className="max-w-full max-h-96 object-contain rounded border"
          style={{ borderColor: "var(--border-strong)", imageRendering: "auto" }}
        />
      ) : (
        <div
          className="w-full h-32 flex items-center justify-center rounded border text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}
        >
          {emptyText}
        </div>
      )}
    </figure>
  );
}

function SplitDiff({ text }: { text: string }) {
  const rows = parseUnified(text);
  return (
    <div className="text-sm" style={{ fontFamily: "var(--font-mono)" }}>
      {rows.map((row, i) => {
        if (row.kind === "hdr") {
          return (
            <div key={i} className="px-4 py-0.5" style={{ background: "var(--bg-hover)", color: "var(--accent)" }}>
              {row.left}
            </div>
          );
        }
        const leftBg = row.kind === "del" ? "var(--diff-del-bg)" : row.kind === "ctx" ? "transparent" : "var(--bg-hover)";
        const rightBg = row.kind === "add" ? "var(--diff-add-bg)" : row.kind === "ctx" ? "transparent" : "var(--bg-hover)";
        const leftColor = row.kind === "del" ? "#F87171" : "var(--text-secondary)";
        const rightColor = row.kind === "add" ? "#4ADE80" : "var(--text-secondary)";
        return (
          <div key={i} className="flex">
            <div className="w-1/2 flex px-4 py-0.5 border-r" style={{ background: leftBg, color: leftColor, borderColor: "var(--border)" }}>
              <span className="inline-block w-9 text-right mr-3 select-none opacity-40 shrink-0">
                {row.leftNum ?? ""}
              </span>
              <span className="whitespace-pre-wrap break-all flex-1">{row.left ?? ""}</span>
            </div>
            <div className="w-1/2 flex px-4 py-0.5" style={{ background: rightBg, color: rightColor }}>
              <span className="inline-block w-9 text-right mr-3 select-none opacity-40 shrink-0">
                {row.rightNum ?? ""}
              </span>
              <span className="whitespace-pre-wrap break-all flex-1">{row.right ?? ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
