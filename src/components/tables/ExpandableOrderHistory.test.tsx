import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../../hooks/useAnalyticsFilters";
import { ExpandableOrderHistory } from "./ExpandableOrderHistory";

const { orderDetail } = vi.hoisted(() => ({ orderDetail: vi.fn() }));

vi.mock("../../api/client", () => ({
  analyticsApi: { orderDetail },
}));

const order = {
  id: "163466337",
  number: "93140",
  issuedAt: "2026-08-10T12:00:00Z",
  customerId: "c1",
  customerName: "Ricardo Mai",
  sellerId: "s1",
  sellerName: "Wagner Lima",
  status: "2",
  grossTotal: 1017.67,
  netTotal: 1017.67,
  total: 1017.67,
  discount: 0,
  itemCount: 1,
  skuCount: 1,
  city: "São Paulo",
  state: "SP",
};

test("expands an order row and loads its items", async () => {
  orderDetail.mockResolvedValue({
    order,
    items: [
      {
        id: "i1",
        position: 0,
        productId: "p1",
        code: "CT20S",
        name: "Bicicleta Elétrica",
        quantity: 1,
        unitPrice: 13800,
        sourceUnitPrice: 13800,
        discount: 0,
        total: 13800,
        sourceTotal: 13800,
        priceSource: "catalog",
      },
    ],
    metadata: {
      generatedAt: "2026-08-13T12:00:00Z",
      dataThrough: "2026-08-13T12:00:00Z",
      isPartial: false,
      warnings: [],
      quality: { ordersWithItemsPct: 100 },
    },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ExpandableOrderHistory
        orders={[order]}
        filters={DEFAULT_FILTERS}
        extraColumn="seller"
      />
    </QueryClientProvider>
  );

  fireEvent.click(screen.getByRole("button", { name: /93140/ }));
  expect(await screen.findByText("Bicicleta Elétrica")).toBeInTheDocument();
  await waitFor(() =>
    expect(orderDetail).toHaveBeenCalledWith("163466337", DEFAULT_FILTERS)
  );
});
