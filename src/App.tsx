import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRepoStore } from "./stores/repo-store";
import { useAddRecentRepo } from "./hooks/useGit";
import {
  useLayoutStore,
  PANEL_IDS,
  PANEL_LABELS,
  type PanelId,
} from "./stores/layout-store";
import { Layout } from "./components/Layout";
import { ResizeHandle } from "./components/ResizeHandle";
import { PanelSlot } from "./components/PanelSlot";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { CommitGraph } from "./components/CommitGraph";
import { CommitDetail } from "./components/CommitDetail";
import { FilePanel } from "./components/FilePanel";
import { FileDetail } from "./components/FileDetail";
import { BranchPanel } from "./components/BranchPanel";
import { StashPanel } from "./components/StashPanel";
import { TagPanel } from "./components/TagPanel";
import { RemotePanel } from "./components/RemotePanel";
import { ReflogPanel } from "./components/ReflogPanel";
import { StatsPanel } from "./components/StatsPanel";
import { CommitDialog } from "./components/CommitDialog";
import { RebasePanel } from "./components/RebasePanel";
import { ConflictPanel } from "./components/ConflictPanel";
import { SettingsDialog } from "./components/SettingsDialog";
import { ReflogDialog } from "./components/ReflogDialog";
import { RepoSummaryDialog } from "./components/RepoSummaryDialog";
import { Check, RotateCcw, Plus, ChevronDown, LayoutDashboard } from "lucide-react";

export default function App() {
  const repoPath = useRepoStore((s) => s.repoPath);
  const addRecent = useAddRecentRepo();

  // Persist the open repo to the durable recent-repos file. This also seeds
  // the list from localStorage on first launch (migration path).
  useEffect(() => {
    if (repoPath) {
      addRecent.mutate(repoPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

  const graphHeight = useLayoutStore((s) => s.graphHeight);
  const setGraphHeight = useLayoutStore((s) => s.setGraphHeight);
  const detailWidth = useLayoutStore((s) => s.detailWidth);
  const setDetailWidth = useLayoutStore((s) => s.setDetailWidth);
  const fileWidth = useLayoutStore((s) => s.fileWidth);
  const setFileWidth = useLayoutStore((s) => s.setFileWidth);

  const panelOrder = useLayoutStore((s) => s.panelOrder);
  const setPanelOrder = useLayoutStore((s) => s.setPanelOrder);
  const removePanel = useLayoutStore((s) => s.removePanel);
  const addPanel = useLayoutStore((s) => s.addPanel);
  const editMode = useLayoutStore((s) => s.editMode);
  const setEditMode = useLayoutStore((s) => s.setEditMode);
  const resetLayout = useLayoutStore((s) => s.resetLayout);
  const commitBarVisible = useLayoutStore((s) => s.commitBarVisible);

  // Escape exits layout-edit mode.
  useEffect(() => {
    if (!editMode) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEditMode(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode, setEditMode]);

  const [rebaseTarget, setRebaseTarget] = useState<{
    branch: string;
    base: string;
  } | null>(null);
  const [dragged, setDragged] = useState<PanelId | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [addPanelOpen, setAddPanelOpen] = useState(false);

  const panelRenderers: Record<PanelId, ReactNode> = {
    graph: <CommitGraph />,
    details: <CommitDetail />,
    files: <FilePanel />,
    diff: <FileDetail />,
    branches: <BranchPanel />,
    stashes: <StashPanel />,
    tags: <TagPanel />,
    remotes: <RemotePanel />,
    reflog: <ReflogPanel />,
    summary: <StatsPanel />,
  };

  const [tl, tr, bl, br] = panelOrder;
  const topOccupied = tl !== null || tr !== null;
  const bottomOccupied = bl !== null || br !== null;
  const topBoth = tl !== null && tr !== null;
  const bottomBoth = bl !== null && br !== null;
  const hiddenPanels = PANEL_IDS.filter((id) => !panelOrder.includes(id));

  function handleGripMouseDown(e: React.MouseEvent, panelId: PanelId) {
    e.preventDefault();
    setDragged(panelId);
    setDragOverIndex(null);
    document.body.style.cursor = "grabbing";
  }

  // Pointer-based panel dragging (native HTML5 drag-and-drop is unreliable in
  // WebView2, so we track the mouse the same way the resize handles do).
  useEffect(() => {
    const pid = dragged;
    if (!pid) return;

    function slotUnderPoint(x: number, y: number): number | null {
      const el = document.elementFromPoint(x, y);
      const slotEl = el?.closest?.("[data-layout-slot]");
      return slotEl ? Number(slotEl.getAttribute("data-layout-slot")) : null;
    }

    function onMove(e: MouseEvent) {
      setDragOverIndex(slotUnderPoint(e.clientX, e.clientY));
    }

    function onUp(e: MouseEvent) {
      const index = slotUnderPoint(e.clientX, e.clientY);
      if (index !== null) {
        const fromIdx = panelOrder.indexOf(pid);
        if (fromIdx !== index) {
          const next = [...panelOrder];
          next[index] = pid;
          if (fromIdx >= 0) next[fromIdx] = panelOrder[index];
          setPanelOrder(next);
        }
      }
      setDragged(null);
      setDragOverIndex(null);
      document.body.style.cursor = "";
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
  }, [dragged, panelOrder, setPanelOrder]);

  function handleRebase(branch: string, base: string) {
    setRebaseTarget({ branch, base });
  }

  function renderSlot(
    index: number,
    id: PanelId | null,
    sizing: { className?: string; style?: CSSProperties }
  ) {
    return (
      <PanelSlot
        panelId={id}
        slotIndex={index}
        label={id ? PANEL_LABELS[id] : ""}
        editMode={editMode}
        dragOver={dragOverIndex === index}
        isSource={dragged !== null && dragged === id}
        className={sizing.className}
        style={sizing.style}
        onGripMouseDown={handleGripMouseDown}
        onRemovePanel={removePanel}
      >
        {id ? panelRenderers[id] : null}
      </PanelSlot>
    );
  }

  return (
    <>
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

                {/* Layout edit bar */}
                {editMode && (
                  <div className="layout-edit-bar">
                    <span className="layout-edit-bar-title">
                      <LayoutDashboard size={13} />
                      Editing layout — drag a panel's handle to rearrange
                    </span>
                    <div className="layout-edit-bar-actions">
                      <div className="layout-add-menu">
                        <button onClick={() => setAddPanelOpen((o) => !o)} title="Add a panel">
                          <Plus size={12} />
                          Add panel
                          <ChevronDown size={12} />
                        </button>
                        {addPanelOpen && (
                          <>
                            <div
                              className="layout-add-backdrop"
                              onClick={() => setAddPanelOpen(false)}
                            />
                            <div className="layout-add-dropdown">
                              {hiddenPanels.length === 0 ? (
                                <div className="layout-add-empty">All panels are shown</div>
                              ) : (
                                hiddenPanels.map((id) => (
                                  <button
                                    key={id}
                                    onClick={() => {
                                      addPanel(id);
                                      setAddPanelOpen(false);
                                    }}
                                  >
                                    <Plus size={12} />
                                    {PANEL_LABELS[id]}
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <button onClick={resetLayout} title="Restore the default layout">
                        <RotateCcw size={12} />
                        Reset
                      </button>
                      <button
                        className="layout-edit-done"
                        onClick={() => setEditMode(false)}
                      >
                        <Check size={12} />
                        Done
                      </button>
                    </div>
                  </div>
                )}

                {/* Top row: graph + details */}
                {topOccupied && (
                  <div className="flex shrink-0 min-h-0" style={{ height: graphHeight }}>
                    {renderSlot(0, tl, { className: "flex-1" })}
                    {topBoth && (
                      <ResizeHandle
                        direction="vertical"
                        onDelta={(d) => setDetailWidth((w) => w + d)}
                        title="Resize column"
                      />
                    )}
                    {renderSlot(1, tr, {
                      className: "shrink-0",
                      style: { width: detailWidth },
                    })}
                  </div>
                )}

                {topOccupied && bottomOccupied && (
                  <ResizeHandle
                    direction="horizontal"
                    onDelta={(d) => setGraphHeight((h) => h + d)}
                    title="Resize graph"
                  />
                )}

                {/* Bottom row: files + diff */}
                {bottomOccupied && (
                  <div
                    className="flex flex-1 min-h-0"
                    style={{
                      borderTop: topOccupied ? undefined : "1px solid var(--border)",
                    }}
                  >
                    {renderSlot(2, bl, {
                      className: "shrink-0",
                      style: { width: fileWidth },
                    })}
                    {bottomBoth && (
                      <ResizeHandle
                        direction="vertical"
                        onDelta={(d) => setFileWidth((w) => w + d)}
                        title="Resize column"
                      />
                    )}
                    {renderSlot(3, br, { className: "flex-1" })}
                  </div>
                )}

                {/* Commit bar */}
                {commitBarVisible && <CommitDialog />}
              </>
            )}
          </div>
        ) : (
          <WelcomeScreen />
        )}
      </Layout>
      <SettingsDialog />
      <ReflogDialog />
      <RepoSummaryDialog />
    </>
  );
}
