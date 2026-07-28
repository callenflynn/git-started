import { create } from "zustand";
import type { ThemeName } from "../lib/types";

interface ThemeStore {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
}

// Read saved preference or default to dark.
const saved = (localStorage.getItem("theme") as ThemeName) || "dark";

// Set the attribute on <html> so CSS vars apply immediately.
document.documentElement.setAttribute("data-theme", saved);

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: saved,
  setTheme: (theme) => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    set({ theme });
  },
}));
