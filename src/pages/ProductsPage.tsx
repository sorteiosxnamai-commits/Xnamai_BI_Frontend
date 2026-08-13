import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/client";
import { EntityDetailDrawer } from "../components/feedback/EntityDetailDrawer";
import { ExportButtons } from "../components/tables/ExportButtons";
import {
  ServerEntityTable,
  type EntityColumn,
} from "../components/tables/ServerEntityTable";
import type { AnalyticsFilters, ProductAnalyticsRow } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const columns: EntityColumn<ProductAnalyticsRow>[] = [
  { id: "code", label: "Código", render: (row) => row.code || "—" },
  { id: "name", label: "Produto", render: (row) => row.name },
  {
    id: "quantity_sold",
    label: "Quantidade vendida",
    render: (row) => number.format(row.quantitySold),
  },
  { id: "order_count", label: "Pedidos", render: (row) => number.format(row.orderCount) },
  { id: "revenue", label: "Faturamento", render: (row) => money.format(row.revenue) },
  {
    id: "average_price",
    label: "Preço médio",
    render: (row) => money.format(row.averagePrice),
  },
  { id: "stock", label: "Estoque", render: (row) => number.format(row.stock) },
  {
    id: "stock_value",
    label: "Valor em estoque",
    render: (row) => money.format(row.stockValue),
  },
  { id: "last_sale_at", label: "Última venda", render: (row) =>
    row.lastSaleAt ? new Date(row.lastSaleAt).toLocaleDateString("pt-BR") : "Nunca" },
  {
    id: "days_without_sale",
    label: "Dias sem venda",
    render: (row) => row.daysWithoutSale ?? "—",
  },
  { id: "abc", label: "ABC", sortable: false, render: (row) => row.abcClass || "—" },
  {
    id: "classification",
    label: "Classificação",
    sortable: false,
    render: (row) => row.classification.replaceAll("_", " "),
  },
];

export function ProductsPage({ filters }: { filters: AnalyticsFilters }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["analytics", "product-detail", selectedId, filters],
    queryFn: () => analyticsApi.productDetail(selectedId || "", filters),
    enabled: Boolean(selectedId),
  });
  return (
    <>
      <ServerEntityTable
        title="Produtos"
        description="Giro, faturamento, preço realizado, estoque e curva ABC."
        queryKey={["analytics", "products", filters]}
        columns={columns}
        defaultSort="revenue"
        preferenceKey="products"
        fetchPage={(options) => analyticsApi.products(filters, options)}
        actions={<ExportButtons report="products" filters={filters} />}
        onRowClick={(row) => setSelectedId(row.id)}
        rowLabel={(row) => `Abrir detalhes do produto ${row.name}`}
      />
      {selectedId && (
        <EntityDetailDrawer
          title={detail.data?.product.name || "Detalhe do produto"}
          loading={detail.isLoading}
          error={detail.error as Error | null}
          onRetry={() => void detail.refetch()}
          onClose={() => setSelectedId(null)}
        >
          {detail.data && (
            <>
              <div className="metric-grid compact">
                <article><span>Faturamento</span><strong>{money.format(detail.data.product.revenue)}</strong></article>
                <article><span>Quantidade</span><strong>{number.format(detail.data.product.quantitySold)}</strong></article>
                <article><span>Estoque</span><strong>{number.format(detail.data.product.stock)}</strong></article>
                <article><span>ABC</span><strong>{detail.data.product.abcClass || "—"}</strong></article>
              </div>
              <h3>Pedidos recentes</h3>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Total</th></tr></thead>
                  <tbody>
                    {detail.data.recentOrders.items.map((order) => (
                      <tr key={order.id}>
                        <td>{order.number}</td>
                        <td>{order.issuedAt ? new Date(order.issuedAt).toLocaleDateString("pt-BR") : "—"}</td>
                        <td>{order.customerName || "—"}</td>
                        <td>{money.format(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Clientes principais</h3>
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
