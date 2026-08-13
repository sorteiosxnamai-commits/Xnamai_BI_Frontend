import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { analyticsApi } from "../api/client";
import { BuyerCompositionChart } from "../components/charts/BuyerCompositionChart";
import { CommercialBreakdownCharts } from "../components/charts/CommercialBreakdownCharts";
import { RevenueEvolutionChart } from "../components/charts/RevenueEvolutionChart";
import { MetadataStatus, QueryState } from "../components/feedback/QueryState";
import type { AnalyticsFilters, KpiValue } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

const KPI_LABELS: Record<string, string> = {
  grossRevenue: "Faturamento bruto",
  netRevenue: "Faturamento líquido",
  orders: "Pedidos válidos",
  averageTicket: "Ticket médio",
  customers: "Compradores únicos",
  newBuyers: "Novos compradores",
  recurringBuyers: "Compradores recorrentes",
  cancellations: "Cancelamentos",
  cancellationRate: "Taxa de cancelamento",
  cancelledValue: "Valor cancelado",
  discountTotal: "Desconto total",
  averageDiscountPct: "Desconto médio",
  items: "Itens",
  skus: "SKUs",
  itemsPerOrder: "Itens por pedido",
};

function formatKpi(key: string, value: number) {
  if (
    ["grossRevenue", "netRevenue", "averageTicket", "cancelledValue", "discountTotal"].includes(
      key
    )
  ) {
    return money.format(value);
  }
  if (key.endsWith("Rate") || key.endsWith("Pct")) return `${number.format(value)}%`;
  return number.format(value);
}

function KpiCard({
  name,
  kpi,
  search,
}: {
  name: string;
  kpi: KpiValue;
  search: string;
}) {
  const customerKpis = ["customers", "newBuyers", "recurringBuyers"];
  const productKpis = ["items", "skus", "itemsPerOrder"];
  const pathname = customerKpis.includes(name)
    ? "/customers"
    : productKpis.includes(name)
      ? "/products"
      : "/orders";
  const params = new URLSearchParams(search);
  if (["cancellations", "cancellationRate", "cancelledValue"].includes(name)) {
    params.delete("statuses");
    ["0", "cancelado", "cancelled", "canceled"].forEach((status) => {
      params.append("statuses", status);
    });
  }
  return (
    <Link className="metric-link" to={{ pathname, search: params.toString() }}>
      <article className="metric-card" title={kpi.definition}>
        <span>{KPI_LABELS[name] || name}</span>
        <strong>{formatKpi(name, kpi.value)}</strong>
        <small className={kpi.isPositive ? "positive" : "negative"}>
          {kpi.percentageChange == null
            ? "Sem base de comparação"
            : `${kpi.percentageChange >= 0 ? "+" : ""}${number.format(
                kpi.percentageChange
              )}% vs. anterior`}
        </small>
        <p>{kpi.definition}</p>
      </article>
    </Link>
  );
}

export function OverviewPage({ filters }: { filters: AnalyticsFilters }) {
  const location = useLocation();
  const overview = useQuery({
    queryKey: ["analytics", "overview", filters],
    queryFn: () => analyticsApi.overview(filters),
  });
  const series = useQuery({
    queryKey: ["analytics", "timeseries", filters],
    queryFn: () => analyticsApi.timeseries(filters),
  });
  const breakdowns = useQuery({
    queryKey: ["analytics", "breakdowns", filters],
    queryFn: () => analyticsApi.breakdowns(filters),
  });

  const error = (overview.error || series.error) as Error | null;
  if (overview.isError || !overview.data) {
    return (
      <QueryState
        loading={overview.isLoading}
        error={error}
        onRetry={() => {
          void overview.refetch();
          void series.refetch();
        }}
      />
    );
  }

  return (
    <div className="page-stack">
      <MetadataStatus metadata={overview.data.metadata} />
      <section className="metric-grid">
        {Object.entries(overview.data.kpis).map(([name, kpi]) => (
          <KpiCard key={name} name={name} kpi={kpi} search={location.search} />
        ))}
      </section>
      <section className="overview-charts">
        {series.data && !series.isError ? (
          <RevenueEvolutionChart data={series.data} filters={filters} />
        ) : (
          <QueryState
            loading={series.isLoading}
            error={series.error as Error | null}
            onRetry={() => void series.refetch()}
          />
        )}
        <BuyerCompositionChart data={overview.data} filters={filters} />
      </section>
      {breakdowns.data && !breakdowns.isError ? (
        <CommercialBreakdownCharts data={breakdowns.data} filters={filters} />
      ) : (
        <QueryState
          loading={breakdowns.isLoading}
          error={breakdowns.error as Error | null}
          onRetry={() => void breakdowns.refetch()}
        />
      )}
    </div>
  );
}
