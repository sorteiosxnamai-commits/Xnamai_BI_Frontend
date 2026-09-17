import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
  formula,
  featured = false,
}: {
  label: string;
  value: string;
  detail: string;
  formula: string;
  featured?: boolean;
}) {
  return (
    <article className={`retention-metric${featured ? " featured" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <p>{detail}</p>
      <small>{formula}</small>
    </article>
  );
}

function ReadingGuide() {
  return (
    <section className="retention-guide" aria-labelledby="retention-guide-title">
      <div className="retention-guide-heading">
        <span aria-hidden="true">?</span>
        <div>
          <h2 id="retention-guide-title">Como ler esta análise</h2>
          <p>As métricas medem comportamentos diferentes. Use estas regras para comparar corretamente.</p>
        </div>
      </div>
      <dl>
        <div>
          <dt>LTV médio observado</dt>
          <dd>Receita já realizada ÷ clientes. Não é lucro nem previsão futura.</dd>
        </div>
        <div>
          <dt>Retenção M+1</dt>
          <dd>Quem comprou novamente no mês seguinte à primeira compra.</dd>
        </div>
        <div>
          <dt>Cliente recorrente</dt>
          <dd>Quem comprou em dois ou mais meses, mesmo que não sejam consecutivos.</dd>
        </div>
        <div>
          <dt>M+0, M+1, M+2…</dt>
          <dd>M+0 é a entrada da coorte; M+1 é o mês seguinte, e assim por diante.</dd>
        </div>
      </dl>
    </section>
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
  const visibleCohorts = [...data.cohorts].slice(-18).reverse();
  const maxLtv = Math.max(
    1,
    ...visibleCohorts.flatMap((cohort) =>
      cohort.retention.map((cell) => cell.cumulativeLtv)
    )
  );

  return (
    <article className="module-card retention-heatmap-card">
      <div className="module-heading">
        <div>
          <h2>Mapa de coortes</h2>
          <p>
            Cada linha reúne clientes que fizeram a primeira compra no mesmo mês. Células mais fortes indicam maior valor.
          </p>
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
      <div className="heatmap-reading-key">
        <span><i className="heatmap-swatch low" /> menor</span>
        <span><i className="heatmap-swatch high" /> maior</span>
        <span><b>—</b> coorte ainda não chegou a esse mês</span>
      </div>
      <div className="data-table-wrap">
        <table className="data-table retention-heatmap">
          <thead>
            <tr>
              <th>Coorte de entrada</th>
              <th>Clientes</th>
              {offsets.map((offset) => (
                <th key={offset} title={offset === 0 ? "Mês da primeira compra" : `${offset} mês(es) após a primeira compra`}>
                  M+{offset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleCohorts.map((cohort) => (
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
                          ? `${cell.customers} de ${cohort.size} clientes compraram em M+${offset}`
                          : `${money.format(cell.cumulativeRevenue)} de receita acumulada na coorte; ${money.format(cell.cumulativeLtv)} por cliente`
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
        Retenção mede compra naquele mês específico; LTV acumula toda a receita de M+0 até o mês indicado. São exibidas as 18 coortes mais recentes e até 12 meses.
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

  const comparison = useMemo(() => {
    if (!data?.cohorts.length) {
      return { horizon: 0, cohorts: [], customers: 0, curve: [], cohortLtv: [] };
    }
    const maximumAge = Math.max(
      0,
      ...data.cohorts.map((cohort) => cohort.retention.length - 1)
    );
    const horizon = Math.min(12, maximumAge);
    const matureCohorts = data.cohorts.filter(
      (cohort) => cohort.retention.some((cell) => cell.monthOffset === horizon)
    );
    const customers = matureCohorts.reduce((sum, cohort) => sum + cohort.size, 0);
    const curve = Array.from({ length: horizon + 1 }, (_, monthOffset) => {
      const cells = matureCohorts.map((cohort) =>
        cohort.retention.find((cell) => cell.monthOffset === monthOffset)
      );
      const cumulativeRevenue = cells.reduce(
        (sum, cell) => sum + (cell?.cumulativeRevenue ?? 0),
        0
      );
      const activeCustomers = cells.reduce(
        (sum, cell) => sum + (cell?.customers ?? 0),
        0
      );
      return {
        monthOffset,
        label: `M+${monthOffset}`,
        ltv: customers ? cumulativeRevenue / customers : 0,
        retentionRate: customers ? (activeCustomers / customers) * 100 : 0,
        activeCustomers,
        customers,
      };
    });
    const cohortLtv = matureCohorts.slice(-12).map((cohort) => {
      const cell = cohort.retention.find((item) => item.monthOffset === horizon);
      return {
        cohort: cohortLabel(cohort.cohort),
        ltv: cell?.cumulativeLtv ?? 0,
        customers: cohort.size,
      };
    });
    return { horizon, cohorts: matureCohorts, customers, curve, cohortLtv };
  }, [data]);

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
  const summary = data.summary;
  return (
    <div className="page-stack retention-page">
      <MetadataStatus metadata={data.metadata} />
      {limitedPeriod && (
        <aside className="retention-history-note">
          <div>
            <strong>O recorte atual limita a leitura do LTV</strong>
            <span>Para enxergar o ciclo completo de recompra, use todo o histórico disponível.</span>
          </div>
          <button type="button" onClick={onUseAllHistory}>Analisar todo o histórico</button>
        </aside>
      )}

      <ReadingGuide />

      <section className="retention-metrics" aria-label="Indicadores de retenção e LTV">
        <MetricCard
          featured
          label="LTV médio observado"
          value={money.format(summary.realizedLtv)}
          detail="Quanto cada cliente gerou, em média, durante todo o recorte selecionado."
          formula={`${money.format(summary.totalRevenue)} ÷ ${summary.customers.toLocaleString("pt-BR")} clientes`}
        />
        <MetricCard
          label="Retenção no M+1"
          value={summary.month1RetentionRate == null ? "Sem maturação" : `${number.format(summary.month1RetentionRate)}%`}
          detail="Parcela que voltou exatamente no mês seguinte à primeira compra."
          formula={summary.month1EligibleCustomers ? `${summary.month1RetainedCustomers.toLocaleString("pt-BR")} retornaram ÷ ${summary.month1EligibleCustomers.toLocaleString("pt-BR")} elegíveis` : "Ainda não há clientes com um mês completo"}
        />
        <MetricCard
          label="Clientes recorrentes"
          value={`${number.format(summary.repeatRate)}%`}
          detail="Parcela que comprou em dois ou mais meses, consecutivos ou não."
          formula={`${summary.repeatCustomers.toLocaleString("pt-BR")} recorrentes ÷ ${summary.customers.toLocaleString("pt-BR")} clientes`}
        />
        <MetricCard
          label="Receita analisada"
          value={money.format(summary.totalRevenue)}
          detail="Receita válida acumulada de todos os clientes e coortes no recorte."
          formula={`${summary.customers.toLocaleString("pt-BR")} clientes em ${data.cohorts.length.toLocaleString("pt-BR")} coortes`}
        />
      </section>

      <div className="metric-reconciliation" role="status">
        <strong>Conferência dos números</strong>
        <span>{money.format(summary.totalRevenue)} de receita ÷ {summary.customers.toLocaleString("pt-BR")} clientes = {money.format(summary.realizedLtv)} de LTV médio observado.</span>
      </div>

      <section className="retention-chart-grid">
        <article className="module-card ltv-curve-card">
          <div className="module-heading">
            <div>
              <h2>Como o LTV cresce de M+0 a M+{comparison.horizon}</h2>
              <p>Receita acumulada média por cliente, usando a mesma base do início ao fim.</p>
            </div>
            <span className="chart-basis">Base comparável</span>
          </div>
          <div className="chart-wrap" role="img" aria-label="LTV acumulado por mês desde a primeira compra">
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={comparison.curve} margin={{ top: 12, right: 18, left: 6, bottom: 4 }}>
                <defs>
                  <linearGradient id="ltvFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent} stopOpacity={0.34} />
                    <stop offset="95%" stopColor={colors.accent} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={colors.axis} />
                <YAxis tick={colors.axis} tickFormatter={(value) => money.format(Number(value))} />
                <Tooltip contentStyle={colors.tooltip} labelFormatter={(label) => `${label}: tempo desde a primeira compra`} formatter={(value) => [money.format(Number(value)), "LTV acumulado por cliente"]} />
                <Area type="monotone" dataKey="ltv" name="LTV acumulado por cliente" stroke={colors.accent} fill="url(#ltvFill)" strokeWidth={3} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-explainer">
            <strong>Por que esta curva é comparável?</strong> Todos os pontos usam os mesmos {comparison.customers.toLocaleString("pt-BR")} clientes de {comparison.cohorts.length.toLocaleString("pt-BR")} coortes que já completaram M+{comparison.horizon}. Assim, o crescimento não é causado pela saída das coortes mais novas.
          </p>
        </article>

        <article className="module-card retention-curve-card">
          <div className="module-heading">
            <div>
              <h2>Retenção mês a mês</h2>
              <p>Percentual da base inicial que comprou em cada mês específico.</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Retenção por mês desde a primeira compra">
            <ResponsiveContainer width="100%" height={310}>
              <LineChart data={comparison.curve} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={colors.axis} />
                <YAxis domain={[0, 100]} tick={colors.axis} tickFormatter={(value) => `${value}%`} />
                <Tooltip contentStyle={colors.tooltip} labelFormatter={(label) => `${label}: compra naquele mês`} formatter={(value) => [`${number.format(Number(value))}%`, "Clientes que compraram"]} />
                <Line type="monotone" dataKey="retentionRate" name="Retenção no mês" stroke={colors.positive} strokeWidth={3} dot={{ r: 3, fill: colors.positive }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="chart-explainer">
            <strong>Exemplo:</strong> 35% em M+1 significa que 35 de cada 100 clientes compraram no mês seguinte. M+0 é sempre 100% porque é o mês de entrada.
          </p>
        </article>
      </section>

      <article className="module-card cohort-comparison-card">
        <div className="module-heading">
          <div>
            <h2>LTV acumulado até M+{comparison.horizon}, por coorte</h2>
            <p>Comparação justa: todas as coortes abaixo tiveram exatamente o mesmo tempo para gerar receita.</p>
          </div>
          <span className="chart-basis">Mesmo horizonte</span>
        </div>
        <div className="chart-wrap" role="img" aria-label={`LTV acumulado até M+${comparison.horizon} por coorte`}>
          <ResponsiveContainer width="100%" height={330}>
            <BarChart data={comparison.cohortLtv} margin={{ top: 12, right: 18, left: 6, bottom: 4 }}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="cohort" tick={colors.axis} />
              <YAxis tick={colors.axis} tickFormatter={(value) => money.format(Number(value))} />
              <Tooltip contentStyle={colors.tooltip} labelFormatter={(label) => `Coorte de ${label}`} formatter={(value) => [money.format(Number(value)), `LTV acumulado até M+${comparison.horizon}`]} />
              <Bar dataKey="ltv" name={`LTV em M+${comparison.horizon}`} fill={colors.blue} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <CohortHeatmap data={data} />
    </div>
  );
}
