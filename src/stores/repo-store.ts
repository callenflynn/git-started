import { create } from "zustand";

interface RepoStore {
  /** Local path to the open repository. */
  repoPath: string | null;
  /** File currently selected in the diff viewer. */
  selectedFile: string | null;
  /** Whether the selected file is staged. */
  selectedStaged: boolean;

  setRepoPath: (path: string | null) => void;
  selectFile: (path: string | null, staged: boolean) => void;
}

export const useRepoStore = create<RepoStore>((set) => ({
  repoPath: null,
  selectedFile: null,
  selectedStaged: false,

  setRepoPath: (path) => set({ repoPath: path, selectedFile: null }),
  selectFile: (path, staged) => set({ selectedFile: path, selectedStaged: staged }),
}));
