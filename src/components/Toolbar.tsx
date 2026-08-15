import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useRepoStore } from "../stores/repo-store";
import {
  useBranches,
  usePush,
  usePull,
  useFetch,
  useStash,
  useRebaseStatus,
  useRebaseContinue,
  useRebaseAbort,
} from "../hooks/useGit";
import { openRepo } from "../lib/tauri";
import { open } from "@tauri-apps/plugin-dialog";
import { ThemeToggle } from "./ThemeToggle";
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Archive,
  FolderOpen,
  AlertTriangle,
  Play,
  X,
  Minus,
  Square,
  Copy,
} from "lucide-react";

function getWin() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

export function Toolbar() {
  const setRepoPath = useRepoStore((s) => s.setRepoPath);
  const branches = useBranches();
  const pushMut = usePush();
  const pullMut = usePull();
  const fetchMut = useFetch();
  const stashMut = useStash();
  const rebaseStatus = useRebaseStatus();
  const rebaseContinueMut = useRebaseContinue();
  const rebaseAbortMut = useRebaseAbort();

  const currentBranch = branches.data?.find((b) => b.is_head);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;
    const w = getWin();
    if (!w) return;
    w.isMaximized()
      .then((m) => mounted && setIsMaximized(m))
      .catch(() => {});
    const un = w.onResized(() => {
      w.isMaximized()
        .then((m) => mounted && setIsMaximized(m))
        .catch(() => {});
    });
    return () => {
      mounted = false;
      un.then((f) => f()).catch(() => {});
    };
  }, []);

  function toggleMaximize() {
    getWin()?.toggleMaximize();
  }

  async function handleOpen() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      const info = await openRepo(selected);
      setRepoPath(info.path);
    }
  }

  function handlePush() {
    if (!currentBranch) return;
    pushMut.mutate({ remote: "origin", branch: currentBranch.name });
  }

  function handlePull() {
    if (!currentBranch) return;
    pullMut.mutate({ remote: "origin", branch: currentBranch.name });
  }

  function handleFetch() {
    fetchMut.mutate("origin");
  }

  const btnClass =
    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50";

  return (
    <header
      className="flex items-center gap-2 px-3 h-11 shrink-0"
      style={{
        background: "var(--bg-nav)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Brand (drag region) */}
      <span
        data-tauri-drag-region
        onDoubleClick={toggleMaximize}
        className="flex items-center gap-2 mr-2 select-none cursor-grab"
      >
        <img
          src="/git-started.svg"
          alt="git-started logo"
          className="w-[22px] h-[22px] rounded-md shrink-0"
          draggable={false}
        />
        <span
          className="text-xl font-bold"
          style={{ fontFamily: "var(--font-brand)", color: "var(--accent)" }}
        >
          git-started
        </span>
      </span>

      {/* Branch indicator */}
      {currentBranch && (
        <span
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
          style={{ background: "var(--bg-card)", color: "var(--accent)" }}
        >
          <span style={{ fontFamily: "var(--font-mono)" }}>
            {currentBranch.name}
          </span>
        </span>
      )}

      {/* Rebase in-progress indicator */}
      {rebaseStatus.data?.in_progress && (
        <span
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium"
          style={{ background: "#F59E0B", color: "#1E1E1E" }}
        >
          <AlertTriangle size={12} />
          Rebase in progress
          <button
            className="ml-1 p-0.5 rounded hover:bg-black/20"
            onClick={() => rebaseContinueMut.mutate()}
            title="Continue rebase"
          >
            <Play size={10} />
          </button>
          <button
            className="p-0.5 rounded hover:bg-black/20"
            onClick={() => rebaseAbortMut.mutate()}
            title="Abort rebase"
          >
            <X size={10} />
          </button>
        </span>
      )}

      <div
        data-tauri-drag-region
        onDoubleClick={toggleMaximize}
        className="flex-1 self-stretch cursor-grab"
      />

      {/* Actions */}
      <button
        className={btnClass}
        style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
        onClick={handlePush}
        disabled={!currentBranch || pushMut.isPending}
        title="Push"
      >
        <ArrowUp size={14} />
        Push
      </button>

      <button
        className={btnClass}
        style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
        onClick={handlePull}
        disabled={!currentBranch || pullMut.isPending}
        title="Pull"
      >
        <ArrowDown size={14} />
        Pull
      </button>

      <button
        className={btnClass}
        style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
        onClick={handleFetch}
        disabled={fetchMut.isPending}
        title="Fetch"
      >
        <RefreshCw size={14} className={fetchMut.isPending ? "animate-spin" : ""} />
      </button>

      <button
        className={btnClass}
        style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
        onClick={() => stashMut.mutate()}
        disabled={stashMut.isPending}
        title="Stash changes"
      >
        <Archive size={14} />
      </button>

      <div className="w-px h-5 mx-1" style={{ background: "var(--border-strong)" }} />

      <button
        className={btnClass}
        style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
        onClick={handleOpen}
        title="Open another repository"
      >
        <FolderOpen size={14} />
      </button>

      <ThemeToggle />

      {/* Custom window controls (native bar is hidden) */}
      <div className="flex items-stretch h-11 -mr-3 ml-1">
        <button
          className="titlebar-btn"
          onClick={() => getWin()?.minimize()}
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          className="titlebar-btn"
          onClick={() => getWin()?.toggleMaximize()}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          {isMaximized ? <Copy size={12} /> : <Square size={12} />}
        </button>
        <button
          className="titlebar-btn titlebar-close"
          onClick={() => getWin()?.close()}
          title="Close"
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}
