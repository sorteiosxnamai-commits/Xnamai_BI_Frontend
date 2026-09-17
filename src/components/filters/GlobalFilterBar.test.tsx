import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../../hooks/useAnalyticsFilters";

const { filterOptions } = vi.hoisted(() => ({
  filterOptions: vi.fn(),
}));
vi.mock("../../api/client", () => ({
  analyticsApi: { filterOptions },
}));

import { GlobalFilterBar } from "./GlobalFilterBar";

function renderFilters(
  onChange = vi.fn(),
  filters = DEFAULT_FILTERS,
  activeCount = 0
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <GlobalFilterBar
        filters={filters}
        activeCount={activeCount}
        onChange={onChange}
        onClear={vi.fn()}
      />
    </QueryClientProvider>
  );
  return onChange;
}

beforeEach(() => {
  filterOptions.mockReset();
  filterOptions.mockResolvedValue({
    items: [
      { id: "2", label: "Faturado" },
      { id: "3", label: "Cancelado" },
    ],
    page: 1,
    pageSize: 100,
    totalItems: 2,
    totalPages: 1,
    option: "statuses",
  });
});

afterEach(cleanup);

test("organizes the period and removes individual filter chips", () => {
  const onChange = vi.fn();
  const filters = {
    ...DEFAULT_FILTERS,
    period: "90d" as const,
    statuses: ["2"],
    excludedCustomerIds: ["c1"],
  };

  renderFilters(onChange, filters, 3);

  fireEvent.change(screen.getByLabelText("Granularidade"), {
    target: { value: "month" },
  });
  expect(onChange).toHaveBeenCalledWith({ granularity: "month" });

  fireEvent.change(screen.getByLabelText("Período"), {
    target: { value: "ytd" },
  });
  expect(onChange).toHaveBeenCalledWith({
    period: "ytd",
    dateFrom: undefined,
    dateTo: undefined,
    granularity: "month",
  });

  fireEvent.click(screen.getByRole("button", { name: "Remover filtro Status: 1" }));
  expect(onChange).toHaveBeenCalledWith({ statuses: [] });

  fireEvent.click(
    screen.getByRole("button", { name: "Remover filtro Excluídos da conta: 1" })
  );
  expect(onChange).toHaveBeenCalledWith({ excludedCustomerIds: [] });
});

test("searches options and selects them with checkboxes", async () => {
  const onChange = renderFilters();

  fireEvent.click(screen.getByRole("button", { name: "Mostrar filtros detalhados" }));
  fireEvent.click(screen.getByText("Status"));

  expect(await screen.findByRole("checkbox", { name: "Faturado" })).toBeVisible();
  fireEvent.change(screen.getByRole("searchbox", { name: "Buscar em Status" }), {
    target: { value: "faturado" },
  });

  await waitFor(() => {
    expect(filterOptions).toHaveBeenLastCalledWith("statuses", "faturado", 1, []);
  });

  fireEvent.click(screen.getByRole("checkbox", { name: "Faturado" }));
  expect(onChange).toHaveBeenCalledWith({ statuses: ["2"] });
});
