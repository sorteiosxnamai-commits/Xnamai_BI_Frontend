import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { QueryState } from "../components/feedback/QueryState";
import { money, moneyExact, num, relativeTime } from "../format";
import { useChartColors } from "../theme/useChartColors";
import { crmApi } from "./crmApi";

const OUTCOME_LABEL: Record<string, string> = {
  won: "Gerou venda",
  lost: "Sem venda",
  discarded: "Descartado",
};

export function CrmDashboardPage() {
  const colors = useChartColors();
  const query = useQuery({
    queryKey: ["crm-dashboard"],
    queryFn: () => crmApi.dashboard(30),
  });
  const data = query.data;
  const kpis = data?.kpis;

  return (
    <div className="page-stack">
      <QueryState
        loading={query.isLoading}
        error={query.error instanceof Error ? query.error : null}
        onRetry={() => void query.refetch()}
      />
      {kpis && data && (
        <>
          <section className="metric-grid">
            <article className="metric-card">
              <span>Leads na fila</span>
              <strong>{num(kpis.openLeads)}</strong>
              <small>Inclui disponiveis e em atendimento</small>
            </article>
            <article className="metric-card">
              <span>Em atendimento</span>
              <strong>{num(kpis.inProgress)}</strong>
              <small>Pegos e ainda nao finalizados</small>
            </article>
            <article className="metric-card">
              <span>Finalizados hoje</span>
              <strong>{num(kpis.finishedToday)}</strong>
              <small>
                {num(kpis.finishedMonth)} no mes | {num(kpis.finishedPeriod)} em 30 dias
              </small>
            </article>
            <article className="metric-card">
              <span>Vendas geradas (30d)</span>
              <strong>{money(kpis.salesValuePeriod ?? 0)}</strong>
              <small>{num(kpis.salesWonPeriod ?? 0)} vendas fechadas no periodo</small>
            </article>
            <article className="metric-card">
              <span>Faturamento da fila</span>
              <strong>{money(kpis.billingOpen)}</strong>
              <small>Potencial ainda aberto</small>
            </article>
            <article className="metric-card">
              <span>Vendas registradas</span>
              <strong>{money(kpis.salesValuePeriod ?? 0)}</strong>
              <small>
                Potencial historico {money(kpis.billingFinishedPeriod)} | media{" "}
                {kpis.averageHandleMinutes ? `${kpis.averageHandleMinutes} min` : "--"}
              </small>
            </article>
          </section>

          <article className="module-card">
            <div className="module-heading">
              <div>
                <h2>Atendimentos e vendas</h2>
                <p>Volume diario de atendimentos finalizados e valor de vendas registradas nos ultimos {data.periodDays} dias.</p>
              </div>
            </div>
            {data.series.length ? (
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height={310}>
                  <AreaChart data={data.series}>
                    <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "revenue"
                          ? [moneyExact(Number(value || 0)), "Vendas"]
                          : [num(Number(value || 0)), "Atendimentos"]
                      }
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="attendances"
                      stroke={colors.positive}
                      fill={colors.positive}
                      fillOpacity={0.18}
                      name="attendances"
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenue"
                      stroke={colors.accent}
                      fill={colors.accent}
                      fillOpacity={0.12}
                      name="revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="crm-empty">Ainda nao ha atendimentos finalizados no periodo.</p>
            )}
          </article>

          <section className="overview-charts">
            <article className="module-card">
              <div className="module-heading">
                <div>
                  <h2>Por vendedor</h2>
                  <p>Atendimentos finalizados e vendas registradas pelo vendedor.</p>
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Vendedor</th>
                    <th>Atendimentos</th>
                    <th>Vendas (R$)</th>
                    <th>Vendas qtd</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sellers.map((row) => (
                    <tr key={row.sellerName}>
                      <td>{row.sellerName}</td>
                      <td>{num(row.attendances)}</td>
                      <td>{moneyExact(row.revenue)}</td>
                      <td>{num(row.salesWon ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.sellers.length && <p className="crm-empty">Nenhum atendimento finalizado.</p>}
            </article>
            <article className="module-card">
              <div className="module-heading">
                <div>
                  <h2>Ultimos finalizados</h2>
                  <p>Sairam da fila ao concluir o atendimento.</p>
                </div>
              </div>
              <ol className="crm-recent">
                {data.recentFinished.map((row) => (
                  <li key={row.id}>
                    <strong>{row.name}</strong>
                    <small>
                      {row.sellerName || "Sem vendedor"} | {relativeTime(row.finishedAt)} |{" "}
                      {OUTCOME_LABEL[row.outcome || ""] || row.outcome || "Sem resultado"}
                      {row.saleValue ? ` | ${money(row.saleValue)}` : ""}
                      {row.orderNumber ? ` | Pedido #${row.orderNumber}` : ""}
                    </small>
                  </li>
                ))}
              </ol>
              {!data.recentFinished.length && <p className="crm-empty">Nenhum finalizado ainda.</p>}
            </article>
          </section>
        </>
      )}
    </div>
  );
}
