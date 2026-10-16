import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../hooks/useAnalyticsFilters";

const { b2bCarts } = vi.hoisted(() => ({ b2bCarts: vi.fn() }));
vi.mock("../api/client", () => ({ analyticsApi: { b2bCarts } }));
import { B2bCartsPage } from "./B2bCartsPage";

test("shows partial coverage, value difference and requests the selected abandonment threshold", async () => {
  b2bCarts.mockResolvedValue({
    summary: {
      identified: { count: 3, value: 600 },
      converted: { count: 1, value: 200 },
      openTotal: { count: 2, value: 400 },
      possible_abandonment: { count: 1, value: 300 },
      completed_quote: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 },
      other: { count: 0, value: 0 },
      conversionRate: 33.33,
      abandonedMinusConvertedValue: 100,
    },
    items: [
      {
        id: "1",
        number: "123",
        customerName: "Cliente teste",
        sellerName: null,
        stage: "possible_abandonment",
        total: 300,
        createdAt: null,
        updatedAt: null,
      },
    ],
    totalItems: 1,
    totalPages: 1,
    metadata: {
      generatedAt: "2026-10-16T15:00:00Z",
      dataThrough: null,
      isPartial: true,
      warnings: ["Cobertura de carrinhos ainda não validada."],
      quality: {},
    },
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <B2bCartsPage
        filters={DEFAULT_FILTERS}
        filterBar={<section aria-label="Filtros da análise">Filtros</section>}
      />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Cliente teste")).toBeInTheDocument();
  expect(screen.getByText("Dados parciais")).toBeInTheDocument();
  expect(screen.getByText("33,33%")).toBeInTheDocument();
  expect(screen.getByText("Abandonos possíveis − convertidos")).toBeInTheDocument();
  expect(screen.getByText("Cobertura de carrinhos ainda não validada.")).toBeInTheDocument();
  const indicators = screen.getByRole("region", { name: "Indicadores macro de carrinhos" });
  const filters = screen.getByRole("region", { name: "Filtros da análise" });
  expect(
    indicators.compareDocumentPosition(filters) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Possível abandono após"), { target: { value: "48" } });
  await waitFor(() => expect(b2bCarts).toHaveBeenLastCalledWith(DEFAULT_FILTERS, 48, 1, "all"));
  fireEvent.change(screen.getByLabelText("Situação da listagem"), {
    target: { value: "converted" },
  });
  await waitFor(() =>
    expect(b2bCarts).toHaveBeenLastCalledWith(DEFAULT_FILTERS, 48, 1, "converted"),
  );
  client.clear();
});

test("keeps macro indicators visible without inventing zero values on load failure", async () => {
  b2bCarts.mockRejectedValue(new Error("Tempo esgotado ao consultar o BI."));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <B2bCartsPage filters={DEFAULT_FILTERS} />
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Tempo esgotado ao consultar o BI.")).toBeInTheDocument();
  expect(
    screen.getByRole("region", { name: "Indicadores macro de carrinhos" }),
  ).toBeInTheDocument();
  expect(screen.getAllByText("—")).toHaveLength(8);
  expect(screen.queryByText("0")).not.toBeInTheDocument();
  client.clear();
});
