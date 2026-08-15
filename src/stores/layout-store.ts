import { create } from "zustand";

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

function readSize(key: string, fallback: number, min: number, max: number): number {
  const raw = localStorage.getItem(`git-started:layout:${key}`);
  if (raw == null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? clamp(n, min, max) : fallback;
}

function persist(key: string, value: number) {
  localStorage.setItem(`git-started:layout:${key}`, String(value));
}

interface LayoutStore {
  /** Left sidebar width (px). */
  sidebarWidth: number;
  /** Commit detail panel width (px). */
  detailWidth: number;
  /** File list width in the working-tree row (px). */
  fileWidth: number;
  /** Commit graph section height (px). */
  graphHeight: number;

  setSidebarWidth: (updater: (w: number) => number) => void;
  setDetailWidth: (updater: (w: number) => number) => void;
  setFileWidth: (updater: (w: number) => number) => void;
  setGraphHeight: (updater: (h: number) => number) => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  sidebarWidth: readSize("sidebarWidth", 240, 180, 420),
  detailWidth: readSize("detailWidth", 320, 260, 520),
  fileWidth: readSize("fileWidth", 288, 200, 480),
  graphHeight: readSize("graphHeight", 340, 140, 700),

  setSidebarWidth: (updater) =>
    set((state) => {
      const v = clamp(updater(state.sidebarWidth), 180, 420);
      persist("sidebarWidth", v);
      return { sidebarWidth: v };
    }),
  setDetailWidth: (updater) =>
    set((state) => {
      const v = clamp(updater(state.detailWidth), 260, 520);
      persist("detailWidth", v);
      return { detailWidth: v };
    }),
  setFileWidth: (updater) =>
    set((state) => {
      const v = clamp(updater(state.fileWidth), 200, 480);
      persist("fileWidth", v);
      return { fileWidth: v };
    }),
  setGraphHeight: (updater) =>
    set((state) => {
      const v = clamp(updater(state.graphHeight), 140, 700);
      persist("graphHeight", v);
      return { graphHeight: v };
    }),
}));
