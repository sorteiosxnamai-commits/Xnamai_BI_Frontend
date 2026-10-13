import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { ActionRule, OperationalSummary, Order, Reference, StateRef } from "../../api/schemas";
import { Pill, type PillTone } from "../../components/Pill";
import { formatDay, formatInstant, formatMoney } from "../../format";

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

/** Valor desconhecido (pedido incompleto) nunca vira R$ 0,00; zero real continua sendo zero. */
export function OrderAmount({ value, unknown }: { value: string | null | undefined; unknown?: boolean }) {
  if (unknown) {
    return (
      <span className="erp-amount-unknown" title="Pedido incompleto: o valor ainda não foi sincronizado. Isto não é R$ 0,00.">
        —<small className="erp-muted"> dados incompletos</small>
      </span>
    );
  }
  return <>{formatMoney(value)}</>;
}

/** Três datas diferentes: do pedido, da última alteração no Mercos e da gravação no ERP. */
export function DatesCell({ order }: { order: Order }) {
  const action = order.operational?.lastHumanAction;
  return (
    <div className="erp-datestack">
      <span title="Data do pedido (emissão no Mercos)">Pedido: {order.issueDate ? formatDay(order.issueDate) : formatInstant(order.issuedAt)}</span>
      <small className="erp-muted" title="Cursor de alteração: quando o Mercos alterou o pedido pela última vez">
        Alterado no Mercos: {formatInstant(order.sourceUpdatedAt)}
      </small>
      <small className="erp-muted" title="Quando o ERP gravou esta versão">
        Sincronizado: {formatInstant(order.capturedAt)}
      </small>
      {action && <small className="erp-muted">Ação no ERP: {formatInstant(action.at)} por {action.operator}</small>}
    </div>
  );
}

const SHORT_REASON: Record<string, string> = {
  order_cancelled: "Pedido cancelado",
  items_incomplete: "Itens ainda não sincronizados",
  order_total_unavailable: "Valor do pedido desconhecido",
  customer_required: "Pedido sem cliente",
};

/** Ação local bloqueada fica visível, desabilitada e com o motivo (o backend recusa pela mesma regra). */
export function ActionLink({
  rule,
  to,
  children,
  menu,
  onClick,
}: {
  rule?: ActionRule | null;
  to: string;
  children: ReactNode;
  menu?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}) {
  if (rule && !rule.allowed) {
    const short = (rule.code && SHORT_REASON[rule.code]) || rule.reason || "Indisponível";
    return (
      <span
        className="erp-action-disabled"
        role={menu ? "menuitem" : undefined}
        aria-disabled="true"
        title={rule.reason ?? undefined}
      >
        {children}
        <small className="erp-muted"> · indisponível: {short}</small>
      </span>
    );
  }
  return (
    <Link role={menu ? "menuitem" : undefined} to={to} onClick={onClick}>
      {children}
    </Link>
  );
}

/** Referência de cadastro: nome quando existe; senão "Cadastro não disponível" com o ID só como dado técnico. */
export function ReferenceValue({ reference, fallbackId }: { reference?: Reference; fallbackId?: string | null }) {
  if (!reference) return <>{fallbackId ?? "—"}</>;
  if (reference.state === "absent") return <>—</>;
  if (reference.state === "resolved") {
    return (
      <>
        {reference.name}
        <small className="erp-muted"> · ID {reference.id}</small>
      </>
    );
  }
  return (
    <>
      <span title={reference.reason ?? undefined}>Cadastro não disponível</span>
      <small className="erp-muted">
        {" "}
        · ID técnico {reference.id}
        {reference.reason ? ` — ${reference.reason}` : ""}
      </small>
    </>
  );
}

const KIND_LABELS: [string, string, string][] = [
  ["order", "pedido", "pedidos"],
  ["quote", "orçamento", "orçamentos"],
  ["cancelled", "cancelado", "cancelados"],
];

/** "3.484 pedidos · 1.020 orçamentos · 576 cancelados" a partir do resumo. */
export function kindComposition(summary: OperationalSummary): string {
  const parts = KIND_LABELS.flatMap(([kind, one, many]) => {
    const count = summary.values.byKind?.[kind]?.count ?? summary.orders.byKind[kind] ?? 0;
    return count ? [`${count.toLocaleString("pt-BR")} ${count === 1 ? one : many}`] : [];
  });
  return parts.join(" · ");
}

/** Linha única com as três datas do filtro, mais o ponto da carga (quando em andamento). */
export function DatesNote({ summary }: { summary: OperationalSummary }) {
  const d = summary.dates;
  if (!d) return null;
  const range =
    d.orderDate.min && d.orderDate.max ? `${formatDay(d.orderDate.min)} a ${formatDay(d.orderDate.max)}` : "—";
  return (
    <p className="erp-muted erp-dates-note">
      Data do pedido: {range} · última alteração no Mercos: {formatInstant(d.sourceUpdatedAtMax)} · última gravação no
      ERP: {formatInstant(d.capturedAtMax)}
      {!summary.coverage.complete && ` · carga de pedidos ${d.checkpoint.status === "running" ? "em andamento" : "incompleta"}, cursor de alteração em ${formatInstant(d.checkpoint.dataThrough)}`}
    </p>
  );
}
