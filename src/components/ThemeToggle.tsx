import { useThemeStore } from "../stores/theme-store";
import { Sun, Moon, Zap } from "lucide-react";
import type { ThemeName } from "../lib/types";

const cycle: ThemeName[] = ["dark", "light", "amoled"];

function iconFor(theme: ThemeName) {
  switch (theme) {
    case "dark":
      return <Moon size={16} />;
    case "light":
      return <Sun size={16} />;
    case "amoled":
      return <Zap size={16} />;
  }
}

function labelFor(theme: ThemeName) {
  switch (theme) {
    case "dark":
      return "Dark";
    case "light":
      return "Light";
    case "amoled":
      return "AMOLED";
  }
}

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  function cycleTheme() {
    const idx = cycle.indexOf(theme);
    const next = cycle[(idx + 1) % cycle.length];
    setTheme(next);
  }

  return (
    <button
      onClick={cycleTheme}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
      style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
      title={`Theme: ${labelFor(theme)}. Click to switch.`}
    >
      {iconFor(theme)}
      <span className="text-xs">{labelFor(theme)}</span>
    </button>
  );
}
