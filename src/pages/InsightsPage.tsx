import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { analyticsApi } from "../api/client";
import { RankingCharts } from "../components/charts/RankingCharts";
import { MetadataStatus, QueryState } from "../components/feedback/QueryState";
import { ExportButtons } from "../components/tables/ExportButtons";
import { useChartColors } from "../theme/useChartColors";
import type { AnalyticsFilters } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function InsightsPage({ filters }: { filters: AnalyticsFilters }) {
  const colors = useChartColors();
  const geography = useQuery({
    queryKey: ["analytics", "geography", filters],
    queryFn: () => analyticsApi.geography(filters),
  });
  const cohorts = useQuery({
    queryKey: ["analytics", "cohorts", filters],
    queryFn: () => analyticsApi.cohorts(filters),
  });
  const associations = useQuery({
    queryKey: ["analytics", "associations", filters],
    queryFn: () => analyticsApi.associations(filters),
  });
  const rankings = useQuery({
    queryKey: ["analytics", "rankings", filters],
    queryFn: () => analyticsApi.rankings(filters),
  });
  const cohortRows = cohorts.data?.cohorts || [];
  const maxOffset = Math.max(
    0,
    ...cohortRows.flatMap((cohort) =>
      cohort.retention.map((cell) => cell.monthOffset)
    )
  );
  const monthOffsets = Array.from({ length: maxOffset + 1 }, (_, offset) => ({
    offset,
    key: `month-${offset}`,
  }));

  return (
    <div className="page-stack">
      {geography.data && !geography.isError && (
        <MetadataStatus metadata={geography.data.metadata} />
      )}
      {geography.data && !geography.isError ? (
      <section className="overview-charts">
        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>Faturamento por estado</h2>
              <p>Vendas válidas com cliente geograficamente identificado.</p>
            </div>
            <ExportButtons report="customers" filters={filters} />
          </div>
          <div className="chart-wrap" role="img" aria-label="Faturamento por estado">
            <ResponsiveContainer width="100%" height={310}>
              <BarChart data={geography.data.states.slice(0, 15)}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="state" tick={colors.axis} />
                <YAxis tickFormatter={(value) => money.format(Number(value))} tick={colors.axis} />
                <Tooltip contentStyle={colors.tooltip} formatter={(value) => money.format(Number(value))} />
                <Legend />
                <Bar dataKey="revenue" name="Faturamento" fill={colors.accent} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>Ranking de cidades</h2>
              <p>Top cidades pelos mesmos filtros globais.</p>
            </div>
            <ExportButtons report="customers" filters={filters} />
          </div>
          <div className="chart-wrap" role="img" aria-label="Faturamento por cidade">
            <ResponsiveContainer width="100%" height={310}>
              <BarChart
                data={geography.data.cities.slice(0, 15).map((city) => ({
                  ...city,
                  label: `${city.city}/${city.state || "—"}`,
                }))}
                layout="vertical"
              >
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(value) => money.format(Number(value))} tick={colors.axis} />
                <YAxis type="category" dataKey="label" width={120} tick={colors.axis} />
                <Tooltip contentStyle={colors.tooltip} formatter={(value) => money.format(Number(value))} />
                <Legend />
                <Bar dataKey="revenue" name="Faturamento" fill={colors.blue} radius={[0, 5, 5, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
      ) : (
        <QueryState
          loading={geography.isLoading}
          error={geography.error as Error | null}
          onRetry={() => void geography.refetch()}
        />
      )}

      {cohorts.data && !cohorts.isError ? (
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Coortes de recompra</h2>
            <p>Retenção por mês desde a primeira venda válida de cada cliente.</p>
          </div>
          <ExportButtons report="customers" filters={filters} />
        </div>
        <div className="data-table-wrap">
          <table className="data-table cohort-table">
            <thead>
              <tr>
                <th>Coorte</th>
                <th>Clientes</th>
                {monthOffsets.map((month) => (
                  <th key={month.key}>M+{month.offset}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohortRows.map((cohort) => (
                <tr key={cohort.cohort}>
                  <td>{cohort.cohort}</td>
                  <td>{cohort.size}</td>
                  {monthOffsets.map((month) => {
                    const cell = cohort.retention.find(
                      (retention) => retention.monthOffset === month.offset
                    );
                    const rate = cell?.rate || 0;
                    return (
                      <td
                        key={`${cohort.cohort}-${month.key}`}
                        style={{
                          backgroundColor: `color-mix(in srgb, var(--chart-1) ${Math.min(rate, 72)}%, transparent)`,
                        }}
                      >
                        {rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      ) : (
        <QueryState
          loading={cohorts.isLoading}
          error={cohorts.error as Error | null}
          onRetry={() => void cohorts.refetch()}
        />
      )}

      {associations.data && !associations.isError ? (
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Produtos comprados juntos</h2>
            <p>Pares encontrados nos itens completos de vendas válidas.</p>
          </div>
          <ExportButtons report="products" filters={filters} />
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produto A</th>
                <th>Produto B</th>
                <th>Pedidos juntos</th>
              </tr>
            </thead>
            <tbody>
              {associations.data.items.map((item) => (
                <tr key={`${item.productAId}-${item.productBId}`}>
                  <td>{item.productAName}</td>
                  <td>{item.productBName}</td>
                  <td>{item.ordersTogether}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
      ) : (
        <QueryState
          loading={associations.isLoading}
          error={associations.error as Error | null}
          onRetry={() => void associations.refetch()}
        />
      )}
      {rankings.data && !rankings.isError ? (
        <RankingCharts data={rankings.data} filters={filters} />
      ) : (
        <QueryState
          loading={rankings.isLoading}
          error={rankings.error as Error | null}
          onRetry={() => void rankings.refetch()}
        />
      )}
    </div>
  );
}
