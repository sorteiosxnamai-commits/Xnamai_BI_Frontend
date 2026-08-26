import { useLocation, useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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

export function CommercialBreakdownCharts({
  data,
  filters,
}: {
  data: BreakdownsResponse;
  filters: AnalyticsFilters;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const colors = useChartColors();
  const series = colors.series;

  const filterOrders = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(location.search);
    for (const [key, value] of Object.entries(updates)) {
      params.delete(key);
      if (value != null) params.append(key, value);
    }
    navigate({ pathname: "/orders", search: params.toString() });
  };

  return (
    <section className="breakdown-grid">
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Status dos pedidos</h2>
            <p>Distribuição de todos os pedidos nos filtros aplicados.</p>
          </div>
          <ExportButtons report="orders" filters={filters} />
        </div>
        {data.statuses.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
        <div className="chart-wrap" role="img" aria-label="Distribuição dos status dos pedidos">
          <ResponsiveContainer width="100%" height={310}>
            <PieChart>
              <Pie
                data={data.statuses}
                dataKey="orders"
                nameKey="status"
                innerRadius={65}
                outerRadius={105}
                onClick={(entry) => {
                  const status = (entry.payload as { status?: string } | undefined)?.status;
                  if (status) filterOrders({ statuses: status });
                }}
              >
                {data.statuses.map((status, index) => (
                  <Cell key={status.status} fill={series[index % series.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={colors.tooltip}
                formatter={(value) => Number(value).toLocaleString("pt-BR")}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        )}
        <button type="button" onClick={() => navigate({ pathname: "/orders", search: location.search })}>
          Ver detalhes
        </button>
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Curva ABC de produtos</h2>
            <p>Participação das classes no faturamento de itens válidos.</p>
          </div>
          <ExportButtons report="products" filters={filters} />
        </div>
        {data.productAbc.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
        <div className="chart-wrap" role="img" aria-label="Curva ABC dos produtos">
          <ResponsiveContainer width="100%" height={310}>
            <PieChart>
              <Pie
                data={data.productAbc.map((item) => ({
                  ...item,
                  label: `Classe ${item.class}`,
                  share:
                    item.revenueSharePct ??
                    (data.productAbc.reduce((sum, row) => sum + row.revenue, 0) > 0
                      ? (item.revenue /
                          data.productAbc.reduce((sum, row) => sum + row.revenue, 0)) *
                        100
                      : 0),
                }))}
                dataKey="share"
                nameKey="label"
                innerRadius={65}
                outerRadius={105}
                label={({ name, value }) => `${name}: ${Number(value).toFixed(1)}%`}
                onClick={(entry) => {
                  const abcClass = (entry.payload as { class?: string } | undefined)?.class;
                  navigate({
                    pathname: "/products",
                    search: location.search,
                    hash: abcClass ? `abc-${abcClass}` : "",
                  });
                }}
              >
                {data.productAbc.map((item, index) => (
                  <Cell key={item.class} fill={series[index % series.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={colors.tooltip}
                formatter={(value, _name, item) => {
                  const payload = item?.payload as {
                    revenue?: number;
                    entities?: number;
                    entitySharePct?: number;
                  };
                  return [
                    `${Number(value).toFixed(1)}% | ${money.format(Number(payload?.revenue || 0))} | ${Number(payload?.entities || 0)} SKUs`,
                    "Participacao",
                  ];
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        )}
        <button type="button" onClick={() => navigate({ pathname: "/products", search: location.search })}>
          Ver produtos
        </button>
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Pedidos por faixa de valor</h2>
            <p>Quantidade de vendas válidas por faixa de valor líquido.</p>
          </div>
          <ExportButtons report="orders" filters={filters} />
        </div>
        {data.orderValueBands.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
        <div className="chart-wrap" role="img" aria-label="Pedidos por faixa de valor">
          <ResponsiveContainer width="100%" height={310}>
            <BarChart data={data.orderValueBands}>
              <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="band" tick={colors.axis} />
              <YAxis allowDecimals={false} tick={colors.axis} />
              <Tooltip contentStyle={colors.tooltip} />
              <Legend />
              <Bar dataKey="orders" name="Pedidos" fill={colors.accent} radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </article>
    </section>
  );
}
