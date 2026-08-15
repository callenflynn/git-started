import type { CommitInfo } from "./types";

/**
 * Commit-graph lane layout.
 *
 * Commits are expected in topological order: newest first, children before
 * parents (this is what `get_log` returns via `Sort::TIME`). The algorithm
 * assigns each commit to a vertical "lane" so that:
 *   - a linear chain stays in one lane,
 *   - a merge commit (multiple parents) fans out into one lane per parent,
 *   - a branch point (a commit reached by multiple children) pulls those
 *     lanes together into a single node.
 *
 * Colors are assigned when a branch first appears and persist down the lane,
 * so a branch keeps its color through merges.
 */

export const LANE_COLORS = [
  "var(--graph-main)",
  "var(--graph-branch1)",
  "var(--graph-branch2)",
  "var(--graph-branch3)",
  "var(--graph-branch4)",
  "var(--graph-branch5)",
  "var(--graph-branch6)",
  "var(--graph-branch7)",
];

export function colorForIndex(i: number): string {
  if (i < 0) return "var(--text-muted)";
  return LANE_COLORS[((i % LANE_COLORS.length) + LANE_COLORS.length) % LANE_COLORS.length];
}

export interface GraphGeometry {
  rowH: number;
  laneW: number;
  padLeft: number;
  nodeR: number;
}

export interface GraphNode {
  oid: string;
  row: number;
  lane: number;
  x: number;
  y: number;
  colorIndex: number;
  color: string;
}

export interface GraphEdge {
  childOid: string;
  parentOid: string;
  fromLane: number;
  toLane: number;
  fromRow: number;
  toRow: number;
  colorIndex: number;
}

export interface GraphLayout {
  nodes: Map<string, GraphNode>;
  /** Cross-lane elbow edges (child -> parent in a different lane). */
  edges: GraphEdge[];
  /** rows[r][lane] = color index occupying the gap below row r, or -1. */
  rows: Array<Array<number>>;
  laneCount: number;
  /** "row:lane" cells where a horizontal elbow passes over a lane. */
  crossings: Set<string>;
}

export function yForRow(row: number, g: GraphGeometry): number {
  return row * g.rowH + g.rowH / 2;
}

export function xForLane(lane: number, g: GraphGeometry): number {
  return g.padLeft + lane * g.laneW + g.nodeR;
}

export function buildGraphLayout(
  commits: CommitInfo[],
  g: GraphGeometry
): GraphLayout {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const rows: Array<Array<number>> = [];

  // lanes[i] = oid of the commit whose parent edge currently occupies lane i
  // (i.e. the commit expected to appear next in that lane).
  const lanes: Array<string | null> = [];
  const laneColor: number[] = [];
  let nextColor = 0;

  const firstFreeLane = (): number => {
    const i = lanes.findIndex((l) => l === null);
    if (i !== -1) return i;
    lanes.push(null);
    laneColor.push(-1);
    return lanes.length - 1;
  };

  commits.forEach((commit, row) => {
    // Incoming lanes: edges from children above that terminate at this commit.
    const incoming: number[] = [];
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] === commit.oid) incoming.push(i);
    }

    let lane: number;
    if (incoming.length > 0) {
      // A merge: pull the leftmost incoming lane into this node, free the rest.
      lane = incoming[0];
      for (let k = 1; k < incoming.length; k++) lanes[incoming[k]] = null;
    } else {
      // A new head inside the visible window: claim a lane with a fresh color.
      lane = firstFreeLane();
      laneColor[lane] = nextColor++;
    }

    nodes.set(commit.oid, {
      oid: commit.oid,
      row,
      lane,
      x: xForLane(lane, g),
      y: yForRow(row, g),
      colorIndex: laneColor[lane],
      color: colorForIndex(laneColor[lane]),
    });

    if (commit.parent_oids.length === 0) {
      // Root commit: nothing continues below.
      lanes[lane] = null;
    } else {
      // First parent inherits this lane (and its color).
      lanes[lane] = commit.parent_oids[0];
      // Additional parents diverge into fresh lanes.
      for (let p = 1; p < commit.parent_oids.length; p++) {
        const free = firstFreeLane();
        lanes[free] = commit.parent_oids[p];
        laneColor[free] = nextColor++;
      }
    }

    rows[row] = lanes.map((l, i) => (l !== null ? laneColor[i] : -1));
  });

  // Cross-lane edges only; same-lane links are the pass-through verticals.
  const crossings = new Set<string>();
  for (const commit of commits) {
    const node = nodes.get(commit.oid);
    if (!node) continue;
    const isMerge = commit.parent_oids.length >= 2;
    for (const parentOid of commit.parent_oids) {
      const parentNode = nodes.get(parentOid);
      if (parentNode && parentNode.lane !== node.lane) {
        edges.push({
          childOid: commit.oid,
          parentOid,
          fromLane: node.lane,
          toLane: parentNode.lane,
          fromRow: node.row,
          toRow: parentNode.row,
          // A merge's elbow belongs to the merged-in branch (the parent); a
          // fork's elbow belongs to the branching child.
          colorIndex: isMerge ? parentNode.colorIndex : node.colorIndex,
        });
        // Record the intermediate lanes the horizontal segment crosses so the
        // renderer can hop those lanes' vertical lines over the crossing.
        const lo = Math.min(node.lane, parentNode.lane);
        const hi = Math.max(node.lane, parentNode.lane);
        for (let l = lo + 1; l < hi; l++) {
          crossings.add(`${node.row}:${l}`);
        }
      }
    }
  }

  return { nodes, edges, rows, laneCount: lanes.length, crossings };
}
