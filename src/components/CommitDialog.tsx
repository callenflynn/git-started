import { useState } from "react";
import { useCommit, useRepoStatus, useSigningInfo } from "../hooks/useGit";
import { useRepoStore } from "../stores/repo-store";
import { Send, RotateCcw, Key } from "lucide-react";

export function CommitDialog() {
  const repoPath = useRepoStore((s) => s.repoPath);
  const status = useRepoStatus();
  const signing = useSigningInfo();
  const commitMut = useCommit();
  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [sign, setSign] = useState(false);

  const stagedCount = status.data?.filter((f) => f.staged).length ?? 0;
  const canCommit = stagedCount > 0 && message.trim().length > 0 && !commitMut.isPending;
  const signingAvailable = signing.data?.enabled ?? false;

  function handleSubmit() {
    if (!canCommit) return;
    commitMut.mutate(
      { message: message.trim(), amend, sign: sign && signingAvailable },
      {
        onSuccess: () => {
          setMessage("");
          setAmend(false);
          setSign(false);
        },
      }
    );
  }

  if (!repoPath) return null;

  return (
    <div
      className="px-3 py-2"
      style={{ borderTop: "1px solid var(--border)", background: "var(--bg-secondary)" }}
    >
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={
              stagedCount === 0
                ? "Stage files to commit..."
                : "Commit message (Ctrl+Enter to commit)"
            }
            rows={2}
            className="w-full text-sm px-3 py-2 rounded-lg resize-none outline-none transition-colors"
            style={{
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              border: "1px solid var(--border-strong)",
              fontFamily: "var(--font-body)",
            }}
          />
          <div className="flex items-center gap-3 mt-1.5">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer"
                   style={{ color: "var(--text-muted)" }}>
              <input
                type="checkbox"
                checked={amend}
                onChange={(e) => setAmend(e.target.checked)}
                className="accent-[var(--accent)]"
              />
              <RotateCcw size={12} />
              Amend
            </label>

            {signingAvailable && (
              <label className="flex items-center gap-1.5 text-xs cursor-pointer"
                     style={{ color: "var(--text-muted)" }}>
                <input
                  type="checkbox"
                  checked={sign}
                  onChange={(e) => setSign(e.target.checked)}
                  className="accent-[var(--accent)]"
                />
                <Key size={12} />
                Sign ({signing.data?.format === "ssh" ? "SSH" : "GPG"})
              </label>
            )}

            {signingAvailable && (
              <span className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--accent)",
                      color: "var(--text-inverse)",
                      opacity: 0.7,
                    }}>
                {signing.data?.key_id.slice(0, 16)}
                {signing.data?.key_id.length ?? 0 > 16 ? "..." : ""}
              </span>
            )}

            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {stagedCount} file{stagedCount !== 1 ? "s" : ""} staged
            </span>
          </div>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canCommit}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background: canCommit ? "var(--accent)" : "var(--bg-card)",
            color: canCommit ? "var(--text-inverse)" : "var(--text-muted)",
          }}
        >
          <Send size={14} />
          Commit
        </button>
      </div>
      {commitMut.isError && (
        <p className="text-xs mt-1" style={{ color: "#EF4444" }}>
          Commit failed: {String(commitMut.error)}
        </p>
      )}
    </div>
  );
}
