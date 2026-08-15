import { useState } from "react";
import { useRepoStore } from "../stores/repo-store";
import {
  useRepoStatus,
  useStageFile,
  useUnstageFile,
  useStageAll,
  useUnstageAll,
} from "../hooks/useGit";
import type { FileStatus } from "../lib/types";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import {
  Plus,
  Minus,
  FilePlus,
  FileMinus,
  FileEdit,
  ArrowRightLeft,
  CircleHelp,
  CheckCheck,
  Undo2,
  Copy,
} from "lucide-react";

function statusIcon(status: FileStatus["status"]) {
  const s = 14;
  switch (status) {
    case "added":
      return <FilePlus size={s} style={{ color: "#22C55E" }} />;
    case "modified":
      return <FileEdit size={s} style={{ color: "#F59E0B" }} />;
    case "deleted":
      return <FileMinus size={s} style={{ color: "#EF4444" }} />;
    case "renamed":
      return <ArrowRightLeft size={s} style={{ color: "#A855F7" }} />;
    case "untracked":
      return <CircleHelp size={s} style={{ color: "var(--text-muted)" }} />;
  }
}

function FileItem({ file }: { file: FileStatus }) {
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const selectedStaged = useRepoStore((s) => s.selectedStaged);
  const selectFile = useRepoStore((s) => s.selectFile);
  const stageMut = useStageFile();
  const unstageMut = useUnstageFile();
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  const isSelected = selectedFile === file.path && selectedStaged === file.staged;

  // Drag-to-stage: drag unstaged files, drop target is the staged section.
  function onDragStart(e: React.DragEvent) {
    if (file.staged) return;
    e.dataTransfer.setData("text/plain", file.path);
    e.dataTransfer.effectAllowed = "move";
  }

  const menuItems: MenuItem[] = [
    {
      label: file.staged ? "Unstage" : "Stage",
      icon: file.staged ? <Minus size={14} /> : <Plus size={14} />,
      onClick: () =>
        file.staged ? unstageMut.mutate(file.path) : stageMut.mutate(file.path),
    },
    {
      label: "Copy path",
      icon: <Copy size={14} />,
      onClick: () => navigator.clipboard.writeText(file.path),
    },
  ];

  return (
    <div
      className="flex items-center gap-2 px-3 py-1 cursor-pointer group transition-colors"
      style={{
        background: isSelected ? "var(--bg-hover)" : "transparent",
      }}
      draggable={!file.staged}
      onDragStart={onDragStart}
      onClick={() => selectFile(file.path, file.staged)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {statusIcon(file.status)}
      <span className="text-sm truncate flex-1"
            style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}>
        {file.path}
      </span>
      {file.old_path && (
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          ← {file.old_path}
        </span>
      )}
      {!file.staged ? (
        <button
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity hover:bg-green-500/20"
          onClick={(e) => { e.stopPropagation(); stageMut.mutate(file.path); }}
          title="Stage file"
        >
          <Plus size={14} style={{ color: "#22C55E" }} />
        </button>
      ) : (
        <button
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity hover:bg-red-500/20"
          onClick={(e) => { e.stopPropagation(); unstageMut.mutate(file.path); }}
          title="Unstage file"
        >
          <Minus size={14} style={{ color: "#EF4444" }} />
        </button>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function Section({ title, files, onAction, actionIcon, onDrop }: {
  title: string;
  files: FileStatus[];
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  onDrop?: (filePath: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  if (files.length === 0 && !onDrop) return null;

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const filePath = e.dataTransfer.getData("text/plain");
    if (filePath && onDrop) {
      onDrop(filePath);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (onDrop) setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{ background: dragOver ? "var(--accent)/20" : "transparent" }}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5"
        style={{
          borderBottom: "1px solid var(--border)",
          background: dragOver ? "rgba(237,80,1,0.08)" : "transparent",
        }}
      >
        <span className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: "var(--text-muted)" }}>
          {title} ({files.length})
        </span>
        {onAction && (
          <button
            className="p-0.5 rounded transition-colors hover:bg-white/10"
            onClick={onAction}
            title={title === "Staged" ? "Unstage all" : "Stage all"}
          >
            {actionIcon}
          </button>
        )}
      </div>
      {files.map((f) => (
        <FileItem key={f.path + String(f.staged)} file={f} />
      ))}
      {files.length === 0 && onDrop && (
        <div className="px-3 py-3 text-xs text-center"
             style={{ color: "var(--text-muted)" }}>
          Drop files here to stage
        </div>
      )}
    </div>
  );
}

export function FilePanel() {
  const status = useRepoStatus();
  const files = status.data ?? [];

  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => !f.staged);
  const untracked = unstaged.filter((f) => f.status === "untracked");
  const modified = unstaged.filter((f) => f.status !== "untracked");

  const stageAllMut = useStageAll();
  const unstageAllMut = useUnstageAll();
  const stageMut = useStageFile();

  if (status.isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-sm"
           style={{ color: "var(--text-muted)" }}>
        Loading status...
      </div>
    );
  }

  return (
    <div className="overflow-y-auto" style={{ borderBottom: "1px solid var(--border)" }}>
      <Section
        title="Staged"
        files={staged}
        onAction={() => unstageAllMut.mutate()}
        actionIcon={<Undo2 size={13} style={{ color: "var(--text-muted)" }} />}
        onDrop={(filePath) => stageMut.mutate(filePath)}
      />
      <Section
        title="Modified"
        files={modified}
        onAction={() => stageAllMut.mutate()}
        actionIcon={<CheckCheck size={13} style={{ color: "var(--text-muted)" }} />}
      />
      <Section
        title="Untracked"
        files={untracked}
        onAction={() => stageAllMut.mutate()}
        actionIcon={<CheckCheck size={13} style={{ color: "var(--text-muted)" }} />}
      />
    </div>
  );
}
