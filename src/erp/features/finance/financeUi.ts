export const FINANCE_STATE: Record<string, { tone: "ok" | "warn" | "info" | "neutral"; label: string }> = {
  none: { tone: "neutral", label: "Sem título" },
  open: { tone: "warn", label: "Em aberto" },
  partial: { tone: "info", label: "Pago parcialmente" },
  paid: { tone: "ok", label: "Pago" },
  unavailable: { tone: "neutral", label: "Indisponível" },
};
