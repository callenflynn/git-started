import { open } from "@tauri-apps/plugin-dialog";
import { useRepoStore } from "../stores/repo-store";
import * as git from "../lib/tauri";
import { FolderOpen, GitBranch, Download } from "lucide-react";

export function WelcomeScreen() {
  const setRepoPath = useRepoStore((s) => s.setRepoPath);

  async function handleOpen() {
    const selected = await open({ directory: true, multiple: false });
    if (typeof selected === "string") {
      const info = await git.openRepo(selected);
      setRepoPath(info.path);
    }
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

          <button onClick={handleOpen}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-strong)",
                  }}>
            <Download size={18} />
            Clone Repository
          </button>

          <button onClick={handleOpen}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-strong)",
                  }}>
            <GitBranch size={18} />
            Create New Repository
          </button>
        </div>
      </div>
    </div>
  );
}
