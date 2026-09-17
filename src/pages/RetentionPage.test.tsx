import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../hooks/useAnalyticsFilters";

const { cohorts } = vi.hoisted(() => ({ cohorts: vi.fn() }));

vi.mock("../api/client", () => ({
  analyticsApi: { cohorts },
}));

vi.mock("../theme/useChartColors", () => ({
  useChartColors: () => ({
    accent: "#635bdf",
    positive: "#3db68a",
    blue: "#438acb",
    grid: "#e5e8ef",
    axis: { fill: "#747d90", fontSize: 11 },
    tooltip: {},
  }),
}));

import { RetentionPage } from "./RetentionPage";

test("shows retention KPIs, LTV charts and the cohort heatmap", async () => {
  cohorts.mockResolvedValue({
    summary: {
      customers: 3,
      repeatCustomers: 2,
      repeatRate: 66.67,
      month1RetainedCustomers: 2,
      month1EligibleCustomers: 3,
      month1RetentionRate: 66.67,
      totalRevenue: 500,
      realizedLtv: 166.67,
    },
    retentionCurve: [
      { monthOffset: 0, retentionRate: 100, activeCustomers: 3, eligibleCustomers: 3, cohortCount: 2 },
      { monthOffset: 1, retentionRate: 66.67, activeCustomers: 2, eligibleCustomers: 3, cohortCount: 2 },
    ],
    ltvCurve: [
      { monthOffset: 0, ltv: 116.67, cumulativeRevenue: 350, eligibleCustomers: 3, cohortCount: 2 },
      { monthOffset: 1, ltv: 166.67, cumulativeRevenue: 500, eligibleCustomers: 3, cohortCount: 2 },
    ],
    cohorts: [
      {
        cohort: "2026-01",
        size: 2,
        totalRevenue: 200,
        realizedLtv: 100,
        retention: [
          { monthOffset: 0, customers: 2, rate: 100, revenue: 150, cumulativeRevenue: 150, cumulativeLtv: 75 },
          { monthOffset: 1, customers: 1, rate: 50, revenue: 50, cumulativeRevenue: 200, cumulativeLtv: 100 },
        ],
      },
      {
        cohort: "2026-02",
        size: 1,
        totalRevenue: 300,
        realizedLtv: 300,
        retention: [
          { monthOffset: 0, customers: 1, rate: 100, revenue: 200, cumulativeRevenue: 200, cumulativeLtv: 200 },
          { monthOffset: 1, customers: 1, rate: 100, revenue: 100, cumulativeRevenue: 300, cumulativeLtv: 300 },
        ],
      },
    ],
    appliedFilters: {},
    metadata: {
      generatedAt: "2026-03-10T12:00:00Z",
      dataThrough: "2026-03-08T12:00:00Z",
      isPartial: false,
      warnings: [],
      quality: {},
    },
  });
  const onUseAllHistory = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <RetentionPage filters={DEFAULT_FILTERS} onUseAllHistory={onUseAllHistory} />
    </QueryClientProvider>
  );

  expect(await screen.findAllByText("LTV médio observado")).toHaveLength(2);
  expect(screen.getByText("R$ 167")).toBeInTheDocument();
  expect(screen.getByText("Retenção no M+1")).toBeInTheDocument();
  expect(screen.getByText("Como ler esta análise")).toBeInTheDocument();
  expect(screen.getByText("R$ 500 ÷ 3 clientes")).toBeInTheDocument();
  expect(screen.getByText("Como o LTV cresce de M+0 a M+1")).toBeInTheDocument();
  expect(screen.getByText("Retenção mês a mês")).toBeInTheDocument();
  expect(screen.getByText("LTV acumulado até M+1, por coorte")).toBeInTheDocument();
  expect(screen.getByText("Mapa de coortes")).toBeInTheDocument();
  expect(screen.getByText("50%")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "LTV acumulado" }));
  expect(screen.getByText("R$ 100")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Analisar todo o histórico" }));
  expect(onUseAllHistory).toHaveBeenCalledOnce();
});
