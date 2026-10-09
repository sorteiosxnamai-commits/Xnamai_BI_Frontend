import type { ReactNode } from "react";

export type PillTone = "ok" | "info" | "warn" | "bad" | "neutral" | "purple";

/** Chip de estado. O rótulo sempre é texto (não depende só de cor) para leitura e acessibilidade. */
export function Pill({ tone = "neutral", children, title }: { tone?: PillTone; children: ReactNode; title?: string }) {
  return (
    <span className={`erp-pill erp-pill-${tone}`} title={title}>
      {children}
    </span>
  );
}
