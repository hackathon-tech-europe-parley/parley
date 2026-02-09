import type { ScenarioNodeState } from "@/core/progress";

export interface NodePosition {
  index: number;
  x: number;
  y: number;
}

export interface PathSegment {
  from: NodePosition;
  to: NodePosition;
  fromPrev?: NodePosition;
  toNext?: NodePosition;
  status: "completed" | "active" | "locked";
}

export type MapLayout = "mobile" | "desktop";

const MOBILE_NODE_SPACING = 120;
const MOBILE_AMPLITUDE = 18;
const MOBILE_TOP_PADDING = 40;
const MOBILE_BOTTOM_PADDING = 80;

const DESKTOP_HEIGHT = 560;
const DESKTOP_CENTER_Y = 272;
const DESKTOP_MIN_Y = 116;
const DESKTOP_MAX_Y = 428;
const DESKTOP_START_X = 6;
const DESKTOP_END_X = 94;
const DESKTOP_BASE_WIDTH = 980;
const DESKTOP_WIDTH_PER_NODE = 220;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeDesktopPositions(count: number): NodePosition[] {
  if (count <= 0) return [];

  const rng = createRng(0xa53b9f1d + count * 941);
  const denominator = Math.max(count - 1, 1);
  const xRange = DESKTOP_END_X - DESKTOP_START_X;
  const positions: NodePosition[] = [];

  let y = DESKTOP_CENTER_Y + (rng() - 0.5) * 36;
  positions.push({
    index: 0,
    x: DESKTOP_START_X + 1.8 + (rng() - 0.5) * 1.2,
    y,
  });

  let driftX = (rng() - 0.5) * 3.5;

  for (let i = 1; i < count; i++) {
    const progress = i / denominator;
    const baselineX = DESKTOP_START_X + progress * xRange;

    driftX += (rng() - 0.5) * 3.6;
    driftX = clamp(driftX, -7, 7);

    let x = baselineX + driftX + (rng() - 0.5) * 3.2;

    // Local switchbacks to avoid a too-linear route.
    if (rng() < 0.4) {
      x -= 3 + rng() * 4;
    }

    const previousX = positions[i - 1].x;
    x = clamp(x, previousX - (3 + rng() * 4), previousX + (12 + rng() * 4));
    x = clamp(x, DESKTOP_START_X, DESKTOP_END_X);

    let deltaY = (rng() - 0.5) * 110;
    if (rng() < 0.28) {
      deltaY += (rng() < 0.5 ? -1 : 1) * (40 + rng() * 45);
    }

    y += deltaY;
    y += (DESKTOP_CENTER_Y - y) * 0.22;
    y = clamp(y, DESKTOP_MIN_Y, DESKTOP_MAX_Y);

    positions.push({ index: i, x, y });
  }

  return positions;
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

  return computeDesktopPositions(count);
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

  return DESKTOP_HEIGHT;
}

export function computeTotalWidth(count: number, layout: MapLayout): number {
  if (layout === "mobile") return 0;
  return DESKTOP_BASE_WIDTH + Math.max(count - 1, 0) * DESKTOP_WIDTH_PER_NODE;
}

export function buildSvgPath(
  segment: PathSegment,
  containerWidth: number,
): string {
  const fromPrev = segment.fromPrev ?? segment.from;
  const toNext = segment.toNext ?? segment.to;

  const p0x = (fromPrev.x / 100) * containerWidth;
  const p0y = fromPrev.y;
  const p1x = (segment.from.x / 100) * containerWidth;
  const p1y = segment.from.y;
  const p2x = (segment.to.x / 100) * containerWidth;
  const p2y = segment.to.y;
  const p3x = (toNext.x / 100) * containerWidth;
  const p3y = toNext.y;

  const tension = 0.92;
  const c1x = p1x + ((p2x - p0x) * tension) / 6;
  const c1y = p1y + ((p2y - p0y) * tension) / 6;
  const c2x = p2x - ((p3x - p1x) * tension) / 6;
  const c2y = p2y - ((p3y - p1y) * tension) / 6;

  return `M ${p1x} ${p1y} C ${c1x} ${c1y} ${c2x} ${c2y} ${p2x} ${p2y}`;
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

    segments.push({
      from: positions[i],
      to: positions[i + 1],
      fromPrev: positions[i - 1] ?? positions[i],
      toNext: positions[i + 2] ?? positions[i + 1],
      status,
    });
  }
  return segments;
}
