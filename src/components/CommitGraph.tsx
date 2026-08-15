import { useState, type ReactNode } from "react";
import {
  useLog,
  useSearchCommits,
  useCheckout,
  useCherryPick,
  useRevert,
} from "../hooks/useGit";
import { useRepoStore } from "../stores/repo-store";
import type { CommitInfo } from "../lib/types";
import {
  buildGraphLayout,
  colorForIndex,
  xForLane,
  yForRow,
  type GraphGeometry,
} from "../lib/graph";
import { relativeTime, truncate } from "../lib/format";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { Search, X, GitCommit, GitMerge, Copy, RotateCcw } from "lucide-react";

const GEOM: GraphGeometry = { rowH: 30, laneW: 28, padLeft: 12, nodeR: 5 };

// Vertical gap left around a horizontal crossing so a lane line hops over it.
const HOP = 6;

// Text column layout (offsets from the right edge of the lane area).
const COL_MSG = 0;
const COL_OID = 320;
const COL_AUTHOR = 388;
const COL_DATE = 500;

export function CommitGraph() {
  const [searchQuery, setSearchQuery] = useState("");
  const selectedCommit = useRepoStore((s) => s.selectedCommit);
  const selectCommit = useRepoStore((s) => s.selectCommit);
  const log = useLog();
  const searchResult = useSearchCommits(searchQuery);
  const allCommits = log.data ?? [];

  const commits = searchQuery.trim() ? (searchResult.data ?? []) : allCommits;

  const checkoutMut = useCheckout();
  const cherryPickMut = useCherryPick();
  const revertMut = useRevert();
  const [menu, setMenu] = useState<{ x: number; y: number; oid: string } | null>(null);

  function handleCommitContext(e: React.MouseEvent, oid: string) {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, oid });
  }

  const menuItems: MenuItem[] = menu
    ? [
        {
          label: "Checkout commit",
          icon: <GitCommit size={14} />,
          onClick: () =>
            checkoutMut.mutate(menu.oid, { onError: (e) => window.alert(e.message) }),
        },
        {
          label: "Cherry-pick",
          icon: <GitMerge size={14} />,
          onClick: () =>
            cherryPickMut.mutate(menu.oid, { onError: (e) => window.alert(e.message) }),
        },
        {
          label: "Revert",
          icon: <RotateCcw size={14} />,
          danger: true,
          onClick: () =>
            revertMut.mutate(menu.oid, { onError: (e) => window.alert(e.message) }),
        },
        {
          label: "Copy SHA",
          icon: <Copy size={14} />,
          onClick: () => navigator.clipboard.writeText(menu.oid),
        },
      ]
    : [];

  if (log.isLoading) {
    return (
      <div
        className="flex items-center justify-center h-48 text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        Loading commits...
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden flex-1"
      style={{ background: "var(--bg-card)" }}
    >
      {/* Search bar */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Search size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search commits by author or message..."
          className="flex-1 text-sm px-2 py-1 rounded outline-none"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        />
        {searchQuery && (
          <button
            className="p-0.5 rounded hover:bg-white/10"
            onClick={() => setSearchQuery("")}
            title="Clear search"
          >
            <X size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        )}
        {searchQuery.trim() && (
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            {commits.length} result{commits.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {commits.length === 0 ? (
        <div
          className="flex items-center justify-center h-48 text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          {searchQuery.trim() ? "No matching commits." : "No commits yet."}
        </div>
      ) : (
        <div className="overflow-y-auto flex-1">
          <CommitSvg
            commits={commits}
            selectedCommit={selectedCommit}
            onSelect={selectCommit}
            onContext={handleCommitContext}
          />
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}

function CommitSvg({
  commits,
  selectedCommit,
  onSelect,
  onContext,
}: {
  commits: CommitInfo[];
  selectedCommit: string | null;
  onSelect: (oid: string) => void;
  onContext: (e: React.MouseEvent, oid: string) => void;
}) {
  const layout = buildGraphLayout(commits, GEOM);
  const laneCount = layout.laneCount;
  const textX = GEOM.padLeft + laneCount * GEOM.laneW + GEOM.nodeR * 2;
  const svgW = textX + 560;
  const svgH = commits.length * GEOM.rowH + 8;

  // Pass-through vertical lane lines (one per active lane per gap).
  // When a horizontal elbow crosses a lane, that lane's line hops over the
  // crossing so the two never visually collide.
  const laneLines: ReactNode[] = [];
  for (let r = 0; r < commits.length; r++) {
    const rowColors = layout.rows[r] ?? [];
    for (let lane = 0; lane < laneCount; lane++) {
      const ci = rowColors[lane];
      if (ci === undefined || ci < 0) continue;
      const x = xForLane(lane, GEOM);
      let y1 = yForRow(r, GEOM);
      let y2 = r < commits.length - 1 ? yForRow(r + 1, GEOM) : svgH;
      if (layout.crossings.has(`${r}:${lane}`)) y1 += HOP;
      if (layout.crossings.has(`${r + 1}:${lane}`)) y2 -= HOP;
      if (y2 <= y1) continue;
      laneLines.push(
        <line
          key={`${r}-${lane}`}
          x1={x}
          y1={y1}
          x2={x}
          y2={y2}
          stroke={colorForIndex(ci)}
          strokeWidth={2}
        />
      );
    }
  }

  // Merge elbows: horizontal at the child's row, then down to the parent's lane.
  const elbows = layout.edges.map((e) => {
    const x1 = xForLane(e.fromLane, GEOM);
    const x2 = xForLane(e.toLane, GEOM);
    const y1 = yForRow(e.fromRow, GEOM);
    const y2 = yForRow(e.toRow, GEOM);
    return (
      <path
        key={`${e.childOid}-${e.parentOid}`}
        d={`M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`}
        stroke={colorForIndex(e.colorIndex)}
        strokeWidth={2}
        fill="none"
      />
    );
  });

  return (
    <svg width={svgW} height={svgH} className="block">
      {laneLines}
      {elbows}

      {commits.map((commit) => {
        const node = layout.nodes.get(commit.oid);
        if (!node) return null;
        const selected = commit.oid === selectedCommit;
        const rowY = node.y;

        return (
          <g
            key={commit.oid}
            className="graph-row"
            onClick={() => onSelect(commit.oid)}
            onContextMenu={(e) => onContext(e, commit.oid)}
          >
            {/* Full-row hover/selection background */}
            <rect
              className="row-bg"
              x={0}
              y={rowY - GEOM.rowH / 2}
              width={svgW}
              height={GEOM.rowH}
              fill={selected ? "var(--bg-hover)" : undefined}
            />

            {/* Selection halo */}
            {selected && (
              <circle
                cx={node.x}
                cy={rowY}
                r={GEOM.nodeR + 4}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={1.5}
              />
            )}

            {/* Node */}
            <circle
              cx={node.x}
              cy={rowY}
              r={GEOM.nodeR}
              fill={node.color}
              stroke="var(--bg-card)"
              strokeWidth={2}
            />

            {/* Branch/tag labels float next to the node */}
            {commit.branch_names.map((bn, i) => {
              const chipX = node.x + GEOM.nodeR + 5;
              const chipY = rowY - 8 + i * 18;
              const w = bn.length * 7 + 12;
              return (
                <g key={bn}>
                  <rect
                    x={chipX}
                    y={chipY}
                    width={w}
                    height={16}
                    rx={4}
                    fill={node.color}
                    opacity={0.92}
                  />
                  <text
                    x={chipX + 6}
                    y={chipY + 11.5}
                    fill="var(--text-inverse)"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                  >
                    {bn}
                  </text>
                </g>
              );
            })}

            {/* Message */}
            <text
              x={textX + COL_MSG}
              y={rowY + 1}
              dominantBaseline="middle"
              fill={selected ? "var(--text-primary)" : "var(--text-secondary)"}
              fontSize={12}
              fontFamily="var(--font-body)"
            >
              {truncate(commit.message, 46)}
            </text>

            {/* Short OID */}
            <text
              x={textX + COL_OID}
              y={rowY + 1}
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={11}
              fontFamily="var(--font-mono)"
            >
              {commit.short_oid}
            </text>

            {/* Author */}
            <text
              x={textX + COL_AUTHOR}
              y={rowY + 1}
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={11}
              fontFamily="var(--font-body)"
            >
              {truncate(commit.author, 16)}
            </text>

            {/* Relative date */}
            <text
              x={textX + COL_DATE}
              y={rowY + 1}
              dominantBaseline="middle"
              fill="var(--text-muted)"
              fontSize={11}
              fontFamily="var(--font-body)"
            >
              {relativeTime(commit.timestamp)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
