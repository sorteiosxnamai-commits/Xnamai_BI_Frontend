import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
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
import { analyticsApi } from "../api/client";
import { MetadataStatus, QueryState } from "../components/feedback/QueryState";
import { useChartColors } from "../theme/useChartColors";
import type { AnalyticsFilters, CohortsResponse } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function cohortLabel(value: string) {
  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

function MetricCard({
  label,
  value,
  detail,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <article className={`retention-metric${featured ? " featured" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function CohortHeatmap({ data }: { data: CohortsResponse }) {
  const [metric, setMetric] = useState<"retention" | "ltv">("retention");
  const maxOffset = Math.min(
    12,
    Math.max(
      0,
      ...data.cohorts.flatMap((cohort) =>
        cohort.retention.map((cell) => cell.monthOffset)
      )
    )
  );
  const offsets = Array.from({ length: maxOffset + 1 }, (_, index) => index);
  const maxLtv = Math.max(
    1,
    ...data.cohorts.flatMap((cohort) =>
      cohort.retention.map((cell) => cell.cumulativeLtv)
    )
  );

  return (
    <article className="module-card retention-heatmap-card">
      <div className="module-heading">
        <div>
          <h2>Mapa de coortes</h2>
          <p>Compare a permanência e o valor acumulado de cada safra de clientes.</p>
        </div>
        <fieldset className="segmented-control">
          <legend>Métrica do mapa de coortes</legend>
          <button
            type="button"
            className={metric === "retention" ? "active" : ""}
            aria-pressed={metric === "retention"}
            onClick={() => setMetric("retention")}
          >
            Retenção
          </button>
          <button
            type="button"
            className={metric === "ltv" ? "active" : ""}
            aria-pressed={metric === "ltv"}
            onClick={() => setMetric("ltv")}
          >
            LTV acumulado
          </button>
        </fieldset>
      </div>
      <div className="data-table-wrap">
        <table className="data-table retention-heatmap">
          <thead>
            <tr>
              <th>Coorte</th>
              <th>Clientes</th>
              {offsets.map((offset) => (
                <th key={offset}>M+{offset}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data.cohorts].reverse().map((cohort) => (
              <tr key={cohort.cohort}>
                <td>{cohortLabel(cohort.cohort)}</td>
                <td>{cohort.size.toLocaleString("pt-BR")}</td>
                {offsets.map((offset) => {
                  const cell = cohort.retention.find(
                    (item) => item.monthOffset === offset
                  );
                  if (!cell) return <td key={offset} className="unavailable">—</td>;
                  const intensity =
                    metric === "retention"
                      ? Math.min(78, Math.max(8, cell.rate * 0.72))
                      : Math.min(78, Math.max(8, (cell.cumulativeLtv / maxLtv) * 72));
                  return (
                    <td
                      key={offset}
                      style={{
                        backgroundColor: `color-mix(in srgb, var(--chart-1) ${intensity}%, var(--bg-elevated))`,
                      }}
                      title={
                        metric === "retention"
                          ? `${cell.customers} clientes ativos`
                          : `${money.format(cell.cumulativeRevenue)} acumulados na coorte`
                      }
                    >
                      {metric === "retention"
                        ? `${number.format(cell.rate)}%`
                        : money.format(cell.cumulativeLtv)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="retention-footnote">
        M+0 é o mês da primeira compra observada. O mapa mostra até 12 meses para manter a leitura clara.
      </p>
    </article>
  );
}

export function RetentionPage({
  filters,
  onUseAllHistory,
}: {
  filters: AnalyticsFilters;
  onUseAllHistory: () => void;
}) {
  const colors = useChartColors();
  const query = useQuery({
    queryKey: ["analytics", "retention", filters],
    queryFn: () => analyticsApi.cohorts(filters),
  });
  const data = query.data;
  const curve = useMemo(() => {
    if (!data) return [];
    const retention = new Map(
      data.retentionCurve.map((point) => [point.monthOffset, point])
    );
    return data.ltvCurve.map((point) => ({
      ...point,
      label: `M+${point.monthOffset}`,
      retentionRate: retention.get(point.monthOffset)?.retentionRate ?? 0,
    }));
  }, [data]);
  const cohortLtv = useMemo(
    () =>
      data
        ? [...data.cohorts]
            .slice(-12)
            .map((cohort) => ({
              cohort: cohortLabel(cohort.cohort),
              ltv: cohort.realizedLtv,
              customers: cohort.size,
            }))
        : [],
    [data]
  );

  if (query.isError || !data) {
    return (
      <QueryState
        loading={query.isLoading}
        error={query.error as Error | null}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (data.cohorts.length === 0) {
    return <QueryState loading={false} error={null} empty />;
  }

  const limitedPeriod = filters.period !== "all" || filters.dateFrom || filters.dateTo;
  return (
    <div className="page-stack retention-page">
      <MetadataStatus metadata={data.metadata} />
      {limitedPeriod && (
        <aside className="retention-history-note">
          <div>
            <strong>O recorte atual limita a leitura do LTV</strong>
            <span>
              Para enxergar o ciclo completo de recompra, use todo o histórico disponível.
            </span>
          </div>
          <button type="button" onClick={onUseAllHistory}>
            Analisar todo o histórico
          </button>
        </aside>
      )}

      <section className="retention-metrics" aria-label="Indicadores de retenção e LTV">
        <MetricCard
          featured
          label="LTV observado"
          value={money.format(data.summary.realizedLtv)}
          detail="Receita acumulada média por cliente no recorte."
        />
        <MetricCard
          label="Retenção no M+1"
          value={
            data.summary.month1RetentionRate == null
              ? "Sem maturação"
              : `${number.format(data.summary.month1RetentionRate)}%`
          }
          detail={`${data.summary.month1RetainedCustomers.toLocaleString("pt-BR")} de ${data.summary.month1EligibleCustomers.toLocaleString("pt-BR")} clientes elegíveis voltaram no mês seguinte.`}
        />
        <MetricCard
          label="Clientes recorrentes"
          value={`${number.format(data.summary.repeatRate)}%`}
          detail={`${data.summary.repeatCustomers.toLocaleString("pt-BR")} clientes compraram em mais de um mês.`}
        />
        <MetricCard
          label="Receita analisada"
          value={money.format(data.summary.totalRevenue)}
          detail={`${data.summary.customers.toLocaleString("pt-BR")} clientes distribuídos nas coortes.`}
        />
      </section>

      <section className="retention-chart-grid">
        <article className="module-card ltv-curve-card">
          <div className="module-heading">
            <div>
              <h2>Evolução do LTV</h2>
              <p>Valor acumulado por cliente e retenção conforme a coorte amadurece.</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Curva de LTV e retenção por mês">
            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={curve}>
                <defs>
                  <linearGradient id="ltvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent} stopOpacity={0.34} />
                    <stop offset="95%" stopColor={colors.accent} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={colors.axis} />
                <YAxis
                  yAxisId="ltv"
                  tick={colors.axis}
                  tickFormatter={(value) => money.format(Number(value))}
                />
                <YAxis
                  yAxisId="retention"
                  orientation="right"
                  domain={[0, 100]}
                  tick={colors.axis}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value, name) =>
                    name === "Retenção"
                      ? `${number.format(Number(value))}%`
                      : money.format(Number(value))
                  }
                />
                <Legend />
                <Area
                  yAxisId="ltv"
                  type="monotone"
                  dataKey="ltv"
                  name="LTV acumulado"
                  stroke={colors.accent}
                  fill="url(#ltvFill)"
                  strokeWidth={3}
                />
                <Line
                  yAxisId="retention"
                  type="monotone"
                  dataKey="retentionRate"
                  name="Retenção"
                  stroke={colors.positive}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>LTV por coorte</h2>
              <p>Receita observada por cliente nas 12 safras mais recentes.</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="LTV observado por coorte">
            <ResponsiveContainer width="100%" height={330}>
              <BarChart data={cohortLtv}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="cohort" tick={colors.axis} />
                <YAxis tick={colors.axis} tickFormatter={(value) => money.format(Number(value))} />
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value) => money.format(Number(value))}
                />
                <Bar dataKey="ltv" name="LTV observado" fill={colors.blue} radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <CohortHeatmap data={data} />
    </div>
  );
}
