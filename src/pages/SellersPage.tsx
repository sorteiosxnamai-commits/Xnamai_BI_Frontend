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
import type { AnalyticsFilters, SellerAnalyticsRow } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const columns: EntityColumn<SellerAnalyticsRow>[] = [
  { id: "name", label: "Vendedor", render: (row) => row.name },
  { id: "order_count", label: "Pedidos", render: (row) => row.orderCount },
  { id: "revenue", label: "Faturamento", render: (row) => money.format(row.revenue) },
  {
    id: "average_ticket",
    label: "Ticket médio",
    render: (row) => money.format(row.averageTicket),
  },
  { id: "customers", label: "Clientes únicos", render: (row) => row.customers },
  {
    id: "new_customers",
    label: "Novos clientes",
    render: (row) => row.newCustomers ?? "Indisponível",
  },
  { id: "cancellations", label: "Cancelamentos", render: (row) => row.cancellations },
  {
    id: "discount_total",
    label: "Desconto",
    render: (row) => money.format(row.discountTotal),
  },
];

export function SellersPage({ filters }: { filters: AnalyticsFilters }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["analytics", "seller-detail", selectedId, filters],
    queryFn: () => analyticsApi.sellerDetail(selectedId || "", filters),
    enabled: Boolean(selectedId),
  });
  return (
    <>
      <ServerEntityTable
        title="Vendedores"
        description="Desempenho comercial processado no servidor."
        queryKey={["analytics", "sellers", filters]}
        columns={columns}
        defaultSort="revenue"
        preferenceKey="sellers"
        fetchPage={(options) => analyticsApi.sellers(filters, options)}
        actions={<ExportButtons report="sellers" filters={filters} />}
        onRowClick={(row) => setSelectedId(row.id)}
        rowLabel={(row) => `Abrir carteira do vendedor ${row.name}`}
      />
      {selectedId && (
        <EntityDetailDrawer
          title={detail.data?.seller.name || "Desempenho do vendedor"}
          loading={detail.isLoading}
          error={detail.error as Error | null}
          onRetry={() => void detail.refetch()}
          onClose={() => setSelectedId(null)}
        >
          {detail.data && (
            <>
              <div className="metric-grid compact">
                <article><span>Faturamento</span><strong>{money.format(detail.data.seller.revenue)}</strong></article>
                <article><span>Pedidos</span><strong>{detail.data.seller.orderCount}</strong></article>
                <article><span>Ticket médio</span><strong>{money.format(detail.data.seller.averageTicket)}</strong></article>
                <article><span>Clientes</span><strong>{detail.data.seller.customers}</strong></article>
              </div>
              <h3>Pedidos recentes</h3>
              <p className="table-note">
                Clique no número do pedido para ver os itens.
              </p>
              <ExpandableOrderHistory
                orders={detail.data.orders.items}
                filters={filters}
                extraColumn="customer"
              />
              <h3>Carteira ativa no período</h3>
              <ul>
                {detail.data.customers.items.map((customer) => (
                  <li key={customer.id}>{customer.name} · {money.format(customer.revenue)}</li>
                ))}
              </ul>
            </>
          )}
        </EntityDetailDrawer>
      )}
    </>
  );
}
