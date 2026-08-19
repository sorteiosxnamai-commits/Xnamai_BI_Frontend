import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { QueryState } from "../feedback/QueryState";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartColors } from "../../theme/useChartColors";
import type { AnalyticsFilters, TimeseriesResponse } from "../../types/analytics";
import { ExportButtons } from "../tables/ExportButtons";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export function RevenueEvolutionChart({
  data,
  filters,
}: {
  data: TimeseriesResponse;
  filters: AnalyticsFilters;
}) {
  const [metric, setMetric] = useState<"revenue" | "orders" | "averageTicket">(
    "revenue"
  );
  const location = useLocation();
  const navigate = useNavigate();
  const colors = useChartColors();
  const settings = {
    revenue: { label: "Faturamento", format: (value: number) => money.format(value) },
    orders: {
      label: "Pedidos",
      format: (value: number) => value.toLocaleString("pt-BR"),
    },
    averageTicket: {
      label: "Ticket médio",
      format: (value: number) => money.format(value),
    },
  }[metric];
  const rows = data.items.map((point, index) => ({
    period: point.period,
    atual: point[metric],
    anterior: data.previousItems[index]?.[metric] ?? null,
  }));
  if (rows.length === 0) {
    return (
      <article className="module-card chart-card">
        <div className="module-heading">
          <div>
            <h2>Evolução comercial</h2>
            <p>Faturamento, pedidos e ticket contra o período anterior.</p>
          </div>
        </div>
        <QueryState loading={false} error={null} empty />
      </article>
    );
  }
  return (
    <article className="module-card chart-card">
      <div className="module-heading">
        <div>
          <h2>Evolução de {settings.label.toLocaleLowerCase("pt-BR")}</h2>
          <p>Vendas válidas no período e comparação com o período anterior.</p>
        </div>
        <div className="table-actions">
          <select
            className="chart-action"
            aria-label="Métrica da evolução"
            value={metric}
            onChange={(event) =>
              setMetric(event.target.value as typeof metric)
            }
          >
            <option value="revenue">Faturamento</option>
            <option value="orders">Pedidos</option>
            <option value="averageTicket">Ticket médio</option>
          </select>
          <Link
            className="chart-action"
            to={{ pathname: "/orders", search: location.search }}
          >
            Detalhes
          </Link>
          <ExportButtons report="orders" filters={filters} />
        </div>
      </div>
      <div className="chart-wrap" role="img" aria-label="Gráfico de evolução do faturamento">
        <ResponsiveContainer width="100%" height={310}>
          <AreaChart
            data={rows}
            onClick={(event) => {
              const period = event?.activeLabel;
              if (typeof period !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(period)) {
                return;
              }
              const params = new URLSearchParams(location.search);
              params.set("dateFrom", period);
              params.set("dateTo", period);
              navigate({ pathname: "/orders", search: params.toString() });
            }}
          >
            <defs>
              <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.accent} stopOpacity={0.35} />
                <stop offset="95%" stopColor={colors.accent} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="period" tick={colors.axis} />
            <YAxis tickFormatter={(value) => settings.format(Number(value))} tick={colors.axis} />
            <Tooltip
              contentStyle={colors.tooltip}
              formatter={(value) => settings.format(Number(value))}
              labelFormatter={(label) => `Período: ${label}`}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="atual"
              name="Período atual"
              stroke={colors.accent}
              fill="url(#revenueFill)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="anterior"
              name="Período anterior"
              stroke={colors.muted}
              fill="transparent"
              strokeDasharray="5 4"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
