import type { ReactNode } from "react";

export function PanelHeader({
  icon,
  title,
  count,
  children,
}: {
  icon?: ReactNode;
  title: string;
  count?: number;
  children?: ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2 shrink-0"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
      }}
    >
      <span style={{ color: "var(--text-muted)", display: "flex" }}>{icon}</span>
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--text-muted)" }}
      >
        {title}
        {count !== undefined && <span> ({count})</span>}
      </span>
      <span className="flex-1" />
      {children}
    </div>
  );
}
