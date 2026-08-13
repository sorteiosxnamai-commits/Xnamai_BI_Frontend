import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../hooks/useAnalyticsFilters";

const { orders } = vi.hoisted(() => ({ orders: vi.fn() }));

vi.mock("../api/client", () => ({
  analyticsApi: {
    orders,
    orderDetail: vi.fn(),
    exportReport: vi.fn(),
  },
}));

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { username: "viewer", role: "viewer" } }),
}));

import { OrdersPage } from "./OrdersPage";

const response = {
  items: [
    {
      id: "o1",
      number: "1",
      issuedAt: "2026-08-12T12:00:00Z",
      customerId: "c1",
      customerName: "Cliente",
      sellerId: "s1",
      sellerName: "Vendedor",
      status: "2",
      grossTotal: 100,
      netTotal: 100,
      total: 100,
      discount: 0,
      itemCount: 1,
      skuCount: 1,
      city: "São Paulo",
      state: "SP",
    },
  ],
  page: 1,
  pageSize: 50,
  totalItems: 1,
  totalPages: 1,
  sort: "issued_at",
  order: "desc",
  appliedFilters: DEFAULT_FILTERS,
  metadata: {
    generatedAt: "2026-08-12T12:00:00Z",
    dataThrough: "2026-08-12T12:00:00Z",
    isPartial: false,
    warnings: [],
    quality: { ordersWithItemsPct: 100 },
  },
};

test("sends header sorting to the backend instead of sorting only the page", async () => {
  orders.mockResolvedValue(response);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <OrdersPage filters={DEFAULT_FILTERS} />
    </QueryClientProvider>
  );

  expect(await screen.findByRole("cell", { name: "Cliente" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Total" }));

  await waitFor(() =>
    expect(orders).toHaveBeenLastCalledWith(
      DEFAULT_FILTERS,
      expect.objectContaining({ sort: "total", order: "desc" })
    )
  );
});
