import { useRemotes, useFetch } from "../hooks/useGit";
import { Globe, RefreshCw } from "lucide-react";
import { PanelHeader } from "./PanelHeader";

export function RemotePanel() {
  const remotes = useRemotes();
  const fetchMut = useFetch();
  const items = remotes.data ?? [];

  return (
    <div className="flex-1 min-h-0 flex flex-col" style={{ background: "var(--bg-card)" }}>
      <PanelHeader title="Remotes" count={items.length} icon={<Globe size={13} />} />
      <div className="flex-1 overflow-y-auto">
        {remotes.isLoading ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-4 text-sm" style={{ color: "var(--text-muted)" }}>
            No remotes.
          </div>
        ) : (
          items.map((r) => (
            <div
              key={r.name}
              className="flex items-center gap-2 px-3 py-1.5 text-sm"
              style={{ color: "var(--text-secondary)" }}
            >
              <Globe size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <span className="flex-1 truncate">{r.name}</span>
              <span
                className="text-xs truncate max-w-[40%]"
                style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                title={r.url}
              >
                {r.url}
              </span>
              <button
                onClick={() => fetchMut.mutate(r.name)}
                className="p-0.5 rounded transition-colors hover:bg-white/10"
                title={`Fetch ${r.name}`}
                style={{ color: "var(--text-muted)", display: "flex" }}
              >
                <RefreshCw size={12} className={fetchMut.isPending ? "animate-spin" : ""} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
