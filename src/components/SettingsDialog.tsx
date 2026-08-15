import { useState } from "react";
import { useSettingsStore } from "../stores/settings-store";
import { useRepoStore } from "../stores/repo-store";
import { useLayoutStore, PANEL_IDS, PANEL_LABELS } from "../stores/layout-store";
import {
  useRecentRepos,
  useAddRecentRepo,
  useRemoveRecentRepo,
  useDetectGitRepos,
} from "../hooks/useGit";
import {
  X,
  Settings,
  Loader2,
  Plus,
  Trash2,
  ScanSearch,
  Check,
  LayoutDashboard,
  RotateCcw,
  Eye,
  EyeOff,
} from "lucide-react";

function repoName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

const FETCH_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 5000, label: "5s" },
  { value: 15000, label: "15s" },
  { value: 30000, label: "30s" },
  { value: 60000, label: "1m" },
];

export function SettingsDialog() {
  const open = useSettingsStore((s) => s.open);
  const setOpen = useSettingsStore((s) => s.setOpen);
  const autoFetchMs = useRepoStore((s) => s.autoFetchMs);
  const setAutoFetchMs = useRepoStore((s) => s.setAutoFetchMs);

  const recents = useRecentRepos();
  const addRecent = useAddRecentRepo();
  const removeRecent = useRemoveRecentRepo();
  const detect = useDetectGitRepos();

  const [added, setAdded] = useState<Set<string>>(new Set());

  const panelOrder = useLayoutStore((s) => s.panelOrder);
  const removePanel = useLayoutStore((s) => s.removePanel);
  const addPanel = useLayoutStore((s) => s.addPanel);
  const sidebarVisible = useLayoutStore((s) => s.sidebarVisible);
  const setSidebarVisible = useLayoutStore((s) => s.setSidebarVisible);
  const commitBarVisible = useLayoutStore((s) => s.commitBarVisible);
  const setCommitBarVisible = useLayoutStore((s) => s.setCommitBarVisible);
  const setEditMode = useLayoutStore((s) => s.setEditMode);
  const resetLayout = useLayoutStore((s) => s.resetLayout);

  if (!open) return null;

  const detected = detect.data ?? [];
  const recentList = recents.data ?? [];

  function handleDetect() {
    setAdded(new Set());
    detect.mutate();
  }

  function handleAdd(path: string) {
    setAdded((prev) => new Set(prev).add(path));
    addRecent.mutate(path);
  }

  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 h-12 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span
            className="flex items-center gap-2 font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            <Settings size={16} />
            Settings
          </span>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:opacity-70"
            style={{ color: "var(--text-muted)" }}
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-6 p-5 overflow-y-auto">
          {/* Auto-fetch interval */}
          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Refresh interval
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {FETCH_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAutoFetchMs(opt.value)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                  style={{
                    background:
                      autoFetchMs === opt.value ? "var(--accent)" : "var(--bg-card)",
                    color:
                      autoFetchMs === opt.value
                        ? "var(--text-inverse)"
                        : "var(--text-primary)",
                    border: "1px solid var(--border-strong)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              How often branches and remotes refresh in the background.
            </p>
          </section>

          {/* Layout */}
          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Layout
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {PANEL_IDS.map((id) => {
                const shown = panelOrder.includes(id);
                return (
                  <button
                    key={id}
                    onClick={() => (shown ? removePanel(id) : addPanel(id))}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                    style={{
                      background: shown ? "var(--accent)" : "var(--bg-card)",
                      color: shown ? "var(--text-inverse)" : "var(--text-primary)",
                      border: "1px solid var(--border-strong)",
                    }}
                    title={shown ? "Hide panel" : "Show panel"}
                  >
                    {shown ? <Eye size={12} /> : <EyeOff size={12} />}
                    {PANEL_LABELS[id]}
                  </button>
                );
              })}
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: sidebarVisible ? "var(--accent)" : "var(--bg-card)",
                  color: sidebarVisible ? "var(--text-inverse)" : "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                {sidebarVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                Sidebar
              </button>
              <button
                onClick={() => setCommitBarVisible(!commitBarVisible)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: commitBarVisible ? "var(--accent)" : "var(--bg-card)",
                  color: commitBarVisible ? "var(--text-inverse)" : "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                {commitBarVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                Commit Bar
              </button>
            </div>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Toggle panels on and off, or rearrange them by dragging.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setEditMode(true);
                  setOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{
                  background: "var(--accent)",
                  color: "var(--text-inverse)",
                  border: "1px solid transparent",
                }}
              >
                <LayoutDashboard size={13} />
                Edit layout…
              </button>
              <button
                onClick={resetLayout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                <RotateCcw size={13} />
                Reset to default
              </button>
            </div>
          </section>

          {/* Detect repositories */}
          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Find repositories
            </h3>
            <button
              onClick={handleDetect}
              disabled={detect.isPending}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-60"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-strong)",
              }}
            >
              {detect.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ScanSearch size={16} />
              )}
              {detect.isPending
                ? "Scanning device… this may take a while"
                : "Detect git repositories on this device"}
            </button>

            {detect.isPending && (
              <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                Scanning all drives for folders containing a{" "}
                <code>.git</code> directory. Large or network drives make this slow.
              </p>
            )}

            {detect.isError && (
              <p className="mt-2 text-sm" style={{ color: "#F87171" }}>
                Scan failed: {String(detect.error)}
              </p>
            )}

            {detect.isSuccess && (
              <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                Found{" "}
                <span style={{ color: "var(--accent)" }}>{detected.length}</span>{" "}
                repositor{detected.length === 1 ? "y" : "ies"}.
              </p>
            )}

            {detected.length > 0 && (
              <div
                className="mt-2 border rounded-lg overflow-y-auto max-h-56"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {detected.map((path) => {
                  const recent = recentList.includes(path);
                  const adding = addRecent.isPending && addRecent.variables === path;
                  const done = recent || (added.has(path) && !addRecent.isPending);
                  return (
                    <div
                      key={path}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <span
                        className="truncate"
                        style={{ color: "var(--text-secondary)" }}
                        title={path}
                      >
                        {repoName(path)}
                      </span>
                      {done ? (
                        <span
                          className="flex items-center gap-1 text-xs shrink-0"
                          style={{ color: "var(--accent)" }}
                        >
                          <Check size={13} /> Added
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAdd(path)}
                          disabled={adding}
                          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium shrink-0 transition-all hover:scale-[1.03] disabled:opacity-60"
                          style={{ background: "var(--accent)", color: "var(--text-inverse)" }}
                        >
                          {adding ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Plus size={12} />
                          )}
                          {adding ? "Adding…" : "Add"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent repositories */}
          <section>
            <h3
              className="text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "var(--text-muted)" }}
            >
              Recent repositories
            </h3>
            {recentList.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No recent repositories yet.
              </p>
            ) : (
              <div
                className="border rounded-lg overflow-hidden"
                style={{ borderColor: "var(--border-strong)" }}
              >
                {recentList.map((path) => (
                  <div
                    key={path}
                    className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <span
                      className="truncate"
                      style={{ color: "var(--text-secondary)" }}
                      title={path}
                    >
                      {repoName(path)}
                    </span>
                    <button
                      onClick={() => removeRecent.mutate(path)}
                      className="p-1 rounded hover:opacity-70 shrink-0"
                      style={{ color: "var(--text-muted)" }}
                      title="Forget"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
