import { Link, useNavigate } from "react-router-dom";
import type { ZodType } from "zod";
import { buildQuery } from "../../api/client";
import { useErpQuery } from "../../api/hooks";
import { type OperationalSummary, type Order, operationalSummarySchema, orderSchema, type Page, pageOf } from "../../api/schemas";
import { type Column, ServerList } from "../../components/ServerList";
import { formatMoney } from "../../format";
import { useScope } from "../../scope";
import { invoiceSpec, StatePill } from "../orders/orderUi";

const schema = pageOf(orderSchema) as unknown as ZodType<Page<Order>>;

const STATES = [
  { value: "", label: "Todos" },
  { value: "none", label: "Sem rascunho" },
  { value: "draft", label: "Rascunho" },
  { value: "stale", label: "Revisar rascunho" },
];

const COLUMNS: Column<Order>[] = [
  { key: "number", header: "Pedido", sortKey: "number", render: (o) => <strong>#{o.number ?? o.id}</strong> },
  { key: "customer", header: "Cliente", render: (o) => o.operational?.customerName ?? o.customerName ?? "—" },
  { key: "total", header: "Valor do pedido", sortKey: "netTotal", render: (o) => formatMoney(o.netTotal) },
  { key: "invoice", header: "Nota fiscal", render: (o) => <StatePill spec={invoiceSpec(o.operational?.invoice)} title={o.operational?.invoice.reason} /> },
  {
    key: "actions",
    header: "Ações",
    render: (o) => (
      <Link to={`/erp/notas-fiscais/pedidos/${encodeURIComponent(o.id)}/montagem`} onClick={(event) => event.stopPropagation()}>
        Abrir montagem
      </Link>
    ),
  },
];

export function InvoiceListPage() {
  const navigate = useNavigate();
  const scope = useScope();
  const state = scope.params.get("fiscal") ?? "";
  const filters: Record<string, string | undefined> = {
    search: scope.search || undefined,
    dateFrom: scope.from,
    dateTo: scope.to,
    fiscal: state || undefined,
  };
  const summary = useErpQuery<OperationalSummary>(
    ["operational-summary", "invoice", filters],
    `/operational-summary${buildQuery({ ...filters, fiscal: undefined })}`,
    operationalSummarySchema,
    { keepPrevious: true },
  );
  const section = summary.data?.invoice;
  const counts = section?.available ? section.counts : undefined;
  return (
    <>
      <div className="erp-pagehead">
        <div>
          <h1>Nota Fiscal</h1>
          <p>Montagem fiscal por pedido. Rascunho não é nota emitida: a emissão exige emissor fiscal ainda não configurado.</p>
        </div>
      </div>
      <div className="erp-notice" role="status">
        <strong>Emissão fiscal indisponível</strong>
        <span>
          {section && "reason" in section && section.reason
            ? section.reason
            : "Nenhum emissor fiscal está configurado. Faturamento do Mercos não substitui a emissão."}
        </span>
      </div>
      <section className="erp-kpis" aria-label="Pedidos por situação do rascunho fiscal">
        {[
          ["none", "Sem rascunho", "warn"],
          ["draft", "Rascunhos", "info"],
          ["stale", "Para revisar", "purple"],
        ].map(([key, title, tone]) => (
          <div className={`erp-kpi erp-kpi-${tone}`} key={key}>
            <span className="erp-kpi-title">{title}</span>
            <strong className={counts ? undefined : "erp-kpi-unavailable"}>
              {counts ? counts[key] ?? 0 : summary.isLoading ? "…" : "Indisponível"}
            </strong>
          </div>
        ))}
      </section>
      <section className="erp-filterbar" aria-label="Filtro fiscal">
        <label className="erp-select-field">
          Situação do rascunho
          <select value={state} onChange={(e) => scope.set({ fiscal: e.target.value || undefined })}>
            {STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </section>
      <ServerList<Order>
        resource="invoice-orders"
        path="/sales-orders"
        schema={schema}
        caption="Pedidos e notas fiscais"
        columns={COLUMNS}
        fixedParams={{ ...filters, include: "operational" }}
        defaultSort="issuedAt"
        defaultOrder="desc"
        rowKey={(o) => o.id}
        onRowOpen={(o) => navigate(`/erp/notas-fiscais/pedidos/${encodeURIComponent(o.id)}/montagem`)}
        emptyMessage="Nenhum pedido encontrado com o filtro atual."
      />
    </>
  );
}
