import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
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

function cohort(overrides: Record<string, unknown>) {
  return {
    customerCount: 0,
    orderCount: 0,
    revenue: 0,
    revenueSharePct: 0,
    orderSharePct: 0,
    averageMonthlyOrders: 0,
    averageRevenuePerCustomer: 0,
    averageOrderValue: 0,
    members: [],
    membersOmitted: 0,
    ...overrides,
  };
}

test("shows exclusive customer bands with per-customer averages", async () => {
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
      totalRevenue: 613415.37,
      concentrationTop5Pct: 38.2,
      concentrationTop10Pct: 46.4,
      concentrationTop20Pct: 55.8,
      concentrationRestPct: 44.2,
      top5: cohort({
        customerCount: 5,
        orderCount: 29,
        revenue: 234553.15,
        revenueSharePct: 38.2,
        orderSharePct: 6.1,
        averageMonthlyOrders: 5.8,
        averageRevenuePerCustomer: 46910.63,
        averageOrderValue: 8088.04,
        members: [
          {
            id: "c-top",
            name: "Loja Alpha",
            rank: 1,
            revenue: 80000,
            orderCount: 8,
            averageMonthlyOrders: 8,
          },
        ],
      }),
      ranks6to10: cohort({
        customerCount: 5,
        orderCount: 21,
        revenue: 49985.89,
        revenueSharePct: 8.2,
        orderSharePct: 4.3,
        averageMonthlyOrders: 4.2,
        averageRevenuePerCustomer: 9997.18,
        averageOrderValue: 2380.28,
      }),
      ranks11to20: cohort({
        customerCount: 10,
        orderCount: 30,
        revenue: 57742.54,
        revenueSharePct: 9.4,
        orderSharePct: 6.3,
        averageMonthlyOrders: 3,
        averageRevenuePerCustomer: 5774.25,
        averageOrderValue: 1924.75,
      }),
      rest: cohort({
        customerCount: 264,
        orderCount: 399,
        revenue: 271133.79,
        revenueSharePct: 44.2,
        orderSharePct: 83.3,
        averageMonthlyOrders: 1.5,
        averageRevenuePerCustomer: 1027.02,
        averageOrderValue: 679.53,
      }),
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

  expect(await screen.findByText(/Faturamento do período/)).toBeInTheDocument();
  expect(screen.getByText("R$ 613.415,37")).toBeInTheDocument();
  expect(screen.getByText("Top 5")).toBeInTheDocument();
  expect(screen.getByText("6º ao 10º")).toBeInTheDocument();
  expect(screen.getByText("11º ao 20º")).toBeInTheDocument();
  expect(screen.getByText("Demais clientes")).toBeInTheDocument();
  expect(screen.getByText("38,2%")).toBeInTheDocument();
  expect(screen.getByText("8,2%")).toBeInTheDocument();
  expect(screen.getByText("9,4%")).toBeInTheDocument();
  expect(screen.getByText("44,2%")).toBeInTheDocument();
  expect(screen.getAllByText("Por cliente")).toHaveLength(4);
  expect(screen.getByText("R$ 46.910,63")).toBeInTheDocument();
  expect(screen.getByText("R$ 8.088,04")).toBeInTheDocument();
  expect(screen.getByText("5,8")).toBeInTheDocument();
  expect(screen.getByText(/264 clientes/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Top 5/ }));
  expect(screen.getByText("Top 5: 5 clientes")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Abrir perfil do cliente Loja Alpha" })).toBeInTheDocument();
});
