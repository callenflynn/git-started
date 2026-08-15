import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

/**
 * A fixed-position context menu. Closes on outside click or Escape, and
 * shifts itself back into the viewport when opened near a screen edge.
 */
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Clamp so the menu never renders off-screen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const nx = x + r.width > window.innerWidth ? Math.max(8, window.innerWidth - r.width - 8) : x;
    const ny = y + r.height > window.innerHeight ? Math.max(8, window.innerHeight - r.height - 8) : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="fixed z-[100] min-w-44 rounded-md py-1"
      style={{
        left: pos.x,
        top: pos.y,
        background: "var(--bg-card)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left transition-colors disabled:opacity-40"
          style={{ color: item.danger ? "#EF4444" : "var(--text-primary)" }}
          disabled={item.disabled}
          onClick={() => {
            onClose();
            item.onClick();
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          {item.icon}
          <span className="flex-1">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
