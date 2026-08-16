import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { AnalyticsFilters, Granularity, Period } from "../types/analytics";

export const DEFAULT_FILTERS: AnalyticsFilters = {
  period: "30d",
  granularity: "day",
  statuses: [],
  sellerIds: [],
  customerIds: [],
  excludedCustomerIds: [],
  productIds: [],
  categoryIds: [],
  states: [],
  cities: [],
  segmentIds: [],
  orderTypeIds: [],
  paymentConditionIds: [],
  activeOnly: false,
};

const arrayKeys = [
  "statuses",
  "sellerIds",
  "customerIds",
  "excludedCustomerIds",
  "productIds",
  "categoryIds",
  "states",
  "cities",
  "segmentIds",
  "orderTypeIds",
  "paymentConditionIds",
] as const;

function parseNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function useAnalyticsFilters() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo<AnalyticsFilters>(() => {
    const next: AnalyticsFilters = {
      ...DEFAULT_FILTERS,
      period: (searchParams.get("period") || "30d") as Period,
      granularity: (searchParams.get("granularity") || "day") as Granularity,
      dateFrom: searchParams.get("dateFrom") || undefined,
      dateTo: searchParams.get("dateTo") || undefined,
      minValue: parseNumber(searchParams.get("minValue")),
      maxValue: parseNumber(searchParams.get("maxValue")),
      activeOnly: searchParams.get("activeOnly") === "true",
    };
    arrayKeys.forEach((key) => {
      next[key] = searchParams.getAll(key);
    });
    return next;
  }, [searchParams]);

  const setFilters = useCallback(
    (next: AnalyticsFilters) => {
      const params = new URLSearchParams();
      params.set("period", next.period);
      params.set("granularity", next.granularity);
      if (next.dateFrom) params.set("dateFrom", next.dateFrom);
      if (next.dateTo) params.set("dateTo", next.dateTo);
      if (next.minValue != null) params.set("minValue", String(next.minValue));
      if (next.maxValue != null) params.set("maxValue", String(next.maxValue));
      if (next.activeOnly) params.set("activeOnly", "true");
      arrayKeys.forEach((key) => {
        next[key].forEach((value) => {
          params.append(key, value);
        });
      });
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  const updateFilters = useCallback(
    (patch: Partial<AnalyticsFilters>) => setFilters({ ...filters, ...patch }),
    [filters, setFilters]
  );

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [setFilters]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.period !== DEFAULT_FILTERS.period) count += 1;
    if (filters.granularity !== DEFAULT_FILTERS.granularity) count += 1;
    if (filters.dateFrom || filters.dateTo) count += 1;
    if (filters.minValue != null || filters.maxValue != null) count += 1;
    if (filters.activeOnly) count += 1;
    arrayKeys.forEach((key) => {
      if (filters[key].length) count += 1;
    });
    return count;
  }, [filters]);

  return { filters, updateFilters, clearFilters, activeCount };
}
