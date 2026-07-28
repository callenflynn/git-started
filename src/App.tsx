import { useState } from "react";
import { useRepoStore } from "./stores/repo-store";
import { Layout } from "./components/Layout";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { CommitGraph } from "./components/CommitGraph";
import { FilePanel } from "./components/FilePanel";
import { DiffViewer } from "./components/DiffViewer";
import { CommitDialog } from "./components/CommitDialog";
import { RebasePanel } from "./components/RebasePanel";

export default function App() {
  const repoPath = useRepoStore((s) => s.repoPath);
  const [rebaseTarget, setRebaseTarget] = useState<{
    branch: string;
    base: string;
  } | null>(null);

  function handleRebase(branch: string, base: string) {
    setRebaseTarget({ branch, base });
  }

  return (
    <Layout onRebase={handleRebase}>
      {repoPath ? (
        <div className="flex flex-col h-full overflow-hidden">
          {rebaseTarget ? (
            <RebasePanel
              branch={rebaseTarget.branch}
              base={rebaseTarget.base}
              onClose={() => setRebaseTarget(null)}
            />
          ) : (
            <>
              {/* Commit graph fills the top portion */}
              <CommitGraph />

              {/* File list + diff split the bottom half */}
              <div
                className="flex flex-1 min-h-0"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                {/* File panel */}
                <div
                  className="w-72 flex flex-col shrink-0 overflow-y-auto"
                  style={{ borderRight: "1px solid var(--border)" }}
                >
                  <FilePanel />
                </div>

                {/* Diff viewer */}
                <DiffViewer />
              </div>

              {/* Commit bar */}
              <CommitDialog />
            </>
          )}
        </div>
      ) : (
        <WelcomeScreen />
      )}
    </Layout>
  );
}
