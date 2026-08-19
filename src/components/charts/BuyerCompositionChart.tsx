import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useChartColors } from "../../theme/useChartColors";
import type { AnalyticsFilters, OverviewResponse } from "../../types/analytics";
import { QueryState } from "../feedback/QueryState";
import { ExportButtons } from "../tables/ExportButtons";

export function BuyerCompositionChart({
  data,
  filters,
}: {
  data: OverviewResponse;
  filters: AnalyticsFilters;
}) {
  const colors = useChartColors();
  const rows = [
    { name: "Novos", value: data.kpis.newBuyers?.value || 0 },
    { name: "Recorrentes", value: data.kpis.recurringBuyers?.value || 0 },
  ];
  return (
    <article className="module-card chart-card">
      <div className="module-heading">
        <div>
          <h2>Novos versus recorrentes</h2>
          <p>
            Novos compraram pela primeira vez no período; recorrentes já tinham
            compra válida anterior.
          </p>
        </div>
        <ExportButtons report="customers" filters={filters} />
      </div>
      {rows.every((row) => row.value === 0) ? (
        <QueryState loading={false} error={null} empty />
      ) : (
      <div className="chart-wrap" role="img" aria-label="Composição de compradores">
        <ResponsiveContainer width="100%" height={310}>
          <PieChart>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              innerRadius={65}
              outerRadius={105}
              paddingAngle={3}
            >
              <Cell fill={colors.accent} />
              <Cell fill={colors.positive} />
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
    </article>
  );
}
