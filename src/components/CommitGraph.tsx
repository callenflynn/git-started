import { useLog } from "../hooks/useGit";
import type { CommitInfo } from "../lib/types";

const NODE_R = 5;
const ROW_H = 28;
const LANE_W = 20;
const PAD_LEFT = 12;

// Colors for parallel branch lanes.
const LANE_COLORS = [
  "var(--graph-main)",
  "var(--graph-branch1)",
  "var(--graph-branch2)",
  "var(--graph-branch3)",
  "var(--graph-branch4)",
];

interface NodePosition {
  x: number;
  y: number;
  lane: number;
}

/**
 * Build lane positions for each commit.
 * Walk the list top to bottom. Each commit gets assigned to a lane.
 * Merge commits connect back to their parent lanes.
 */
function buildGraph(commits: CommitInfo[]): Map<string, NodePosition> {
  const pos = new Map<string, NodePosition>();
  const activeLanes: string[] = [];

  commits.forEach((commit, row) => {
    // Find or assign a lane for this commit.
    let lane = activeLanes.indexOf(commit.oid);
    if (lane === -1) {
      lane = activeLanes.indexOf(null as unknown as string);
      if (lane === -1) {
        lane = activeLanes.length;
        activeLanes.push(commit.oid);
      } else {
        activeLanes[lane] = commit.oid;
      }
    }

    const x = PAD_LEFT + lane * LANE_W + NODE_R;
    const y = row * ROW_H + ROW_H / 2;
    pos.set(commit.oid, { x, y, lane });

    // Free lanes from parents that have been fully processed.
    for (const parentOid of commit.parent_oids) {
      if (!commits.find((c) => c.oid === parentOid)) {
        // Parent is outside our visible range.
        const parentLane = activeLanes.indexOf(parentOid);
        if (parentLane !== -1) {
          activeLanes[parentLane] = null as unknown as string;
        }
      }
    }

    // If this commit has only one parent and it is not yet placed,
    // keep the lane occupied for the parent.
    if (commit.parent_oids.length === 1) {
      const parentOid = commit.parent_oids[0];
      if (!pos.has(parentOid)) {
        activeLanes[lane] = parentOid;
      } else {
        activeLanes[lane] = null as unknown as string;
      }
    } else {
      // Merge or root commit. Free this lane.
      activeLanes[lane] = null as unknown as string;
    }
  });

  return pos;
}

export function CommitGraph() {
  const log = useLog();
  const commits = log.data ?? [];

  if (log.isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-sm"
           style={{ color: "var(--text-muted)" }}>
        Loading commits...
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm"
           style={{ color: "var(--text-muted)" }}>
        No commits yet.
      </div>
    );
  }

  const positions = buildGraph(commits);
  const maxLanes = Math.max(...[...positions.values()].map((p) => p.lane + 1), 1);
  const svgW = PAD_LEFT + maxLanes * LANE_W + NODE_R * 2 + 280;
  const svgH = commits.length * ROW_H + 8;

  return (
    <div className="overflow-y-auto flex-1" style={{ background: "var(--bg-card)" }}>
      <svg width={svgW} height={svgH} className="block">
        {commits.map((commit, row) => {
          const p = positions.get(commit.oid);
          if (!p) return null;

          // Draw edges to parents.
          const edges = commit.parent_oids.map((parentOid) => {
            const pp = positions.get(parentOid);
            if (!pp) {
              // Parent is off-screen; draw line downward.
              return (
                <line
                  key={parentOid}
                  x1={p.x}
                  y1={p.y}
                  x2={p.x}
                  y2={svgH}
                  stroke={LANE_COLORS[p.lane % LANE_COLORS.length]}
                  strokeWidth={2}
                  opacity={0.5}
                />
              );
            }
            if (pp.x === p.x) {
              // Same lane — straight line.
              return (
                <line
                  key={parentOid}
                  x1={p.x}
                  y1={p.y}
                  x2={pp.x}
                  y2={pp.y}
                  stroke={LANE_COLORS[p.lane % LANE_COLORS.length]}
                  strokeWidth={2}
                />
              );
            }
            // Different lane — bend via a path.
            const midY = (p.y + pp.y) / 2;
            return (
              <path
                key={parentOid}
                d={`M ${p.x} ${p.y} L ${p.x} ${midY} L ${pp.x} ${midY} L ${pp.x} ${pp.y}`}
                stroke={LANE_COLORS[p.lane % LANE_COLORS.length]}
                strokeWidth={2}
                fill="none"
              />
            );
          });

          return (
            <g key={commit.oid}>
              {edges}
              {/* Commit node */}
              <circle
                cx={p.x}
                cy={p.y}
                r={NODE_R}
                fill={LANE_COLORS[p.lane % LANE_COLORS.length]}
                stroke="var(--bg-card)"
                strokeWidth={2}
              />
              {/* Commit label */}
              <text
                x={PAD_LEFT + maxLanes * LANE_W + NODE_R + 8}
                y={p.y + 1}
                dominantBaseline="middle"
                fill="var(--text-primary)"
                fontSize={12}
                fontFamily="var(--font-mono)"
              >
                {commit.short_oid}
              </text>
              <text
                x={PAD_LEFT + maxLanes * LANE_W + NODE_R + 68}
                y={p.y + 1}
                dominantBaseline="middle"
                fill="var(--text-secondary)"
                fontSize={12}
                fontFamily="var(--font-body)"
              >
                {commit.message.length > 60
                  ? commit.message.slice(0, 60) + "..."
                  : commit.message}
              </text>
              <text
                x={PAD_LEFT + maxLanes * LANE_W + NODE_R + 68 + 420}
                y={p.y + 1}
                dominantBaseline="middle"
                fill="var(--text-muted)"
                fontSize={11}
                fontFamily="var(--font-body)"
              >
                {commit.author}
              </text>
              {/* Branch labels */}
              {commit.branch_names.map((bn) => (
                <g key={bn}>
                  <rect
                    x={PAD_LEFT + maxLanes * LANE_W + NODE_R + 68 + 520}
                    y={p.y - 8}
                    width={bn.length * 7 + 8}
                    height={16}
                    rx={4}
                    fill="var(--accent)"
                    opacity={0.9}
                  />
                  <text
                    x={PAD_LEFT + maxLanes * LANE_W + NODE_R + 68 + 524}
                    y={p.y + 1}
                    dominantBaseline="middle"
                    fill="var(--text-inverse)"
                    fontSize={10}
                    fontFamily="var(--font-mono)"
                  >
                    {bn}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
