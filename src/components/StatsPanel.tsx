import { useRepoStats } from "../hooks/useGit";
import { BarChart3 } from "lucide-react";
import { PanelHeader } from "./PanelHeader";
import { relativeTime } from "../lib/format";

export function StatsPanel() {
  const stats = useRepoStats();
  const s = stats.data;

  const rows: [string, string][] = s
    ? [
        ["Commits", String(s.commits)],
        ["Branches", String(s.branches)],
        ["Tags", String(s.tags)],
        ["Remotes", String(s.remotes)],
        ["Stashes", String(s.stashes)],
        ["Contributors", String(s.contributors)],
        ["HEAD", s.head_branch],
        ["First commit", relativeTime(s.first_commit_time)],
        ["Latest commit", relativeTime(s.last_commit_time)],
        ["Working tree", s.is_dirty ? "Dirty" : "Clean"],
      ]
    : [];

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: "var(--bg-card)" }}>
      <PanelHeader title="Repository" icon={<BarChart3 size={13} />} />
      <div className="flex-1 overflow-y-auto p-3">
        {!s ? (
          <div className="text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {rows.map(([label, value]) => (
              <div key={label}>
                <div
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-muted)" }}
                >
                  {label}
                </div>
                <div
                  className="text-sm truncate"
                  style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
                  title={value}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
