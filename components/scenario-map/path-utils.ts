import { curveCatmullRom, line } from "d3-shape";
import { svgPathProperties } from "svg-path-properties";
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
const DESKTOP_MIN_X = 10;
const DESKTOP_MAX_X = 90;
const DESKTOP_SPAN_PER_NODE = 64;
const DESKTOP_MIN_SPAN = 430;
const DESKTOP_MAX_SPAN = 820;
const DESKTOP_MIN_ANCHORS = 11;
const DESKTOP_MAX_ANCHORS = 21;

interface ControlPoint {
  x: number;
  y: number;
}

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

function desktopAnchorCount(count: number): number {
  const raw = Math.round(count * 1.35) + 3;
  const clamped = Math.round(
    clamp(raw, DESKTOP_MIN_ANCHORS, DESKTOP_MAX_ANCHORS),
  );
  return clamped % 2 === 0 ? clamped + 1 : clamped;
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

function buildTrailXs(anchorCount: number, rng: () => number): number[] {
  const xs = new Array<number>(anchorCount);
  xs[0] = 52;
  xs[anchorCount - 1] = 48;

  const fill = (left: number, right: number, amplitude: number) => {
    if (right - left <= 1) return;
    const mid = Math.floor((left + right) / 2);
    const base = (xs[left] + xs[right]) / 2;
    xs[mid] = clamp(
      base + (rng() - 0.5) * amplitude,
      DESKTOP_MIN_X,
      DESKTOP_MAX_X,
    );
    fill(left, mid, amplitude * 0.74);
    fill(mid, right, amplitude * 0.74);
  };

  fill(0, anchorCount - 1, 140);

  // One light smoothing pass keeps roughness while avoiding sharp spikes.
  const smoothed = [...xs];
  for (let i = 1; i < anchorCount - 1; i++) {
    smoothed[i] = clamp(
      xs[i] * 0.66 + (xs[i - 1] + xs[i + 1]) * 0.17 + (rng() - 0.5) * 4.2,
      DESKTOP_MIN_X,
      DESKTOP_MAX_X,
    );
  }
  smoothed[0] = 52;
  smoothed[anchorCount - 1] = 48;

  return smoothed;
}

function buildDesktopControlPoints(count: number): ControlPoint[] {
  const span = desktopPathSpan(count);
  const anchorCount = desktopAnchorCount(count);
  const rng = createRng(0x7f4a7c15 + count * 131);
  const xs = buildTrailXs(anchorCount, rng);

  const yWeights = Array.from(
    { length: anchorCount - 1 },
    () => 0.75 + rng() * 0.9,
  );
  const totalWeight = yWeights.reduce((sum, value) => sum + value, 0);

  const points: ControlPoint[] = [];
  let accumulated = 0;
  for (let i = 0; i < anchorCount; i++) {
    if (i > 0) accumulated += yWeights[i - 1];
    const t = totalWeight === 0 ? 0 : accumulated / totalWeight;
    points.push({
      x: xs[i],
      y: DESKTOP_TOP_PADDING + t * span,
    });
  }

  return points;
}

function buildDesktopCurve(points: ControlPoint[]): string | null {
  if (points.length < 2) return null;
  return (
    line<ControlPoint>()
      .x((point) => point.x)
      .y((point) => point.y)
      .curve(curveCatmullRom.alpha(0.68))(points) ?? null
  );
}

function computeDesktopPositions(count: number): NodePosition[] {
  const curve = buildDesktopCurve(buildDesktopControlPoints(count));
  if (!curve) return [];

  const properties = new svgPathProperties(curve);
  const totalLength = properties.getTotalLength();
  const denominator = Math.max(count - 1, 1);
  const positions: NodePosition[] = [];

  for (let i = 0; i < count; i++) {
    const point = properties.getPointAtLength((i / denominator) * totalLength);
    const previousY = positions[i - 1]?.y;
    const y =
      previousY === undefined ? point.y : Math.max(point.y, previousY + 4);

    positions.push({
      index: i,
      x: clamp(point.x, DESKTOP_MIN_X, DESKTOP_MAX_X),
      y,
    });
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
