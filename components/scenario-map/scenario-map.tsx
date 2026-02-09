"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ScenarioNodeState } from "@/core/progress";
import type { ScenarioDef } from "../setup-form.constants";
import { MapPath } from "./map-path";
import {
  classifySegments,
  computeNodePositions,
  computeTotalHeight,
  type MapLayout,
} from "./path-utils";
import { ScenarioNode } from "./scenario-node";

interface ScenarioMapProps {
  scenarios: ScenarioDef[];
  nodeStates: Map<string, ScenarioNodeState>;
  onSelectScenario: (scenario: ScenarioDef) => void;
}

export function ScenarioMap({
  scenarios,
  nodeStates,
  onSelectScenario,
}: ScenarioMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout: MapLayout =
    containerWidth > 0 && containerWidth < 700 ? "mobile" : "desktop";

  const positions = useMemo(
    () => computeNodePositions(scenarios.length, layout),
    [scenarios.length, layout],
  );

  const totalHeight = useMemo(
    () => computeTotalHeight(scenarios.length, layout),
    [scenarios.length, layout],
  );

  const scenarioKeys = useMemo(() => scenarios.map((s) => s.key), [scenarios]);

  const segments = useMemo(
    () => classifySegments(positions, nodeStates, scenarioKeys),
    [positions, nodeStates, scenarioKeys],
  );

  // First scenario that is unlocked but hasn't completed beginner
  const nextAvailableIndex = useMemo(() => {
    for (let i = 0; i < scenarios.length; i++) {
      const state = nodeStates.get(scenarios[i].key);
      if (!state) continue;
      const allLocked = state.levels.every((l) => l.status === "locked");
      if (allLocked) continue;
      const beginnerCompleted = state.levels.some(
        (l) => l.level === "beginner" && l.status === "completed",
      );
      if (!beginnerCompleted) return i;
    }
    return -1;
  }, [scenarios, nodeStates]);

  return (
    <div className="flex flex-col items-center">
      <div
        ref={containerRef}
        className="relative mx-auto w-full"
        style={{ height: totalHeight }}
      >
        {containerWidth > 0 && (
          <MapPath
            segments={segments}
            containerWidth={containerWidth}
            totalHeight={totalHeight}
          />
        )}
        {scenarios.map((scenario, i) => {
          const state = nodeStates.get(scenario.key);
          if (!state) return null;
          return (
            <ScenarioNode
              key={scenario.key}
              scenario={scenario}
              nodeState={state}
              position={positions[i]}
              isNextAvailable={i === nextAvailableIndex}
              index={i}
              onClick={() => onSelectScenario(scenario)}
            />
          );
        })}
      </div>
    </div>
  );
}
