import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";

const { leads, lead, finish } = vi.hoisted(() => ({
  leads: vi.fn(),
  lead: vi.fn(),
  finish: vi.fn(),
}));

vi.mock("./crmApi", () => ({
  crmApi: {
    configured: true,
    leads,
    lead,
    claim: vi.fn(),
    finish,
    dashboard: vi.fn(),
  },
}));

import { CrmLeadsPage } from "./CrmLeadsPage";

const sample = {
  count: 2,
  topCount: 1,
  queuePage: 1,
  hasMore: true,
  top: [
    {
      id: "c-top",
      name: "Top Cliente",
      city: "Sao Paulo",
      state: "SP",
      email: "a@a.com",
      phone: "1199",
      segment: "ativo",
      orders: 3,
      revenue: 5000,
      ticketAverage: 1666,
      firstOrderAt: "2026-01-01T00:00:00Z",
      lastOrderAt: "2026-08-01T00:00:00Z",
      daysSinceLastOrder: 24,
      attendanceStatus: "open",
      lastProducts: [{ name: "Fone X", quantity: 3, total: 300 }],
    },
  ],
  queue: [
    {
      id: "c-queue",
      name: "Fila Cliente",
      city: "Campinas",
      state: "SP",
      email: null,
      phone: null,
      segment: "em_risco",
      orders: 1,
      revenue: 80,
      ticketAverage: 80,
      firstOrderAt: "2026-07-01T00:00:00Z",
      lastOrderAt: "2026-07-01T00:00:00Z",
      daysSinceLastOrder: 55,
      attendanceStatus: "open",
      lastProducts: [],
    },
  ],
  inProgress: 0,
  open: 2,
  queueTotal: 1,
};

test("lista Top 20 separado da fila e permite finalizar atendimento", async () => {
  leads.mockResolvedValue(sample);
  lead.mockResolvedValue({
    ...sample.top[0],
    mostBoughtProducts: [{ name: "Fone X", quantity: 3, revenue: 300, total: 300 }],
    orderHistory: [
      { id: "o1", number: "100", status: "2", date: "2026-08-01", total: 5000, items: [] },
    ],
  });
  finish.mockResolvedValue({ id: "c-top", status: "finished" });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CrmLeadsPage />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Top Cliente")).toBeInTheDocument();
  expect(screen.getByText("Fila Cliente")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Top Cliente/ }));
  expect(await screen.findByText("Ultimos produtos comprados")).toBeInTheDocument();

  fireEvent.change(screen.getByPlaceholderText("Ex.: Ana Souza"), { target: { value: "Ana" } });
  fireEvent.click(screen.getByRole("button", { name: "Finalizar atendimento" }));

  await waitFor(() => expect(finish).toHaveBeenCalled());
});

test("carregar mais acumula fila sem refazer a query principal", async () => {
  leads.mockImplementation(({ queuePage = 1 }: { queuePage?: number }) =>
    Promise.resolve({
      ...sample,
      queuePage,
      hasMore: queuePage === 1,
      queue:
        queuePage === 1
          ? sample.queue
          : [
              {
                id: "c-more",
                name: "Mais Cliente",
                city: "Ribeirao",
                state: "SP",
                email: null,
                phone: null,
                segment: "ativo",
                orders: 2,
                revenue: 120,
                ticketAverage: 60,
                firstOrderAt: "2026-06-01T00:00:00Z",
                lastOrderAt: "2026-06-01T00:00:00Z",
                daysSinceLastOrder: 85,
                attendanceStatus: "open",
                lastProducts: [],
              },
            ],
    }),
  );

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CrmLeadsPage />
    </QueryClientProvider>,
  );

  expect(await screen.findByText("Fila Cliente")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }));
  expect(await screen.findByText("Mais Cliente")).toBeInTheDocument();
  expect(screen.getByText("Fila Cliente")).toBeInTheDocument();
  expect(leads).toHaveBeenLastCalledWith(
    expect.objectContaining({ queuePage: 2 }),
  );
});
