import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/client";
import { EntityDetailDrawer } from "../components/feedback/EntityDetailDrawer";
import { ExportButtons } from "../components/tables/ExportButtons";
import { ExpandableOrderHistory } from "../components/tables/ExpandableOrderHistory";
import {
  ServerEntityTable,
  type EntityColumn,
} from "../components/tables/ServerEntityTable";
import type { AnalyticsFilters, CustomerAnalyticsRow } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const columns: EntityColumn<CustomerAnalyticsRow>[] = [
  { id: "name", label: "Cliente", render: (row) => row.name },
  { id: "city", label: "Cidade", render: (row) => row.city || "—" },
  { id: "state", label: "UF", render: (row) => row.state || "—" },
  { id: "order_count", label: "Pedidos", render: (row) => row.orderCount },
  { id: "revenue", label: "Faturamento", render: (row) => money.format(row.revenue) },
  {
    id: "average_ticket",
    label: "Ticket médio",
    render: (row) => money.format(row.averageTicket),
  },
  {
    id: "first_order_at",
    label: "Primeira compra",
    render: (row) =>
      row.firstOrderAt ? new Date(row.firstOrderAt).toLocaleDateString("pt-BR") : "—",
  },
  {
    id: "last_order_at",
    label: "Última compra",
    render: (row) =>
      row.lastOrderAt ? new Date(row.lastOrderAt).toLocaleDateString("pt-BR") : "—",
  },
  {
    id: "days_since_last_order",
    label: "Dias sem comprar",
    render: (row) => row.daysSinceLastOrder ?? "Nunca comprou",
  },
  {
    id: "average_interval",
    label: "Intervalo médio",
    sortable: false,
    render: (row) =>
      row.averageOrderIntervalDays == null
        ? "—"
        : `${row.averageOrderIntervalDays.toLocaleString("pt-BR", {
            maximumFractionDigits: 0,
          })} dias`,
  },
  { id: "recency", label: "R", render: (row) => row.rfm.recency },
  { id: "frequency", label: "F", render: (row) => row.rfm.frequency },
  { id: "monetary", label: "M", render: (row) => row.rfm.monetary },
  {
    id: "rfm_segment",
    label: "Segmento RFM",
    sortable: false,
    render: (row) => row.rfm.segment,
  },
  { id: "abc", label: "ABC", sortable: false, render: (row) => row.abcClass || "—" },
];

export function CustomersPage({ filters }: { filters: AnalyticsFilters }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["analytics", "customer-detail", selectedId, filters],
    queryFn: () => analyticsApi.customerDetail(selectedId || "", filters),
    enabled: Boolean(selectedId),
  });
  return (
    <>
      <ServerEntityTable
        title="Clientes"
        description="RFM, curva ABC, frequência, ticket e recência."
        queryKey={["analytics", "customers", filters]}
        columns={columns}
        defaultSort="revenue"
        preferenceKey="customers"
        fetchPage={(options) => analyticsApi.customers(filters, options)}
        actions={<ExportButtons report="customers" filters={filters} />}
        renderSummary={(summary) => (
          <section className="metric-grid compact">
            {[
              { label: "Top 5", value: summary.concentrationTop5Pct },
              { label: "Top 10", value: summary.concentrationTop10Pct },
              { label: "Top 20", value: summary.concentrationTop20Pct },
            ].map(({ label, value }) => (
              <article key={label}>
                <span>Concentração {label}</span>
                <strong>{Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
              </article>
            ))}
          </section>
        )}
        onRowClick={(row) => setSelectedId(row.id)}
        rowLabel={(row) => `Abrir perfil do cliente ${row.name}`}
      />
      {selectedId && (
        <EntityDetailDrawer
          title={detail.data?.customer.name || "Perfil do cliente"}
          loading={detail.isLoading}
          error={detail.error as Error | null}
          onRetry={() => void detail.refetch()}
          onClose={() => setSelectedId(null)}
        >
          {detail.data && (
            <>
              <div className="metric-grid compact">
                <article><span>Faturamento</span><strong>{money.format(detail.data.customer.revenue)}</strong></article>
                <article><span>Pedidos</span><strong>{detail.data.customer.orderCount}</strong></article>
                <article><span>Ticket médio</span><strong>{money.format(detail.data.customer.averageTicket)}</strong></article>
                <article><span>Segmento RFM</span><strong>{detail.data.customer.rfm.segment}</strong></article>
              </div>
              <h3>Histórico recente</h3>
              <p className="table-note">
                Clique no número do pedido para ver os itens.
              </p>
              <ExpandableOrderHistory
                orders={detail.data.orders.items}
                filters={filters}
                extraColumn="seller"
              />
              <h3>Produtos principais</h3>
              <ul>
                {detail.data.products.items.map((product) => (
                  <li key={product.id}>{product.name} · {money.format(product.revenue)}</li>
                ))}
              </ul>
            </>
          )}
        </EntityDetailDrawer>
      )}
    </>
  );
}
