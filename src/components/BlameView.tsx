import { useBlame } from "../hooks/useGit";
import { relativeTime } from "../lib/format";

export function BlameView({ file }: { file: string }) {
  const blame = useBlame(file);

  if (blame.isLoading) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Loading blame...
      </div>
    );
  }
  if (blame.isError) {
    return (
      <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--text-muted)" }}>
        Could not load blame.
      </div>
    );
  }

  const lines = blame.data ?? [];

  return (
    <div className="flex-1 overflow-auto text-sm" style={{ background: "var(--bg-card)", fontFamily: "var(--font-mono)" }}>
      {lines.map((l) => (
        <div
          key={l.line_number}
          className="flex px-3 py-0.5 items-center"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <span className="w-10 text-right mr-3 select-none opacity-40 shrink-0">
            {l.line_number}
          </span>
          <span
            className="w-20 shrink-0 truncate mr-2"
            style={{ color: "var(--accent)" }}
            title={`${l.commit_oid} · ${relativeTime(l.timestamp)}`}
          >
            {l.short_oid}
          </span>
          <span
            className="w-32 shrink-0 truncate mr-2"
            style={{ color: "var(--text-secondary)" }}
            title={l.author}
          >
            {l.author}
          </span>
          <span className="flex-1 whitespace-pre-wrap break-all" style={{ color: "var(--text-primary)" }}>
            {l.content}
          </span>
        </div>
      ))}
    </div>
  );
}
