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
const DESKTOP_SPAN_PER_NODE = 54;
const DESKTOP_MIN_SPAN = 420;
const DESKTOP_MAX_SPAN = 700;
const DESKTOP_MIN_ANCHORS = 6;
const DESKTOP_MAX_ANCHORS = 12;

interface ControlPoint {
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function seededNoise(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return value - Math.floor(value);
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
  return Math.round(
    clamp(count * 0.8, DESKTOP_MIN_ANCHORS, DESKTOP_MAX_ANCHORS),
  );
}

function buildDesktopControlPoints(count: number): ControlPoint[] {
  const span = desktopPathSpan(count);
  const anchorCount = desktopAnchorCount(count);
  const points: ControlPoint[] = [];

  for (let i = 0; i < anchorCount; i++) {
    const t = i / (anchorCount - 1);
    const x = clamp(
      50 +
        Math.sin(t * Math.PI * 3 + 0.65) * 34 +
        Math.sin(t * Math.PI * 6.2 + 1.45) * 12 +
        (seededNoise(i, 11) - 0.5) * 7,
      DESKTOP_MIN_X,
      DESKTOP_MAX_X,
    );

    points.push({
      x,
      y: DESKTOP_TOP_PADDING + t * span,
    });
  }

  points[0].x = 52;
  points[points.length - 1].x = 48;
  return points;
}

function buildDesktopCurve(points: ControlPoint[]): string | null {
  if (points.length < 2) return null;
  return (
    line<ControlPoint>()
      .x((point) => point.x)
      .y((point) => point.y)
      .curve(curveCatmullRom.alpha(1))(points) ?? null
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
  const segmentLength = Math.hypot(dx, dy);
  if (segmentLength < 1) return `M ${fx} ${fy} L ${tx} ${ty}`;

  const normalX = -dy / segmentLength;
  const normalY = dx / segmentLength;
  const bow = clamp(segmentLength * 0.13, 14, 42);
  const bowDirection = from.index % 2 === 0 ? 1 : -1;
  const bowX = normalX * bow * bowDirection;
  const bowY = normalY * bow * bowDirection;

  const c1x = fx + dx * 0.28 + bowX;
  const c1y = fy + dy * 0.28 + bowY;
  const c2x = fx + dx * 0.72 + bowX;
  const c2y = fy + dy * 0.72 + bowY;

  return `M ${fx} ${fy} C ${c1x} ${c1y} ${c2x} ${c2y} ${tx} ${ty}`;
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
