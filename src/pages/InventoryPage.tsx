import { analyticsApi } from "../api/client";
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

const columns: EntityColumn<ProductAnalyticsRow>[] = [
  { id: "code", label: "Código", render: (row) => row.code || "—" },
  { id: "name", label: "Produto", render: (row) => row.name },
  { id: "stock", label: "Estoque", render: (row) => row.stock.toLocaleString("pt-BR") },
  {
    id: "stock_value",
    label: "Valor a preço de tabela",
    render: (row) => money.format(row.stockValue),
  },
  {
    id: "quantity_sold",
    label: "Quantidade vendida",
    render: (row) => row.quantitySold.toLocaleString("pt-BR"),
  },
  {
    id: "last_sale_at",
    label: "Última venda",
    render: (row) =>
      row.lastSaleAt ? new Date(row.lastSaleAt).toLocaleDateString("pt-BR") : "Nunca",
  },
  {
    id: "days_without_sale",
    label: "Dias sem venda",
    render: (row) => row.daysWithoutSale ?? "—",
  },
  {
    id: "velocity",
    label: "Velocidade/dia",
    sortable: false,
    render: (row) => row.averageDailyVelocity.toLocaleString("pt-BR", { maximumFractionDigits: 2 }),
  },
  {
    id: "coverage",
    label: "Cobertura estimada",
    sortable: false,
    render: (row) =>
      row.estimatedCoverageDays == null
        ? "Indisponível"
        : `${row.estimatedCoverageDays.toLocaleString("pt-BR", {
            maximumFractionDigits: 0,
          })} dias`,
  },
  {
    id: "classification",
    label: "Situação",
    sortable: false,
    render: (row) => row.classification.replaceAll("_", " "),
  },
];

export function InventoryPage({ filters }: { filters: AnalyticsFilters }) {
  return (
    <ServerEntityTable
      title="Estoque"
      description="Estoque atual, valor a preço de tabela e velocidade de venda. Custo indisponível."
      queryKey={["analytics", "inventory", filters]}
      columns={columns}
      defaultSort="stock_value"
      preferenceKey="inventory"
      fetchPage={(options) => analyticsApi.inventory(filters, options)}
      actions={<ExportButtons report="inventory" filters={filters} />}
      renderSummary={(summary) => (
        <section className="metric-grid compact">
          <article>
            <span>Valor a preço de tabela</span>
            <strong>{money.format(Number(summary.stockValueAtListPrice || 0))}</strong>
          </article>
          <article>
            <span>Produtos com estoque</span>
            <strong>{Number(summary.productsWithPositiveStock || 0).toLocaleString("pt-BR")}</strong>
          </article>
          <article>
            <span>Produtos sem estoque</span>
            <strong>{Number(summary.productsWithoutStock || 0).toLocaleString("pt-BR")}</strong>
          </article>
          <article>
            <span>Valor a custo</span>
            <strong>{String(summary.costValueAvailability || "Indisponível na fonte")}</strong>
          </article>
        </section>
      )}
    />
  );
}
