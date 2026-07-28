import { create } from "zustand";

interface RepoStore {
  /** Local path to the open repository. */
  repoPath: string | null;
  /** File currently selected in the diff viewer. */
  selectedFile: string | null;
  /** Whether the selected file is staged. */
  selectedStaged: boolean;
  /** Auto-fetch interval in milliseconds (0 = disabled). */
  autoFetchMs: number;

  setRepoPath: (path: string | null) => void;
  selectFile: (path: string | null, staged: boolean) => void;
  setAutoFetchMs: (ms: number) => void;
}

// Restore last repo from localStorage.
const savedPath = localStorage.getItem("git-started:repoPath");
const savedFetch = localStorage.getItem("git-started:autoFetchMs");

export const useRepoStore = create<RepoStore>((set) => ({
  repoPath: savedPath,
  selectedFile: null,
  selectedStaged: false,
  autoFetchMs: savedFetch ? parseInt(savedFetch, 10) : 30_000,

  setRepoPath: (path) => {
    if (path) {
      localStorage.setItem("git-started:repoPath", path);
    } else {
      localStorage.removeItem("git-started:repoPath");
    }
    set({ repoPath: path, selectedFile: null });
  },
  selectFile: (path, staged) => set({ selectedFile: path, selectedStaged: staged }),
  setAutoFetchMs: (ms) => {
    localStorage.setItem("git-started:autoFetchMs", String(ms));
    set({ autoFetchMs: ms });
  },
}));
