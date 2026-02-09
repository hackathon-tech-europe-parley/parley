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

const DESKTOP_TOP_PADDING = 90;
const DESKTOP_BOTTOM_PADDING = 130;
const DESKTOP_MIN_X = 8;
const DESKTOP_MAX_X = 92;
const DESKTOP_START_X = 10;
const DESKTOP_END_X = 90;
const DESKTOP_SPAN_PER_NODE = 112;
const DESKTOP_MIN_SPAN = 760;
const DESKTOP_MAX_SPAN = 1500;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function desktopPathSpan(count: number): number {
  if (count <= 1) return DESKTOP_MIN_SPAN;
  return clamp(
    (count - 1) * DESKTOP_SPAN_PER_NODE,
    DESKTOP_MIN_SPAN,
    DESKTOP_MAX_SPAN,
  );
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
  const rng = createRng(0x9e3779b9 + count * 313);
  const denominator = Math.max(count - 1, 1);
  const xRange = DESKTOP_END_X - DESKTOP_START_X;
  const targetSpan = desktopPathSpan(count);
  const positions: NodePosition[] = [];
  let y = DESKTOP_TOP_PADDING;
  let driftX = (rng() - 0.5) * 6;

  for (let i = 0; i < count; i++) {
    const progress = i / denominator;
    const baselineX = DESKTOP_START_X + progress * xRange;

    if (i > 0) {
      y += 72 + rng() * 58 + (rng() < 0.24 ? 24 + rng() * 18 : 0);
    }

    driftX += (rng() - 0.5) * 9;
    driftX = clamp(driftX, -15, 15);

    let x = baselineX + driftX + (rng() - 0.5) * 5;

    // Short local backtracks like a hiking trail switchback.
    if (i > 1 && rng() < 0.34) {
      x -= 5 + rng() * 10;
    }

    x = clamp(x, baselineX - 12, baselineX + 18);
    x = clamp(x, DESKTOP_MIN_X, DESKTOP_MAX_X);

    if (i > 0) {
      const maxBacktrack = rng() < 0.45 ? 10 : 5;
      x = Math.max(x, positions[i - 1].x - maxBacktrack);
    }

    positions.push({
      index: i,
      x,
      y,
    });
  }

  const rawSpan = positions[positions.length - 1].y - DESKTOP_TOP_PADDING;
  const scale = rawSpan > 0 ? targetSpan / rawSpan : 1;
  for (const position of positions) {
    position.y =
      DESKTOP_TOP_PADDING + (position.y - DESKTOP_TOP_PADDING) * scale;
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

  return DESKTOP_TOP_PADDING + desktopPathSpan(count) + DESKTOP_BOTTOM_PADDING;
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
