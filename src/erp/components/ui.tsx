import { useCallback, useRef, type ReactNode } from "react";
import { ErpApiError } from "../api/client";
import type { Capability } from "../api/schemas";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="erp-page-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="erp-page-actions">{actions}</div>}
    </div>
  );
}

const TONES: Record<string, string> = {
  succeeded: "ok",
  success: "ok",
  allowed: "ok",
  settled: "ok",
  approved: "ok",
  received: "ok",
  active: "ok",
  failed: "bad",
  forbidden: "bad",
  denied: "bad",
  cancelled: "bad",
  conflict: "warn",
  unknown: "warn",
  waiting_rate_limit: "warn",
  partial: "warn",
  partial_quarantine: "warn",
  partially_received: "warn",
  partially_settled: "warn",
  interrupted: "warn",
  unavailable: "warn",
};

const LABELS: Record<string, string> = {
  queued: "Na fila",
  processing: "Processando",
  waiting_rate_limit: "Aguardando limite",
  succeeded: "Aceito",
  failed: "Falhou",
  unknown: "Resultado em verificação",
  conflict: "Conflito",
  never: "Nunca sincronizado",
  success: "Sincronizado",
  running: "Em execução",
  partial_quarantine: "Com pendências",
  forbidden: "Acesso negado",
  unavailable: "Indisponível na conta",
  interrupted: "Interrompido",
  draft: "Rascunho",
  approved: "Aprovado",
  partially_received: "Recebido parcialmente",
  received: "Recebido",
  cancelled: "Cancelado",
  open: "Em aberto",
  partial: "Parcial",
  partially_settled: "Parcialmente baixado",
  settled: "Baixado",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span className={`erp-badge erp-badge-${TONES[value] ?? "neutral"}`}>
      {label ?? LABELS[value] ?? value}
    </span>
  );
}

export function Dl({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="erp-dl">
      {items.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Capacidade indisponível vira aviso com motivo; nunca botão falso funcional. */
export function CapabilityNotice({ capability }: { capability: Capability | undefined }) {
  if (!capability || capability.enabled) return null;
  return (
    <div className="erp-notice" role="note">
      <strong>{capability.label}: indisponível</strong>
      <span>{capability.reason || "Capacidade desabilitada."}</span>
      <small>
        Adaptor: {capability.supportedByAdaptor ? "suporta" : "não suporta"} · Provedor:{" "}
        {capability.documentedByProvider ? "documentado" : "sem documentação confirmada"} · Conta:{" "}
        {capability.accountAccess}
      </small>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="erp-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={tab.id === value}
          className={tab.id === value ? "erp-tab active" : "erp-tab"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function FieldError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <small className="erp-field-error" role="alert">
      {message}
    </small>
  );
}

/**
 * Erro de comando. Timeout ou queda de rede num envio NÃO é "falhou": o servidor
 * pode ter recebido. Reenviar o mesmo conteúdo é seguro (mesma Idempotency-Key).
 */
export function CommandError({ error, local }: { error?: Error | null; local?: string | null }) {
  if (local) return <FieldError message={local} />;
  if (!error) return null;
  if (error instanceof ErpApiError && (error.code === "timeout" || error.code === "network")) {
    return (
      <div className="erp-notice" role="alert">
        <strong>Resultado em verificação</strong>
        <span>
          A conexão expirou antes da resposta; não sabemos se o servidor recebeu. Os dados foram
          preservados. Reenviar o mesmo conteúdo é seguro: a chave de idempotência é a mesma e o
          servidor não duplica.
        </span>
      </div>
    );
  }
  return <FieldError message={error.message} />;
}

/** Acessibilidade: após validar, o foco vai para o primeiro campo com erro. */
export function useFocusInvalid() {
  const ref = useRef<HTMLFormElement>(null);
  const focus = useCallback(() => {
    window.setTimeout(() => {
      ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
    }, 0);
  }, []);
  return { ref, focus };
}
