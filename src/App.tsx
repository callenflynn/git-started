import { useState } from "react";
import { useRepoStore } from "./stores/repo-store";
import { useLayoutStore } from "./stores/layout-store";
import { Layout } from "./components/Layout";
import { ResizeHandle } from "./components/ResizeHandle";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { CommitGraph } from "./components/CommitGraph";
import { CommitDetail } from "./components/CommitDetail";
import { FilePanel } from "./components/FilePanel";
import { DiffViewer } from "./components/DiffViewer";
import { CommitDialog } from "./components/CommitDialog";
import { RebasePanel } from "./components/RebasePanel";
import { ConflictPanel } from "./components/ConflictPanel";

export default function App() {
  const repoPath = useRepoStore((s) => s.repoPath);
  const graphHeight = useLayoutStore((s) => s.graphHeight);
  const setGraphHeight = useLayoutStore((s) => s.setGraphHeight);
  const fileWidth = useLayoutStore((s) => s.fileWidth);
  const setFileWidth = useLayoutStore((s) => s.setFileWidth);
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
              {/* Merge conflicts banner */}
              <ConflictPanel />

              {/* Commit graph + selected commit details */}
              <div className="flex shrink-0 min-h-0" style={{ height: graphHeight }}>
                <CommitGraph />
                <CommitDetail />
              </div>

              {/* Drag edge between graph and working tree */}
              <ResizeHandle
                direction="horizontal"
                onDelta={(d) => setGraphHeight((h) => h + d)}
                title="Resize graph"
              />

              {/* File list + diff split the bottom half */}
              <div
                className="flex flex-1 min-h-0"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                {/* File panel */}
                <div
                  className="flex flex-col shrink-0 overflow-y-auto"
                  style={{ width: fileWidth, borderRight: "1px solid var(--border)" }}
                >
                  <FilePanel />
                </div>

                {/* Drag edge between file list and diff */}
                <ResizeHandle
                  direction="vertical"
                  onDelta={(d) => setFileWidth((w) => w + d)}
                  title="Resize file list"
                />

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
