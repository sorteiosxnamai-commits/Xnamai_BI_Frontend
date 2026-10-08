import type { ReactNode } from "react";

export type StateKind = "loading" | "error" | "empty" | "forbidden" | "unavailable";

const TITLES: Record<StateKind, string> = {
  loading: "Carregando dados…",
  error: "Falha ao carregar",
  empty: "Nada por aqui ainda",
  forbidden: "Sem permissão",
  unavailable: "Indisponível",
};

/**
 * Estados padrão das telas ERP: loading / error / empty / forbidden /
 * unavailable. "Indisponível" nunca é apresentado como zero.
 */
export function StatePanel({
  kind,
  title,
  message,
  onRetry,
  action,
}: {
  kind: StateKind;
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: ReactNode;
}) {
  return (
    <div
      className={`erp-state erp-state-${kind}`}
      role={kind === "error" || kind === "forbidden" ? "alert" : "status"}
      aria-busy={kind === "loading"}
    >
      <strong>{title ?? TITLES[kind]}</strong>
      {message && <span>{message}</span>}
      {onRetry && (
        <button type="button" className="erp-btn" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
      {action}
    </div>
  );
}
