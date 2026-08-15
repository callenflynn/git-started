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

function readJSON<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(`git-started:layout:${key}`);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function persistJSON(key: string, value: unknown) {
  localStorage.setItem(`git-started:layout:${key}`, JSON.stringify(value));
}

// Content panels, in grid order [top-left, top-right, bottom-left,
// bottom-right]. A null slot is empty (its panel is hidden). Only the first
// four are visible by default; the rest are optional additions.
export type PanelId =
  | "graph"
  | "details"
  | "files"
  | "diff"
  | "branches"
  | "stashes"
  | "tags"
  | "remotes"
  | "reflog"
  | "summary";
export const PANEL_IDS: PanelId[] = [
  "graph",
  "details",
  "files",
  "diff",
  "branches",
  "stashes",
  "tags",
  "remotes",
  "reflog",
  "summary",
];
export const DEFAULT_PANEL_ORDER: (PanelId | null)[] = [
  "graph",
  "details",
  "files",
  "diff",
];

export const PANEL_LABELS: Record<PanelId, string> = {
  graph: "Commit Graph",
  details: "Commit Details",
  files: "Working Tree",
  diff: "Diff",
  branches: "Branches",
  stashes: "Stashes",
  tags: "Tags",
  remotes: "Remotes",
  reflog: "Reflog",
  summary: "Repository Stats",
};

const DEFAULT_SIZES = {
  sidebarWidth: 240,
  detailWidth: 320,
  fileWidth: 288,
  graphHeight: 340,
};

interface LayoutStore {
  /** Left sidebar width (px). */
  sidebarWidth: number;
  /** Right-column width in the graph row (px). */
  detailWidth: number;
  /** Left-column width in the working-tree row (px). */
  fileWidth: number;
  /** Commit graph section height (px). */
  graphHeight: number;

  /** Grid order of the four content panels; null = empty slot. */
  panelOrder: (PanelId | null)[];
  sidebarVisible: boolean;
  commitBarVisible: boolean;
  /** When true, panels show drag/reorder/remove chrome. */
  editMode: boolean;

  setSidebarWidth: (updater: (w: number) => number) => void;
  setDetailWidth: (updater: (w: number) => number) => void;
  setFileWidth: (updater: (w: number) => number) => void;
  setGraphHeight: (updater: (h: number) => number) => void;

  setPanelOrder: (order: (PanelId | null)[]) => void;
  /** Hide a panel (empty its slot). */
  removePanel: (id: PanelId) => void;
  /** Show a hidden panel in the first empty slot. */
  addPanel: (id: PanelId) => void;
  setSidebarVisible: (v: boolean) => void;
  setCommitBarVisible: (v: boolean) => void;
  setEditMode: (v: boolean) => void;
  resetLayout: () => void;
}

export const useLayoutStore = create<LayoutStore>((set) => ({
  sidebarWidth: readSize("sidebarWidth", DEFAULT_SIZES.sidebarWidth, 180, 420),
  detailWidth: readSize("detailWidth", DEFAULT_SIZES.detailWidth, 260, 520),
  fileWidth: readSize("fileWidth", DEFAULT_SIZES.fileWidth, 200, 480),
  graphHeight: readSize("graphHeight", DEFAULT_SIZES.graphHeight, 140, 700),

  panelOrder: readJSON<(PanelId | null)[]>("panelOrder", DEFAULT_PANEL_ORDER),
  sidebarVisible: readJSON<boolean>("sidebarVisible", true),
  commitBarVisible: readJSON<boolean>("commitBarVisible", true),
  editMode: false,

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

  setPanelOrder: (order) => {
    persistJSON("panelOrder", order);
    set({ panelOrder: order });
  },
  removePanel: (id) =>
    set((state) => {
      const next = state.panelOrder.map((p) => (p === id ? null : p));
      persistJSON("panelOrder", next);
      return { panelOrder: next };
    }),
  addPanel: (id) =>
    set((state) => {
      if (state.panelOrder.includes(id)) return {};
      const idx = state.panelOrder.indexOf(null);
      if (idx === -1) return {};
      const next = [...state.panelOrder];
      next[idx] = id;
      persistJSON("panelOrder", next);
      return { panelOrder: next };
    }),
  setSidebarVisible: (v) => {
    persistJSON("sidebarVisible", v);
    set({ sidebarVisible: v });
  },
  setCommitBarVisible: (v) => {
    persistJSON("commitBarVisible", v);
    set({ commitBarVisible: v });
  },
  setEditMode: (v) => set({ editMode: v }),
  resetLayout: () => {
    persist("sidebarWidth", DEFAULT_SIZES.sidebarWidth);
    persist("detailWidth", DEFAULT_SIZES.detailWidth);
    persist("fileWidth", DEFAULT_SIZES.fileWidth);
    persist("graphHeight", DEFAULT_SIZES.graphHeight);
    persistJSON("panelOrder", DEFAULT_PANEL_ORDER);
    persistJSON("sidebarVisible", true);
    persistJSON("commitBarVisible", true);
    set({
      ...DEFAULT_SIZES,
      panelOrder: [...DEFAULT_PANEL_ORDER],
      sidebarVisible: true,
      commitBarVisible: true,
    });
  },
}));
