import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../../hooks/useAnalyticsFilters";

const { filterOptions } = vi.hoisted(() => ({
  filterOptions: vi.fn().mockResolvedValue({
    items: [],
    page: 1,
    pageSize: 100,
    totalItems: 0,
    totalPages: 0,
    option: "empty",
  }),
}));
vi.mock("../../api/client", () => ({
  analyticsApi: { filterOptions },
}));

import { GlobalFilterBar } from "./GlobalFilterBar";

test("exposes granularity and removes individual filter chips", () => {
  const onChange = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const filters = {
    ...DEFAULT_FILTERS,
    period: "90d" as const,
    statuses: ["2"],
  };

  render(
    <QueryClientProvider client={client}>
      <GlobalFilterBar
        filters={filters}
        activeCount={2}
        onChange={onChange}
        onClear={vi.fn()}
      />
    </QueryClientProvider>
  );

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
});
