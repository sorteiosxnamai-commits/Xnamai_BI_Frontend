import { Link, useNavigate } from "react-router-dom";
import type { ZodType } from "zod";
import { buildQuery } from "../../api/client";
import { useErpQuery } from "../../api/hooks";
import { type OperationalSummary, type Order, operationalSummarySchema, orderSchema, type Page, pageOf } from "../../api/schemas";
import { Icon } from "../../components/icons";
import { type Column, ServerList } from "../../components/ServerList";
import { formatMoney } from "../../format";
import { useScope } from "../../scope";
import { StatePill, shippingSpec } from "../orders/orderUi";

const schema = pageOf(orderSchema) as unknown as ZodType<Page<Order>>;

const STATES = [
  { value: "", label: "Todos" },
  { value: "none", label: "Não cotado" },
  { value: "draft", label: "Em cotação" },
  { value: "selected", label: "Frete selecionado" },
  { value: "stale", label: "Cotação desatualizada" },
];

const COLUMNS: Column<Order>[] = [
  { key: "number", header: "Pedido", sortKey: "number", render: (o) => <strong>#{o.number ?? o.id}</strong> },
  { key: "customer", header: "Cliente", render: (o) => o.operational?.customerName ?? o.customerName ?? "—" },
  { key: "state", header: "Frete", render: (o) => <StatePill spec={shippingSpec(o.operational?.shipping)} title={o.operational?.shipping.reason} /> },
  { key: "carrier", header: "Transportadora · serviço", render: (o) => o.operational?.shipping.label ?? "—" },
  { key: "price", header: "Valor do frete", render: (o) => formatMoney(o.operational?.shipping.price) },
  { key: "deadline", header: "Prazo", render: (o) => o.operational?.shipping.deadline ?? "—" },
  {
    key: "actions",
    header: "Ações",
    render: (o) => (
      <Link to={`/erp/frete/pedidos/${encodeURIComponent(o.id)}/cotacao`} onClick={(event) => event.stopPropagation()}>
        Abrir cotação
      </Link>
    ),
  },
];

export function ShippingPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const state = scope.params.get("shipping") ?? "";
  const filters: Record<string, string | undefined> = {
    search: scope.search || undefined,
    dateFrom: scope.from,
    dateTo: scope.to,
    shipping: state || undefined,
  };
  const summary = useErpQuery<OperationalSummary>(
    ["operational-summary", "shipping", filters],
    `/operational-summary${buildQuery({ ...filters, shipping: undefined })}`,
    operationalSummarySchema,
    { keepPrevious: true },
  );
  const counts = summary.data?.shipping?.available ? summary.data.shipping.counts : undefined;
  return (
    <>
      <div className="erp-pagehead">
        <div>
          <h1>Frete</h1>
          <p>Cotações locais por pedido. Selecionar uma opção não contrata o frete nem gera etiqueta.</p>
        </div>
      </div>
      <section className="erp-kpis" aria-label="Pedidos por estado de frete">
        {[
          ["none", "Não cotados", "warn"],
          ["draft", "Em cotação", "info"],
          ["selected", "Frete selecionado", "ok"],
          ["stale", "Cotação desatualizada", "purple"],
        ].map(([key, title, tone]) => (
          <div className={`erp-kpi erp-kpi-${tone}`} key={key}>
            <span className="erp-kpi-title">{title}</span>
            <strong className={counts ? undefined : "erp-kpi-unavailable"}>
              {counts ? counts[key] ?? 0 : summary.isLoading ? "…" : "Indisponível"}
            </strong>
          </div>
        ))}
      </section>
      <section className="erp-filterbar" aria-label="Filtro de frete">
        <label className="erp-select-field">
          Situação do frete
          <select value={state} onChange={(e) => scope.set({ shipping: e.target.value || undefined })}>
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <span className="erp-muted">
          <Icon name="info" size={14} /> Busca e período vêm do cabeçalho.
        </span>
      </section>
      <ServerList<Order>
        resource="shipping-orders"
        path="/sales-orders"
        schema={schema}
        caption="Pedidos e frete"
        columns={COLUMNS}
        fixedParams={{ ...filters, include: "operational" }}
        defaultSort="issuedAt"
        defaultOrder="desc"
        rowKey={(o) => o.id}
        onRowOpen={(o) => navigate(`/erp/frete/pedidos/${encodeURIComponent(o.id)}/cotacao`)}
        emptyMessage="Nenhum pedido encontrado com o filtro atual."
      />
    </>
  );
}
