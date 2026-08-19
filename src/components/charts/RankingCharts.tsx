import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "../../theme/useChartColors";
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
  const colors = useChartColors();
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
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tickFormatter={(value) => money.format(Number(value))} tick={colors.axis} />
              <YAxis type="category" dataKey="name" width={110} tick={colors.axis} />
              <Tooltip contentStyle={colors.tooltip} formatter={(value) => money.format(Number(value))} />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill={colors.accent} radius={[0, 5, 5, 0]} />
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
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={colors.axis} />
              <YAxis tickFormatter={(value) => money.format(Number(value))} tick={colors.axis} />
              <Tooltip contentStyle={colors.tooltip} formatter={(value) => money.format(Number(value))} />
              <Legend />
              <Bar dataKey="revenue" name="Faturamento" fill={colors.positive} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Concentração dos 20 maiores clientes</h2>
            <p>
              Barras: faturamento dos pedidos de cada cliente. Linha: quanto
              esses 20 já concentram do faturamento de toda a base filtrada.
            </p>
          </div>
          <ExportButtons report="customers" filters={filters} />
        </div>
        {data.customers.items.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
        <div className="chart-wrap" role="img" aria-label="Pareto de clientes">
          <ResponsiveContainer width="100%" height={310}>
            <ComposedChart data={data.customers.items}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={colors.axis} />
              <YAxis yAxisId="money" tickFormatter={(value) => money.format(Number(value))} tick={colors.axis} />
              <YAxis yAxisId="percent" orientation="right" domain={[0, 100]} unit="%" tick={colors.axis} />
              <ReferenceLine
                yAxisId="percent"
                y={80}
                stroke={colors.warning}
                strokeDasharray="4 4"
                label="80%"
              />
              <Tooltip
                contentStyle={colors.tooltip}
                formatter={(value, name) =>
                  name === "Participação acumulada"
                    ? `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                    : money.format(Number(value))
                }
              />
              <Legend />
              <Bar yAxisId="money" dataKey="revenue" name="Faturamento" fill={colors.accent} />
              <Line
                yAxisId="percent"
                dataKey="cumulativeRevenueShare"
                name="Participação acumulada"
                stroke={colors.negative}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        )}
        {data.customers.summary?.concentrationTop20Pct != null && (
          <p className="table-note">
            Os 20 maiores concentram{" "}
            {Number(data.customers.summary.concentrationTop20Pct).toLocaleString(
              "pt-BR",
              { maximumFractionDigits: 1 }
            )}
            % do faturamento. A linha não chega a 100% porque o restante está
            nos demais clientes, fora deste recorte.
          </p>
        )}
      </article>
    </section>
  );
}
