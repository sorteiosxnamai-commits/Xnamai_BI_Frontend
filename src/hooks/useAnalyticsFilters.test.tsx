import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import { useAnalyticsFilters } from "./useAnalyticsFilters";

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter
      initialEntries={[
        "/overview?period=90d&statuses=2&statuses=0&states=SP&activeOnly=true&excludedCustomerIds=c1",
      ]}
    >
      {children}
    </MemoryRouter>
  );
}

test("restores filters from URL and updates combined state", () => {
  const { result } = renderHook(() => useAnalyticsFilters(), { wrapper });

  expect(result.current.filters.period).toBe("90d");
  expect(result.current.filters.statuses).toEqual(["2", "0"]);
  expect(result.current.filters.states).toEqual(["SP"]);
  expect(result.current.filters.activeOnly).toBe(true);
  expect(result.current.filters.excludedCustomerIds).toEqual(["c1"]);
  expect(result.current.activeCount).toBe(5);

  act(() => {
    result.current.updateFilters({ cities: ["São Paulo"], minValue: 100 });
  });

  expect(result.current.filters.cities).toEqual(["São Paulo"]);
  expect(result.current.filters.minValue).toBe(100);
  expect(result.current.filters.statuses).toEqual(["2", "0"]);

  act(() => result.current.clearFilters());
  expect(result.current.filters.period).toBe("30d");
  expect(result.current.filters.statuses).toEqual([]);
  expect(result.current.activeCount).toBe(0);
});
