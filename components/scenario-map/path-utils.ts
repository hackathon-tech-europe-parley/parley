import { match } from "ts-pattern";
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

export const NODE_SPACING = 140;
export const NODE_SPACING_MOBILE = 120;
export const AMPLITUDE = 25;
export const AMPLITUDE_MOBILE = 18;
export const TOP_PADDING = 40;

export function computeNodePositions(
  count: number,
  isMobile: boolean,
): NodePosition[] {
  const spacing = isMobile ? NODE_SPACING_MOBILE : NODE_SPACING;
  const amp = isMobile ? AMPLITUDE_MOBILE : AMPLITUDE;
  const positions: NodePosition[] = [];
  for (let i = 0; i < count; i++) {
    positions.push({
      index: i,
      x: 50 + Math.sin(i * (Math.PI / 2.5)) * amp,
      y: TOP_PADDING + i * spacing,
    });
  }
  return positions;
}

export function computeTotalHeight(count: number, isMobile: boolean): number {
  const spacing = isMobile ? NODE_SPACING_MOBILE : NODE_SPACING;
  return TOP_PADDING + (count - 1) * spacing + 80;
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

    const status = match({ beginnerCompleted, nextAllLocked })
      .with({ beginnerCompleted: true }, () => "completed" as const)
      .with({ nextAllLocked: false }, () => "active" as const)
      .otherwise(() => "locked" as const);

    segments.push({ from: positions[i], to: positions[i + 1], status });
  }
  return segments;
}
