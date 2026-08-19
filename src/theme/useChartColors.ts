import { useMemo } from "react";
import { useAppearance } from "./AppearanceProvider";

function cssVar(name: string, fallback: string) {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function readChartColors() {
  const accent = cssVar("--chart-1", "#635bdf");
  const positive = cssVar("--chart-2", "#3db68a");
  const blue = cssVar("--chart-3", "#438acb");
  const warning = cssVar("--chart-4", "#e9a23b");
  const negative = cssVar("--chart-5", "#d05261");
  const purple = cssVar("--chart-6", "#8a63d2");
  const muted = cssVar("--chart-muted", "#9ca3af");
  const grid = cssVar("--border", "#e5e8ef");
  const tick = cssVar("--text-muted", "#747d90");
  const tooltipBg = cssVar("--bg-elevated", "#fff");
  const tooltipBorder = cssVar("--border", "#e2e5ed");
  const tooltipText = cssVar("--text", "#202739");
  return {
    accent,
    positive,
    blue,
    warning,
    negative,
    purple,
    muted,
    grid,
    tick,
    series: [accent, positive, warning, negative, blue, purple],
    axis: { fill: tick, fontSize: 11 },
    tooltip: {
      backgroundColor: tooltipBg,
      border: `1px solid ${tooltipBorder}`,
      borderRadius: 8,
      color: tooltipText,
    },
  };
}

export function useChartColors() {
  const { resolved } = useAppearance();
  return useMemo(() => readChartColors(), [resolved]);
}
