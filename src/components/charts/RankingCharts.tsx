import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsFilters, RankingsResponse } from "../../types/analytics";
import { QueryState } from "../feedback/QueryState";
import { ExportButtons } from "../tables/ExportButtons";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function RankingCharts({
  data,
  filters,
}: {
  data: RankingsResponse;
  filters: AnalyticsFilters;
}) {
  return (
    <section className="breakdown-grid">
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Top produtos</h2>
            <p>Faturamento de itens em toda a base filtrada.</p>
          </div>
          <ExportButtons report="products" filters={filters} />
        </div>
        {data.products.items.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
        <div className="chart-wrap" role="img" aria-label="Produtos por faturamento">
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={data.products.items.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => money.format(Number(value))} />
              <YAxis type="category" dataKey="name" width={110} />
              <Tooltip formatter={(value) => money.format(Number(value))} />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill="#635bdf" radius={[0, 5, 5, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Top vendedores</h2>
            <p>Desempenho pelo faturamento líquido das vendas válidas.</p>
          </div>
          <ExportButtons report="sellers" filters={filters} />
        </div>
        {data.sellers.items.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
        <div className="chart-wrap" role="img" aria-label="Vendedores por faturamento">
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={data.sellers.items.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => money.format(Number(value))} />
              <Tooltip formatter={(value) => money.format(Number(value))} />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill="#2ba77a" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Pareto de clientes</h2>
            <p>Receita individual e participação acumulada na base filtrada.</p>
          </div>
          <ExportButtons report="customers" filters={filters} />
        </div>
        {data.customers.items.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
        <div className="chart-wrap" role="img" aria-label="Pareto de clientes">
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={data.customers.items}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis yAxisId="money" tickFormatter={(value) => money.format(Number(value))} />
              <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} unit="%" />
              <Tooltip
                formatter={(value, name) =>
                  name === "Participação acumulada"
                    ? `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                    : money.format(Number(value))
                }
              />
              <Legend />
              <Bar yAxisId="money" dataKey="revenue" name="Faturamento" fill="#635bdf" />
              <Line
                yAxisId="percent"
                dataKey="cumulativeRevenueShare"
                name="Participação acumulada"
                stroke="#d05261"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}
      </article>
    </section>
  );
}
