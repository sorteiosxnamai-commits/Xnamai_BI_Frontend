import { useLocation, useNavigate } from "react-router-dom";
import {
  Bar,
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
import type { AnalyticsFilters, BreakdownsResponse } from "../../types/analytics";
import { QueryState } from "../feedback/QueryState";
import { ExportButtons } from "../tables/ExportButtons";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

const CLASS_HELP = {
  A: "Clientes que formam aproximadamente os primeiros 80% do faturamento.",
  B: "Clientes que levam o faturamento acumulado de cerca de 80% a 95%.",
  C: "Demais clientes, responsáveis pela parcela final do faturamento.",
};

export function CustomerAbcChart({
  data,
  filters,
}: {
  data: BreakdownsResponse["customerAbc"];
  filters: AnalyticsFilters;
}) {
  const colors = useChartColors();
  const navigate = useNavigate();
  const location = useLocation();
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalCustomers = data.reduce((sum, item) => sum + item.entities, 0);
  let cumulativeRevenuePct = 0;
  const rows = (["A", "B", "C"] as const).map((abcClass) => {
    const item = data.find((entry) => entry.class === abcClass);
    const revenueSharePct =
      item?.revenueSharePct ??
      (totalRevenue > 0 ? ((item?.revenue ?? 0) / totalRevenue) * 100 : 0);
    cumulativeRevenuePct = Math.min(100, cumulativeRevenuePct + revenueSharePct);
    return {
      class: abcClass,
      label: `Classe ${abcClass}`,
      customers: item?.entities ?? 0,
      revenue: item?.revenue ?? 0,
      customerSharePct:
        item?.entitySharePct ??
        (totalCustomers > 0 ? ((item?.entities ?? 0) / totalCustomers) * 100 : 0),
      revenueSharePct,
      cumulativeRevenuePct,
    };
  });

  return (
    <article className="module-card customer-abc-card">
      <div className="module-heading">
        <div>
          <h2>Curva ABC de clientes</h2>
          <p>
            Clientes ordenados do maior para o menor faturamento. Compare quantos clientes
            existem em cada classe com a receita que eles concentram.
          </p>
        </div>
        <ExportButtons report="customers" filters={filters} />
      </div>

      {data.length === 0 ? (
        <QueryState loading={false} error={null} empty />
      ) : (
        <div className="customer-abc-layout">
          <div
            className="chart-wrap"
            role="img"
            aria-label="Curva ABC de clientes por participacao e faturamento acumulado"
          >
            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={rows} margin={{ top: 18, right: 12, left: 4, bottom: 2 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={colors.axis} />
                <YAxis domain={[0, 100]} unit="%" tick={colors.axis} />
                <ReferenceLine
                  y={80}
                  stroke={colors.warning}
                  strokeDasharray="4 4"
                  label={{ value: "Limite A: 80%", fill: colors.warning, fontSize: 10 }}
                />
                <ReferenceLine
                  y={95}
                  stroke={colors.negative}
                  strokeDasharray="4 4"
                  label={{ value: "Limite B: 95%", fill: colors.negative, fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value, name, item) => {
                    const payload = item?.payload as
                      | { customers?: number; revenue?: number }
                      | undefined;
                    const detail =
                      name === "Clientes da classe"
                        ? `${payload?.customers ?? 0} clientes`
                        : name === "Faturamento da classe"
                          ? money.format(payload?.revenue ?? 0)
                          : undefined;
                    return [
                      `${percent.format(Number(value))}%${detail ? ` · ${detail}` : ""}`,
                      name,
                    ];
                  }}
                />
                <Legend />
                <Bar
                  dataKey="customerSharePct"
                  name="Clientes da classe"
                  fill={colors.blue}
                  radius={[5, 5, 0, 0]}
                />
                <Bar
                  dataKey="revenueSharePct"
                  name="Faturamento da classe"
                  fill={colors.accent}
                  radius={[5, 5, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeRevenuePct"
                  name="Faturamento acumulado"
                  stroke={colors.positive}
                  strokeWidth={3}
                  dot={{ r: 4, fill: colors.positive }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="customer-abc-guide">
            <h3>Como interpretar</h3>
            <p>
              A classificação considera o faturamento acumulado no período e nos filtros
              selecionados.
            </p>
            <dl>
              {rows.map((row) => (
                <div key={row.class} className={`abc-class abc-class-${row.class.toLowerCase()}`}>
                  <dt>Classe {row.class}</dt>
                  <dd>
                    <strong>{row.customers.toLocaleString("pt-BR")} clientes</strong>
                    <span>{percent.format(row.customerSharePct)}% da base</span>
                    <span>
                      {percent.format(row.revenueSharePct)}% do faturamento (
                      {money.format(row.revenue)})
                    </span>
                    <small>{CLASS_HELP[row.class]}</small>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      )}

      <button
        type="button"
        className="chart-action"
        onClick={() => navigate({ pathname: "/customers", search: location.search })}
      >
        Ver clientes
      </button>
    </article>
  );
}
