import type { StateRef } from "../../api/schemas";
import { Pill, type PillTone } from "../../components/Pill";

type PillSpec = { tone: PillTone; label: string };

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** Estado de frete local: `unavailable` = sem fonte; `none` = nenhuma cotação registrada. */
export function shippingSpec(ref?: StateRef): PillSpec {
  switch (ref?.state) {
    case "none":
      return { tone: "warn", label: "Não cotado" };
    case "draft":
      return { tone: "info", label: "Em cotação" };
    case "selected":
      return { tone: "ok", label: "Frete selecionado" };
    case "stale":
      return { tone: "warn", label: "Cotação desatualizada" };
    default:
      return { tone: "neutral", label: "Indisponível" };
  }
}

/** Nota fiscal: só rascunho local existe; nunca "Emitida" sem emissor real. */
export function invoiceSpec(ref?: StateRef): PillSpec {
  switch (ref?.state) {
    case "none":
      return { tone: "neutral", label: "Sem rascunho" };
    case "draft":
      return { tone: "info", label: "Rascunho" };
    case "stale":
      return { tone: "warn", label: "Revisar rascunho" };
    default:
      return { tone: "neutral", label: "Indisponível" };
  }
}

const PAID = new Set(["paid", "pago", "settled", "approved", "received"]);
const WAITING = new Set(["pending", "pendente", "waiting", "aguardando", "open"]);

export function paymentSpec(ref?: StateRef): PillSpec {
  const state = ref?.state ?? "unknown";
  if (state === "unknown" || state === "unavailable") return { tone: "neutral", label: "Sem dados" };
  const key = state.toLowerCase();
  if (PAID.has(key)) return { tone: "ok", label: "Pago" };
  if (WAITING.has(key)) return { tone: "warn", label: "Aguardando pagamento" };
  return { tone: "neutral", label: capitalize(state) };
}

export function StatePill({ spec, title }: { spec: PillSpec; title?: string | null }) {
  return (
    <Pill tone={spec.tone} title={title ?? undefined}>
      {spec.label}
    </Pill>
  );
}

/** Pix desconhecido não é "pendente" nem "gerado": sem provedor, mostra traço com explicação. */
export function PixCell({ pix }: { pix?: StateRef }) {
  if (!pix || pix.state === "unknown" || pix.state === "unavailable") {
    return (
      <span className="erp-muted" title={pix?.reason ?? "Sem provedor de Pix configurado"}>
        —
      </span>
    );
  }
  return <Pill tone="info">{capitalize(pix.state)}</Pill>;
}

export const PENDENCY_TONE: Record<string, PillTone> = {
  items_incomplete: "warn",
  customer_missing: "warn",
};
