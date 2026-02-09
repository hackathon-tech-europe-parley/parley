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
        const d = buildSvgPath(seg, containerWidth);
        const backgroundStroke =
          seg.status === "locked"
            ? "rgb(51 65 85 / 0.18)"
            : seg.status === "active"
              ? "rgb(51 65 85 / 0.24)"
              : "rgb(51 65 85 / 0.3)";
        return (
          <path
            key={`bg-${seg.from.index}`}
            d={d}
            stroke={backgroundStroke}
            strokeWidth={2}
            strokeDasharray={seg.status === "locked" ? "7 7" : "8 6"}
            strokeLinecap="round"
            fill="none"
          />
        );
      })}

      {/* Active path glow for stronger focus on the next progression route */}
      {segments.map((seg, segIndex) => {
        if (seg.status !== "active") return null;
        const d = buildSvgPath(seg, containerWidth);
        return (
          <motion.path
            key={`glow-${seg.from.index}`}
            d={d}
            stroke="rgb(59 130 246 / 0.3)"
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            animate={{
              opacity: [0.2, 0.35, 0.2],
              strokeWidth: [9, 10.5, 9],
            }}
            transition={{
              duration: 2.4,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
              delay: segIndex * 0.08,
            }}
          />
        );
      })}

      {/* Foreground: completed (emerald) and active (blue) with draw animation */}
      {segments.map((seg, segIndex) => {
        if (seg.status === "locked") return null;
        const d = buildSvgPath(seg, containerWidth);
        const color =
          seg.status === "completed" ? "rgb(16 185 129)" : "rgb(59 130 246)";
        const strokeWidth = seg.status === "active" ? 4 : 3;
        return (
          <motion.path
            key={`fg-${seg.from.index}`}
            d={d}
            stroke={color}
            strokeWidth={strokeWidth}
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
