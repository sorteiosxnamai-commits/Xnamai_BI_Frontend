import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../hooks/useAnalyticsFilters";

const { customers } = vi.hoisted(() => ({ customers: vi.fn() }));

vi.mock("../api/client", () => ({
  analyticsApi: {
    customers,
    customerDetail: vi.fn(),
    exportReport: vi.fn(),
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { username: "viewer", role: "viewer" } }),
}));

import { CustomersPage } from "./CustomersPage";

test("shows monthly order averages and revenue share for customer cohorts", async () => {
  customers.mockResolvedValue({
    items: [
      {
        id: "c1",
        name: "Cliente A",
        city: "São Paulo",
        state: "SP",
        segmentId: null,
        active: true,
        orderCount: 3,
        revenue: 15000,
        revenueShare: 65,
        cumulativeRevenueShare: 65,
        abcClass: "A",
        averageTicket: 5000,
        firstOrderAt: "2026-08-01T12:00:00Z",
        lastOrderAt: "2026-08-10T12:00:00Z",
        daysSinceLastOrder: 6,
        averageOrderIntervalDays: 4,
        recency: 6,
        frequency: 3,
        monetary: 15000,
        rfm: { recency: 5, frequency: 5, monetary: 5, score: 15, segment: "campeões" },
      },
    ],
    page: 1,
    pageSize: 50,
    totalItems: 1,
    totalPages: 1,
    sort: "revenue",
    order: "desc",
    appliedFilters: DEFAULT_FILTERS,
    metadata: {
      generatedAt: "2026-08-16T12:00:00Z",
      dataThrough: "2026-08-16T12:00:00Z",
      isPartial: false,
      warnings: [],
      quality: {},
    },
    summary: {
      periodMonths: 1,
      concentrationTop5Pct: 38.2,
      concentrationTop10Pct: 46.4,
      concentrationTop20Pct: 55.8,
      concentrationRestPct: 44.2,
      top5: {
        customerCount: 5,
        revenue: 38200,
        revenueSharePct: 38.2,
        orderSharePct: 20,
        averageMonthlyOrders: 4.1,
      },
      top10: {
        customerCount: 10,
        revenue: 46400,
        revenueSharePct: 46.4,
        orderSharePct: 28,
        averageMonthlyOrders: 3.2,
      },
      top20: {
        customerCount: 20,
        revenue: 55800,
        revenueSharePct: 55.8,
        orderSharePct: 40,
        averageMonthlyOrders: 2.4,
      },
      rest: {
        customerCount: 180,
        revenue: 44200,
        revenueSharePct: 44.2,
        orderSharePct: 60,
        averageMonthlyOrders: 0.4,
      },
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <CustomersPage filters={DEFAULT_FILTERS} />
    </QueryClientProvider>
  );

  expect(await screen.findByText("Top 5")).toBeInTheDocument();
  expect(screen.getByText("38,2%")).toBeInTheDocument();
  expect(screen.getByText(/Média de 4,1 pedidos\/mês/)).toBeInTheDocument();
  expect(screen.getByText("Demais clientes")).toBeInTheDocument();
  expect(screen.getByText("44,2%")).toBeInTheDocument();
  expect(screen.getByText(/Média de 0,4 pedidos\/mês/)).toBeInTheDocument();
  expect(screen.getByText(/180 clientes/)).toBeInTheDocument();
});
