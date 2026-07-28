import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useRepoStore } from "../stores/repo-store";
import * as git from "../lib/tauri";
import { AuthSetup } from "./AuthSetup";
import { FolderOpen, GitBranch, Download, Key } from "lucide-react";

export function WelcomeScreen() {
  const setRepoPath = useRepoStore((s) => s.setRepoPath);
  const [view, setView] = useState<"menu" | "auth">("menu");

  async function handleOpen() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      const info = await git.openRepo(selected);
      setRepoPath(info.path);
    }
  }

  async function handleClone() {
    const url = window.prompt("Repository URL (SSH or HTTPS):");
    if (!url) return;
    const dest = await open({ directory: true, multiple: false });
    if (typeof dest === "string") {
      try {
        const info = await git.cloneRepo(url, dest);
        setRepoPath(info.path);
      } catch (e) {
        window.alert(`Clone failed: ${e}`);
      }
    }
  }

  async function handleInit() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      try {
        const info = await git.initRepo(selected);
        setRepoPath(info.path);
      } catch (e) {
        window.alert(`Init failed: ${e}`);
      }
    }
  }

  if (view === "auth") {
    return <AuthSetup onDone={() => setView("menu")} />;
  }

  return (
    <div className="flex items-center justify-center h-full"
         style={{ background: "var(--bg-primary)" }}>
      <div className="text-center max-w-md px-8">
        <h1 className="text-5xl font-bold mb-2"
            style={{ fontFamily: "var(--font-brand)", color: "var(--accent)" }}>
          git-started
        </h1>
        <p className="text-lg mb-10"
           style={{ color: "var(--text-secondary)" }}>
          A fast, beautiful Git GUI for your desktop.
        </p>

        <div className="flex flex-col gap-3">
          <button onClick={handleOpen}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "var(--accent)",
                    color: "var(--text-inverse)",
                  }}>
            <FolderOpen size={18} />
            Open Repository
          </button>

          <button onClick={handleClone}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-strong)",
                  }}>
            <Download size={18} />
            Clone Repository
          </button>

          <button onClick={handleInit}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-strong)",
                  }}>
            <GitBranch size={18} />
            Create New Repository
          </button>

          <div className="w-8 h-px mx-auto my-2" style={{ background: "var(--border)" }} />

          <button onClick={() => setView("auth")}
                  className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "1px solid var(--border)",
                  }}>
            <Key size={14} />
            Auth Setup
          </button>
        </div>
      </div>
    </div>
  );
}
