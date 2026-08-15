import { useEffect, useRef, useState, type ReactNode } from "react";
import { useThemeStore } from "../stores/theme-store";
import { Sun, Moon, Zap, GitBranch, Sparkles, Coffee, Check } from "lucide-react";
import type { ThemeName } from "../lib/types";

interface ThemeMeta {
  name: ThemeName;
  label: string;
  accent: string;
  icon: (size: number) => ReactNode;
}

const themes: ThemeMeta[] = [
  { name: "dark", label: "Dark", accent: "#ED5001", icon: (s) => <Moon size={s} /> },
  { name: "amoled", label: "AMOLED", accent: "#ED5001", icon: (s) => <Zap size={s} /> },
  { name: "light", label: "Light", accent: "#ED5001", icon: (s) => <Sun size={s} /> },
  { name: "github-green", label: "GitHub Green", accent: "#0FBF3E", icon: (s) => <GitBranch size={s} /> },
  { name: "copilot", label: "Copilot Purple", accent: "#8534F3", icon: (s) => <Sparkles size={s} /> },
  { name: "latte", label: "Catppuccin Latte", accent: "#8839ef", icon: (s) => <Coffee size={s} /> },
  { name: "frappe", label: "Catppuccin Frappé", accent: "#ca9ee6", icon: (s) => <Coffee size={s} /> },
  { name: "macchiato", label: "Catppuccin Macchiato", accent: "#c6a0f6", icon: (s) => <Coffee size={s} /> },
  { name: "mocha", label: "Catppuccin Mocha", accent: "#cba6f7", icon: (s) => <Coffee size={s} /> },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = themes.find((t) => t.name === theme) ?? themes[0];

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
        title="Change theme"
      >
        {active.icon(16)}
        <span className="text-xs">{active.label}</span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-56 rounded-md overflow-hidden z-50"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {themes.map((t) => {
            const isActive = t.name === theme;
            return (
              <button
                key={t.name}
                onClick={() => {
                  setTheme(t.name);
                  setOpen(false);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors"
                style={{
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  background: isActive ? "var(--bg-hover)" : "transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: t.accent, boxShadow: `0 0 6px ${t.accent}` }}
                />
                {t.icon(14)}
                <span className="flex-1">{t.label}</span>
                {isActive && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
