"use client";

import { motion } from "motion/react";
import { buildSvgPath, type PathSegment } from "./path-utils";

interface MapPathProps {
  segments: PathSegment[];
  containerWidth: number;
  totalHeight: number;
}

export function MapPath({
  segments,
  containerWidth,
  totalHeight,
}: MapPathProps) {
  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={containerWidth}
      height={totalHeight}
      viewBox={`0 0 ${containerWidth} ${totalHeight}`}
    >
      <title>Map connections</title>

      {/* Background: all segments as dashed gray lines */}
      {segments.map((seg) => {
        const d = buildSvgPath(seg.from, seg.to, containerWidth);
        return (
          <path
            key={`bg-${seg.from.index}`}
            d={d}
            stroke="rgb(51 65 85 / 0.3)"
            strokeWidth={2}
            strokeDasharray="8 6"
            strokeLinecap="round"
            fill="none"
          />
        );
      })}

      {/* Foreground: completed (emerald) and active (blue) with draw animation */}
      {segments.map((seg, segIndex) => {
        if (seg.status === "locked") return null;
        const d = buildSvgPath(seg.from, seg.to, containerWidth);
        const color =
          seg.status === "completed" ? "rgb(16 185 129)" : "rgb(59 130 246)";
        return (
          <motion.path
            key={`fg-${seg.from.index}`}
            d={d}
            stroke={color}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{
              duration: 0.8,
              ease: "easeOut",
              delay: segIndex * 0.15,
            }}
          />
        );
      })}
    </svg>
  );
}
