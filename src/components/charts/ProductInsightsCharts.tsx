import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "../../theme/useChartColors";
import type { ProductInsightsResponse } from "../../types/analytics";
import { QueryState } from "../feedback/QueryState";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
});

const CLASSIFICATION_LABEL: Record<string, string> = {
  classe_a: "Classe A",
  classe_b: "Classe B",
  classe_c: "Classe C",
  sem_estoque: "Sem estoque",
  sem_venda_periodo: "Sem venda no periodo",
};

function pct(value: number) {
  return `${percent.format(value)}%`;
}

export function ProductInsightsCharts({
  data,
  loading,
  error,
  onRetry,
}: {
  data: ProductInsightsResponse | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const colors = useChartColors();
  const series = colors.series;

  if (loading || error) {
    return <QueryState loading={loading} error={error} onRetry={onRetry} />;
  }
  if (!data || (!data.productAbc.length && !data.pareto.length)) {
    return <QueryState loading={false} error={null} empty />;
  }

  const summary = data.summary;
  const abcShare = data.productAbc.map((item) => ({
    ...item,
    label: `Classe ${item.class}`,
  }));
  const paretoChart = data.pareto.map((item) => ({
    rank: `#${item.rank}`,
    name: (item.name || item.code || item.id).slice(0, 20),
    revenue: Number(item.revenue),
    cumulativeSharePct: Number(item.cumulativeSharePct),
  }));
  const quantityShare = data.topByQuantity.map((item) => ({
    name: (item.name || item.id).slice(0, 20),
    quantitySharePct: Number(item.quantitySharePct),
    quantitySold: Number(item.quantitySold),
  }));
  const mix = data.classificationMix.map((item) => ({
    ...item,
    label: CLASSIFICATION_LABEL[item.classification] || item.classification,
  }));
  const cross = data.quantityVsRevenue.map((item) => ({
    name: item.name,
    quantitySold: Number(item.quantitySold),
    revenue: Number(item.revenue),
  }));
  const concentrationPct =
    summary.productsWithSales > 0
      ? (summary.productsFor80Pct / summary.productsWithSales) * 100
      : 0;

  return (
    <div className="page-stack product-insights">
      <section className="metric-grid compact">
        <article className="metric-card">
          <span>SKUs com venda</span>
          <strong>{number.format(summary.productsWithSales)}</strong>
          <p>Produtos com faturamento no periodo</p>
        </article>
        <article className="metric-card">
          <span>Concentracao 80%</span>
          <strong>{number.format(summary.productsFor80Pct)} SKUs</strong>
          <p>{pct(concentrationPct)} do mix gera cerca de 80% do faturamento</p>
        </article>
        <article className="metric-card">
          <span>Top 10</span>
          <strong>{pct(summary.top10RevenueSharePct)}</strong>
          <p>Participacao dos 10 maiores no faturamento</p>
        </article>
        <article className="metric-card">
          <span>Top 20</span>
          <strong>{pct(summary.top20RevenueSharePct)}</strong>
          <p>Participacao dos 20 maiores no faturamento</p>
        </article>
        <article className="metric-card">
          <span>Receita media / SKU</span>
          <strong>{money.format(summary.averageRevenuePerSku)}</strong>
          <p>Faturamento medio por produto vendido</p>
        </article>
      </section>

      <section className="breakdown-grid">
        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>Curva ABC (participacao %)</h2>
              <p>Fatia do faturamento e do numero de SKUs por classe.</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Participacao percentual da curva ABC">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={abcShare}
                  dataKey="revenueSharePct"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={98}
                  label={({ name, value }) => `${name}: ${pct(Number(value))}`}
                >
                  {abcShare.map((item, index) => (
                    <Cell key={item.class} fill={series[index % series.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value, _name, item) => {
                    const payload = item?.payload as {
                      entitySharePct?: number;
                      revenue?: number;
                    };
                    return [
                      `${pct(Number(value))} fat. | ${pct(Number(payload?.entitySharePct || 0))} SKUs | ${money.format(Number(payload?.revenue || 0))}`,
                      "Participacao",
                    ];
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="insight-legend">
            {abcShare.map((item) => (
              <li key={item.class}>
                <strong>Classe {item.class}</strong>
                <span>
                  {pct(item.revenueSharePct)} do faturamento · {pct(item.entitySharePct)} dos SKUs (
                  {number.format(item.entities)})
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>Pareto de faturamento</h2>
              <p>Barras = receita; linha = acumulado % (curva ABC classica).</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Curva Pareto ABC de produtos">
            <ResponsiveContainer width="100%" height={300}>
              <ComposedChart data={paretoChart}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="rank" tick={colors.axis} />
                <YAxis
                  yAxisId="left"
                  tick={colors.axis}
                  tickFormatter={(value) => money.format(Number(value))}
                  width={72}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={[0, 100]}
                  tick={colors.axis}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value, name) =>
                    name === "Acumulado %"
                      ? [pct(Number(value)), name]
                      : [money.format(Number(value)), "Faturamento"]
                  }
                  labelFormatter={(_, payload) =>
                    String((payload?.[0]?.payload as { name?: string } | undefined)?.name || "")
                  }
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="revenue"
                  name="Faturamento"
                  fill={colors.accent}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="cumulativeSharePct"
                  name="Acumulado %"
                  stroke={series[1] || "#2d9b6a"}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>Mix de classificacao (%)</h2>
              <p>Distribuicao simples do catalogo com venda no periodo.</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Mix percentual de classificacao">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={mix}
                  dataKey="sharePct"
                  nameKey="label"
                  outerRadius={105}
                  label={({ name, value }) => `${name}: ${pct(Number(value))}`}
                >
                  {mix.map((item, index) => (
                    <Cell key={item.classification} fill={series[index % series.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value, _name, item) => [
                    `${pct(Number(value))} (${number.format(
                      Number((item?.payload as { products?: number })?.products || 0),
                    )} SKUs)`,
                    "Participacao",
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <section className="overview-charts">
        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>Cruzamento quantidade x faturamento</h2>
              <p>Top produtos: volume fisico versus receita gerada.</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Quantidade versus faturamento">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={cross}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={colors.axis}
                  interval={0}
                  angle={-18}
                  textAnchor="end"
                  height={70}
                />
                <YAxis yAxisId="left" tick={colors.axis} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={colors.axis}
                  tickFormatter={(value) => money.format(Number(value))}
                  width={72}
                />
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value, name) =>
                    name === "Faturamento"
                      ? [money.format(Number(value)), name]
                      : [number.format(Number(value)), "Quantidade"]
                  }
                />
                <Legend />
                <Bar
                  yAxisId="left"
                  dataKey="quantitySold"
                  name="Quantidade"
                  fill={series[0]}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  yAxisId="right"
                  dataKey="revenue"
                  name="Faturamento"
                  fill={series[1]}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="module-card">
          <div className="module-heading">
            <div>
              <h2>Top 10 por quantidade (%)</h2>
              <p>Participacao no volume vendido do periodo.</p>
            </div>
          </div>
          <div className="chart-wrap" role="img" aria-label="Participacao percentual por quantidade">
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={quantityShare} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={colors.axis} tickFormatter={(value) => `${value}%`} />
                <YAxis type="category" dataKey="name" width={110} tick={colors.axis} />
                <Tooltip
                  contentStyle={colors.tooltip}
                  formatter={(value, _name, item) => [
                    `${pct(Number(value))} (${number.format(
                      Number((item?.payload as { quantitySold?: number })?.quantitySold || 0),
                    )} un.)`,
                    "Share de quantidade",
                  ]}
                />
                <Bar
                  dataKey="quantitySharePct"
                  name="Share %"
                  fill={colors.accent}
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </div>
  );
}
