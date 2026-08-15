/** Format a unix timestamp as a compact relative time, e.g. "3h ago". */
export function relativeTime(ts: number): string {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

/** Truncate a string to `max` chars, appending an ellipsis. */
export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + "…" : s;
}
