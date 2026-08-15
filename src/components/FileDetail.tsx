import { useState } from "react";
import { useRepoStore } from "../stores/repo-store";
import { DiffViewer } from "./DiffViewer";
import { BlameView } from "./BlameView";
import { HistoryView } from "./HistoryView";

type Tab = "diff" | "blame" | "history";

export function FileDetail() {
  const selectedFile = useRepoStore((s) => s.selectedFile);
  const [tab, setTab] = useState<Tab>("diff");

  if (!selectedFile) {
    return <DiffViewer />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "diff", label: "Diff" },
    { id: "blame", label: "Blame" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0">
      <div
        className="flex items-center gap-1 px-3 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-1 rounded-md text-xs font-medium transition-colors"
            style={{
              background: tab === t.id ? "var(--accent)" : "transparent",
              color: tab === t.id ? "var(--text-inverse)" : "var(--text-muted)",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {tab === "diff" && <DiffViewer />}
        {tab === "blame" && <BlameView file={selectedFile} />}
        {tab === "history" && <HistoryView file={selectedFile} />}
      </div>
    </div>
  );
}
