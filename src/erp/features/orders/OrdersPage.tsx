import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { ZodType } from "zod";
import { buildQuery } from "../../api/client";
import { useErpQuery } from "../../api/hooks";
import {
  type OperationalSummary,
  type Order,
  operationalSummarySchema,
  orderSchema,
  type Page,
  pageOf,
} from "../../api/schemas";
import { useErp } from "../../auth/context";
import { Icon } from "../../components/icons";
import { OrderPicker } from "../../components/OrderPicker";
import { Pill } from "../../components/Pill";
import { type Column, ServerList } from "../../components/ServerList";
import { StatePanel } from "../../components/StatePanel";
import { CapabilityNotice } from "../../components/ui";
import { formatInstant } from "../../format";
import { useScope } from "../../scope";
import { invoiceSpec, PixCell, paymentSpec, StatePill, shippingSpec } from "./orderUi";

const schema = pageOf(orderSchema) as unknown as ZodType<Page<Order>>;

/** Estados Mercos continuam separados; este componente segue usado no detalhe do pedido. */
export function StatusChips({ order }: { order: Pick<Order, "statuses" | "kind"> }) {
  const s = order.statuses;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      <span className="erp-badge" title="Status comercial (origem)">Comercial: {s.commercial ?? "—"}</span>
      <span className="erp-badge" title="Faturamento">Faturamento: {s.billing ?? "—"}</span>
      <span className="erp-badge" title="Atendimento/expedição (ERP)">Atendimento: {s.fulfillment ?? "—"}</span>
      <span className="erp-badge" title="Pagamento">Pagamento: {s.payment ?? "—"}</span>
    </div>
  );
}

const KIND_OPTIONS = [
  { value: "order", label: "Pedidos" },
  { value: "quote", label: "Orçamentos" },
  { value: "cancelled", label: "Cancelados" },
];

const FILTER_KEYS = ["kind", "paymentStatus", "pending", "shipping", "fiscal", "customerId"] as const;

function RowMenu({ order }: { order: Order }) {
  const { can } = useErp();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  const enc = encodeURIComponent(order.id);
  return (
    <div className="erp-row-menu" ref={root}>
      <button
        type="button"
        className="erp-icon-button"
        aria-label={`Ações do pedido ${order.number ?? order.id}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <Icon name="dots" />
      </button>
      {open && (
        <div
          className="erp-row-menu-list"
          id={id}
          role="menu"
          tabIndex={-1}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Link role="menuitem" to={`/erp/pedidos/${enc}`}>
            Abrir pedido
          </Link>
          {can("shipping:read") && (
            <Link role="menuitem" to={`/erp/frete/pedidos/${enc}/cotacao`}>
              Cotação de frete
            </Link>
          )}
          {can("invoices:read") && (
            <Link role="menuitem" to={`/erp/notas-fiscais/pedidos/${enc}/montagem`}>
              Montagem da nota fiscal
            </Link>
          )}
          {can("finance:read") && (
            <Link role="menuitem" to={`/erp/financeiro/pedidos/${enc}`}>
              Ver no financeiro
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const COLUMNS: Column<Order>[] = [
  {
    key: "number",
    header: "Pedido",
    sortKey: "number",
    render: (o) => (
      <div className="erp-updated">
        <strong>#{o.number ?? o.id}</strong>
        <small className="erp-muted">
          Mercos: {o.statuses.commercial ?? "—"}
          {o.kind !== "order" && ` · ${o.operational?.state.label ?? o.kind}`}
        </small>
      </div>
    ),
  },
  { key: "customer", header: "Cliente", render: (o) => o.operational?.customerName ?? o.customerName ?? o.customerId ?? "—" },
  {
    key: "items",
    header: "Itens",
    render: (o) =>
      o.itemsComplete ? (
        <span title={o.operational?.itemsPreview.map((i) => i.name).filter(Boolean).join(", ") || undefined}>
          {o.itemCount ?? 0} {o.itemCount === 1 ? "item" : "itens"}
        </span>
      ) : (
        <Pill tone="warn" title="Itens ainda não sincronizados">
          Incompleto
        </Pill>
      ),
  },
  { key: "shipping", header: "Frete", render: (o) => <StatePill spec={shippingSpec(o.operational?.shipping)} title={o.operational?.shipping.reason} /> },
  { key: "invoice", header: "Nota fiscal", render: (o) => <StatePill spec={invoiceSpec(o.operational?.invoice)} title={o.operational?.invoice.reason} /> },
  { key: "payment", header: "Pagamento", render: (o) => <StatePill spec={paymentSpec(o.operational?.payment)} title="Estado espelhado do Mercos" /> },
  { key: "pix", header: "Pix", render: (o) => <PixCell pix={o.operational?.pix} /> },
  {
    key: "updated",
    header: "Última atualização",
    sortKey: "issuedAt",
    render: (o) => {
      const action = o.operational?.lastHumanAction;
      return (
        <div className="erp-updated">
          <span>{formatInstant(action?.at ?? o.operational?.lastExternalUpdateAt ?? o.issuedAt)}</span>
          <small className="erp-muted">{action ? `por ${action.operator}` : "sincronizado do Mercos"}</small>
        </div>
      );
    },
  },
  {
    key: "pendencies",
    header: "Pendências",
    render: (o) =>
      o.operational && o.operational.pendencies.length > 0 ? (
        <div className="erp-pill-row">
          {o.operational.pendencies.map((p) => (
            <Pill key={p.code} tone="warn" title={p.label}>
              {p.code === "items_incomplete" ? "Itens" : p.code === "customer_missing" ? "Cliente" : p.label}
            </Pill>
          ))}
        </div>
      ) : (
        <span className="erp-muted">—</span>
      ),
  },
  { key: "actions", header: "Ações", render: (o) => <RowMenu order={o} /> },
];

function Metric({
  title,
  value,
  note,
  tone = "neutral",
  unavailable,
}: {
  title: string;
  value: string;
  note?: string | null;
  tone?: "neutral" | "ok" | "info" | "warn" | "purple";
  unavailable?: boolean;
}) {
  return (
    <div className={`erp-kpi erp-kpi-${tone}`}>
      <span className="erp-kpi-title">{title}</span>
      <strong className={unavailable ? "erp-kpi-unavailable" : undefined}>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function variationNote(summary: OperationalSummary): string {
  const v = summary.variation;
  if (!v.available) return `Variação indisponível: ${v.reason ?? "sem base de comparação"}`;
  const percent = Number(v.percent);
  const sign = percent > 0 ? "+" : "";
  return `${sign}${v.percent?.replace(".", ",")}% vs. período anterior`;
}

function sectionCard(
  title: string,
  section: OperationalSummary["shipping"],
  key: string,
  fallback: string,
): { title: string; value: string; note: string; unavailable: boolean } {
  if (!section?.available) {
    return { title, value: "Indisponível", note: section?.reason ?? fallback, unavailable: true };
  }
  return { title, value: String(section.counts?.[key] ?? 0), note: "no filtro atual", unavailable: false };
}

export function OrdersPage() {
  const navigate = useNavigate();
  const { can, capability } = useErp();
  const scope = useScope();
  const [picker, setPicker] = useState<null | "shipping" | "invoice" | "update">(null);
  const get = (key: string) => scope.params.get(key) ?? undefined;
  const filters: Record<string, string | undefined> = {
    search: scope.search || undefined,
    dateFrom: scope.from,
    dateTo: scope.to,
    kind: get("kind"),
    paymentStatus: get("paymentStatus"),
    pending: get("pending"),
    shipping: get("shipping"),
    fiscal: get("fiscal"),
    customerId: get("customerId"),
  };
  const summary = useErpQuery<OperationalSummary>(
    ["operational-summary", filters],
    `/operational-summary${buildQuery(filters)}`,
    operationalSummarySchema,
    { keepPrevious: true },
  );
  const [searchText, setSearchText] = useState(scope.search);
  useEffect(() => setSearchText(scope.search), [scope.search]);
  useEffect(() => {
    if (searchText.trim() === scope.search) return;
    const timer = window.setTimeout(() => scope.set({ search: searchText.trim() || undefined }), 350);
    return () => window.clearTimeout(timer);
  }, [searchText, scope]);

  const cap = capability("write.orders");
  const canWrite = can("orders:write") && Boolean(cap?.enabled);
  const available = new Set(summary.data?.filtersAvailable ?? []);
  const anyFilter = Boolean(scope.search) || FILTER_KEYS.some((key) => scope.params.has(key));
  const s = summary.data;
  const shipping = sectionCard("Em cotação de frete", s?.shipping, "draft", "Sem fonte de frete nesta base");
  const invoice = sectionCard("Notas em montagem", s?.invoice, "draft", "Sem fonte fiscal nesta base");

  return (
    <>
      <div className="erp-pagehead">
        <div>
          <h1>Pedidos</h1>
          <p>Área interna para acompanhar pedidos, frete, notas fiscais e atualizações.</p>
        </div>
        <div className="erp-pagehead-actions">
          {can("shipping:write") && (
            <button type="button" className="erp-btn erp-btn-primary" onClick={() => setPicker("shipping")}>
              <Icon name="truck" /> Nova cotação de frete
            </button>
          )}
          {can("invoices:write") && (
            <button type="button" className="erp-btn" onClick={() => setPicker("invoice")}>
              <Icon name="invoice" /> Montar nota fiscal
            </button>
          )}
          <button type="button" className="erp-btn" onClick={() => setPicker("update")}>
            <Icon name="edit" /> Atualizar pedido
          </button>
          {canWrite && (
            <Link className="erp-btn" to="/erp/pedidos/novo">
              <Icon name="plus" /> Novo pedido
            </Link>
          )}
        </div>
      </div>
      {can("orders:write") && <CapabilityNotice capability={cap} />}
      {s && !s.coverage.complete && (
        <div className="erp-notice" role="status">
          <strong>Dados parcialmente sincronizados</strong>
          <span>{s.coverage.note}</span>
        </div>
      )}
      {summary.error && !s && (
        <StatePanel
          kind="error"
          title="Indicadores indisponíveis"
          message={(summary.error as Error).message}
          onRetry={() => void summary.refetch()}
        />
      )}
      <section className="erp-kpis" aria-label="Indicadores do filtro atual">
        <Metric
          title="Pedidos no filtro"
          value={s ? String(s.orders.count) : summary.isLoading ? "…" : "Indisponível"}
          note={s ? variationNote(s) : undefined}
          tone="ok"
          unavailable={!s && !summary.isLoading}
        />
        <Metric title={shipping.title} value={shipping.value} note={shipping.note} tone="info" unavailable={shipping.unavailable} />
        <Metric title={invoice.title} value={invoice.value} note={invoice.note} tone="warn" unavailable={invoice.unavailable} />
        <Metric
          title="Atualizações pendentes"
          value={s ? String(s.pendencies.any) : summary.isLoading ? "…" : "Indisponível"}
          note={s ? `${s.pendencies.itemsIncomplete} sem itens · ${s.pendencies.customerMissing} sem cliente` : undefined}
          tone="purple"
          unavailable={!s && !summary.isLoading}
        />
      </section>
      <section className="erp-filterbar" aria-label="Filtros de pedidos">
        <label className="erp-search-field">
          <Icon name="search" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Buscar por nº do pedido, cliente ou produto…"
            aria-label="Buscar por número do pedido, cliente ou produto"
          />
        </label>
        <label className="erp-select-field">
          Status
          <select value={get("kind") ?? ""} onChange={(e) => scope.set({ kind: e.target.value || undefined })}>
            <option value="">Todos</option>
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="erp-select-field">
          Pendências
          <select value={get("pending") ?? ""} onChange={(e) => scope.set({ pending: e.target.value || undefined })}>
            <option value="">Todas</option>
            <option value="true">Com pendências</option>
            <option value="false">Sem pendências</option>
          </select>
        </label>
        {s && Object.keys(s.payment.byStatus).some((k) => k !== "unknown") && (
          <label className="erp-select-field">
            Pagamento
            <select value={get("paymentStatus") ?? ""} onChange={(e) => scope.set({ paymentStatus: e.target.value || undefined })}>
              <option value="">Todos</option>
              {Object.keys(s.payment.byStatus)
                .filter((k) => k !== "unknown")
                .map((k) => (
                  <option key={k} value={k}>
                    {paymentSpec({ state: k }).label}
                  </option>
                ))}
            </select>
          </label>
        )}
        {available.has("shipping") && (
          <label className="erp-select-field">
            Frete
            <select value={get("shipping") ?? ""} onChange={(e) => scope.set({ shipping: e.target.value || undefined })}>
              <option value="">Todos</option>
              <option value="none">Não cotado</option>
              <option value="draft">Em cotação</option>
              <option value="selected">Frete selecionado</option>
              <option value="stale">Cotação desatualizada</option>
            </select>
          </label>
        )}
        {available.has("fiscal") && (
          <label className="erp-select-field">
            Nota fiscal
            <select value={get("fiscal") ?? ""} onChange={(e) => scope.set({ fiscal: e.target.value || undefined })}>
              <option value="">Todas</option>
              <option value="none">Sem rascunho</option>
              <option value="draft">Rascunho</option>
              <option value="stale">Revisar rascunho</option>
            </select>
          </label>
        )}
        {anyFilter && (
          <button
            type="button"
            className="erp-link-button"
            onClick={() => scope.set({ search: undefined, kind: undefined, paymentStatus: undefined, pending: undefined, shipping: undefined, fiscal: undefined, customerId: undefined })}
          >
            Limpar filtros
          </button>
        )}
      </section>
      {get("customerId") && (
        <div className="erp-notice">
          <strong>Filtrando pelo cliente {get("customerId")}</strong>
          <button type="button" className="erp-link-button" onClick={() => scope.set({ customerId: undefined })}>
            Limpar filtro
          </button>
        </div>
      )}
      <ServerList<Order>
        resource="orders"
        path="/sales-orders"
        schema={schema}
        caption="Pedidos"
        columns={COLUMNS}
        fixedParams={{ ...filters, include: "operational" }}
        defaultSort="issuedAt"
        defaultOrder="desc"
        rowKey={(o) => o.id}
        onRowOpen={(o) => navigate(`/erp/pedidos/${encodeURIComponent(o.id)}`)}
        emptyMessage={
          anyFilter || scope.from || scope.to
            ? "Nenhum pedido encontrado com a busca, o período e os filtros atuais."
            : "Nenhum pedido no espelho. Se a sincronização ainda não rodou, veja Configurações › Integrações."
        }
      />
      {picker && (
        <OrderPicker
          title={
            picker === "shipping"
              ? "Nova cotação de frete"
              : picker === "invoice"
                ? "Montar nota fiscal"
                : "Atualizar pedido"
          }
          target={(order) => {
            const enc = encodeURIComponent(order.id);
            if (picker === "shipping") return `/erp/frete/pedidos/${enc}/cotacao`;
            if (picker === "invoice") return `/erp/notas-fiscais/pedidos/${enc}/montagem`;
            return `/erp/pedidos/${enc}`;
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}
