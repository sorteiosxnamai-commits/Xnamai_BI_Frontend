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
import type {
  AnalyticsFilters,
  CustomerAnalyticsRow,
  CustomerCohortSummary,
  CustomersPageSummary,
} from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function asCohort(
  summary: Record<string, unknown>,
  key: "top5" | "top10" | "top20" | "rest",
  fallbackShareKey: string,
): CustomerCohortSummary {
  const nested = summary[key];
  if (nested && typeof nested === "object") {
    const cohort = nested as CustomerCohortSummary;
    return {
      customerCount: Number(cohort.customerCount || 0),
      revenue: Number(cohort.revenue || 0),
      revenueSharePct: Number(cohort.revenueSharePct || 0),
      orderSharePct: Number(cohort.orderSharePct || 0),
      averageMonthlyOrders: Number(cohort.averageMonthlyOrders || 0),
    };
  }
  return {
    customerCount: 0,
    revenue: 0,
    revenueSharePct: Number(summary[fallbackShareKey] || 0),
    orderSharePct: 0,
    averageMonthlyOrders: 0,
  };
}

function CustomerCohortCards({ summary }: { summary: Record<string, unknown> }) {
  const data = summary as CustomersPageSummary & Record<string, unknown>;
  const cards = [
    {
      id: "top5",
      label: "Top 5",
      hint: "do faturamento no período",
      cohort: asCohort(data, "top5", "concentrationTop5Pct"),
    },
    {
      id: "top10",
      label: "Top 10",
      hint: "do faturamento no período",
      cohort: asCohort(data, "top10", "concentrationTop10Pct"),
    },
    {
      id: "top20",
      label: "Top 20",
      hint: "do faturamento no período",
      cohort: asCohort(data, "top20", "concentrationTop20Pct"),
    },
    {
      id: "rest",
      label: "Demais clientes",
      hint: "do faturamento fora do Top 20",
      cohort: asCohort(data, "rest", "concentrationRestPct"),
    },
  ];
  return (
    <>
      <section className="metric-grid cohorts" aria-label="Divisão de clientes por faturamento">
        {cards.map(({ id, label, hint, cohort }) => (
          <article key={id} className={id === "rest" ? "rest" : undefined}>
            <span>{label}</span>
            <strong>{percent.format(cohort.revenueSharePct)}%</strong>
            <small>{hint}</small>
            <p>
              Média de {quantity.format(cohort.averageMonthlyOrders)} pedidos/mês
              {cohort.customerCount
                ? ` · ${cohort.customerCount.toLocaleString("pt-BR")} cliente${
                    cohort.customerCount === 1 ? "" : "s"
                  }`
                : ""}
              {cohort.revenue
                ? ` · ${money.format(cohort.revenue)}`
                : ""}
              {cohort.orderSharePct
                ? ` · ${percent.format(cohort.orderSharePct)}% dos pedidos`
                : ""}
            </p>
          </article>
        ))}
      </section>
      <p className="cohort-note">
        Top 5, 10 e 20 são os maiores em faturamento no período filtrado. Demais clientes
        são a cauda longa: todos os outros compradores, para medir o impacto de quem fatura
        menos.
      </p>
    </>
  );
}

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
        renderSummary={(summary) => <CustomerCohortCards summary={summary} />}
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
