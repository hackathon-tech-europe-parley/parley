import type { ScenarioNodeState } from "@/core/progress";

export interface NodePosition {
  index: number;
  x: number;
  y: number;
}

export interface PathSegment {
  from: NodePosition;
  to: NodePosition;
  status: "completed" | "active" | "locked";
}

export type MapLayout = "mobile" | "desktop";

const MOBILE_NODE_SPACING = 120;
const MOBILE_AMPLITUDE = 18;
const MOBILE_TOP_PADDING = 40;
const MOBILE_BOTTOM_PADDING = 80;

const DESKTOP_TOP_PADDING = 90;
const DESKTOP_BOTTOM_PADDING = 130;
const DESKTOP_ROW_SPACING = 220;
const DESKTOP_MIN_X = 12;
const DESKTOP_MAX_X = 88;
const DESKTOP_ROW_WAVE = 34;
const DESKTOP_X_JITTER = 2.6;

function desktopColumns(count: number): number {
  if (count <= 4) return 2;
  if (count <= 8) return 3;
  return 4;
}

export function computeNodePositions(
  count: number,
  layout: MapLayout,
): NodePosition[] {
  if (count <= 0) return [];

  const positions: NodePosition[] = [];

  if (layout === "mobile") {
    for (let i = 0; i < count; i++) {
      positions.push({
        index: i,
        x: 50 + Math.sin(i * (Math.PI / 2.5)) * MOBILE_AMPLITUDE,
        y: MOBILE_TOP_PADDING + i * MOBILE_NODE_SPACING,
      });
    }
    return positions;
  }

  const columns = desktopColumns(count);
  const xRange = DESKTOP_MAX_X - DESKTOP_MIN_X;
  const denominator = Math.max(columns - 1, 1);

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / columns);
    const col = i % columns;
    const reverseRow = row % 2 === 1;
    const visualCol = reverseRow ? columns - 1 - col : col;
    const colProgress = visualCol / denominator;
    const yWave =
      Math.sin(colProgress * Math.PI + row * 0.72) * DESKTOP_ROW_WAVE;
    const xJitter = Math.sin(row * 1.18 + visualCol * 0.9) * DESKTOP_X_JITTER;

    positions.push({
      index: i,
      x: DESKTOP_MIN_X + colProgress * xRange + xJitter,
      y: DESKTOP_TOP_PADDING + row * DESKTOP_ROW_SPACING + yWave,
    });
  }

  return positions;
}

export function computeTotalHeight(count: number, layout: MapLayout): number {
  if (count <= 0) return 0;

  if (layout === "mobile") {
    return (
      MOBILE_TOP_PADDING +
      (count - 1) * MOBILE_NODE_SPACING +
      MOBILE_BOTTOM_PADDING
    );
  }

  const rows = Math.ceil(count / desktopColumns(count));
  return (
    DESKTOP_TOP_PADDING +
    (rows - 1) * DESKTOP_ROW_SPACING +
    DESKTOP_ROW_WAVE +
    DESKTOP_BOTTOM_PADDING
  );
}

export function buildSvgPath(
  from: NodePosition,
  to: NodePosition,
  containerWidth: number,
): string {
  const fx = (from.x / 100) * containerWidth;
  const fy = from.y;
  const tx = (to.x / 100) * containerWidth;
  const ty = to.y;
  const dy = ty - fy;
  const dx = tx - fx;

  if (Math.abs(dy) < 72) {
    const bow = Math.max(22, Math.min(52, Math.abs(dx) * 0.24));
    const bowDirection = from.index % 2 === 0 ? 1 : -1;
    const c1y = fy + bow * bowDirection;
    const c2y = ty + bow * bowDirection;
    return `M ${fx} ${fy} C ${fx} ${c1y} ${tx} ${c2y} ${tx} ${ty}`;
  }

  return `M ${fx} ${fy} C ${fx} ${fy + dy * 0.4} ${tx} ${fy + dy * 0.6} ${tx} ${ty}`;
}

export function classifySegments(
  positions: NodePosition[],
  nodeStates: Map<string, ScenarioNodeState>,
  scenarioKeys: string[],
): PathSegment[] {
  const segments: PathSegment[] = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const key = scenarioKeys[i];
    const state = nodeStates.get(key);
    const beginnerCompleted =
      state?.levels.some(
        (l) => l.level === "beginner" && l.status === "completed",
      ) ?? false;

    const nextKey = scenarioKeys[i + 1];
    const nextState = nodeStates.get(nextKey);
    const nextAllLocked =
      nextState?.levels.every((l) => l.status === "locked") ?? true;

    let status: PathSegment["status"];
    if (beginnerCompleted) {
      status = "completed";
    } else if (!nextAllLocked) {
      status = "active";
    } else {
      status = "locked";
    }

    segments.push({ from: positions[i], to: positions[i + 1], status });
  }
  return segments;
}
