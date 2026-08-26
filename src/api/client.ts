import { z } from "zod";
import { authenticatedFetch } from "../auth/session";
import type {
  AnalyticsFilters,
  AssociationsResponse,
  BreakdownsResponse,
  CohortsResponse,
  CustomerAnalyticsRow,
  CustomerDetailResponse,
  FilterOptionsResponse,
  GeographyResponse,
  OrderAnalyticsRow,
  OrderDetailResponse,
  OverviewResponse,
  PageResponse,
  ProductAnalyticsRow,
  ProductDetailResponse,
  ProductInsightsResponse,
  RankingsResponse,
  SellerAnalyticsRow,
  SellerDetailResponse,
  SortOrder,
  TimeseriesResponse,
} from "../types/analytics";

const API_URL = (import.meta.env.VITE_BI_API_URL || "").replace(/\/$/, "");

const metadataSchema = z.object({
  generatedAt: z.string(),
  dataThrough: z.string().nullable(),
  isPartial: z.boolean(),
  warnings: z.array(z.string()),
  quality: z.record(z.string(), z.unknown()),
});

const kpiSchema = z.object({
  value: z.coerce.number(),
  previousValue: z.coerce.number(),
  absoluteChange: z.coerce.number(),
  percentageChange: z.number().nullable(),
  trend: z.enum(["up", "down", "stable"]),
  isPositive: z.boolean(),
  definition: z.string(),
});

const overviewSchema = z.object({
  kpis: z.record(z.string(), kpiSchema),
  appliedFilters: z.record(z.string(), z.unknown()),
  metadata: metadataSchema,
});

const timeseriesPointSchema = z.object({
  period: z.string(),
  revenue: z.coerce.number(),
  orders: z.coerce.number(),
  averageTicket: z.coerce.number(),
  customers: z.coerce.number(),
  items: z.coerce.number(),
  cancellations: z.coerce.number(),
  discounts: z.coerce.number(),
});

const timeseriesSchema = z.object({
  items: z.array(timeseriesPointSchema),
  previousItems: z.array(timeseriesPointSchema),
  granularity: z.enum(["day", "week", "month", "quarter", "year"]),
  appliedFilters: z.record(z.string(), z.unknown()),
  metadata: metadataSchema,
});

const abcItemSchema = z.object({
  class: z.enum(["A", "B", "C"]),
  entities: z.number(),
  revenue: z.coerce.number(),
  revenueSharePct: z.coerce.number().optional(),
  entitySharePct: z.coerce.number().optional(),
});
const breakdownsSchema = z.object({
  statuses: z.array(
    z.object({
      status: z.string(),
      orders: z.number(),
      value: z.coerce.number(),
    })
  ),
  orderValueBands: z.array(
    z.object({
      band: z.string(),
      orders: z.number(),
      value: z.coerce.number(),
    })
  ),
  productAbc: z.array(abcItemSchema),
  customerAbc: z.array(abcItemSchema),
  appliedFilters: z.record(z.string(), z.unknown()),
  metadata: metadataSchema,
});

const productInsightsSchema = z.object({
  summary: z.object({
    productsWithSales: z.number(),
    totalRevenue: z.coerce.number(),
    totalQuantity: z.coerce.number(),
    productsFor80Pct: z.number(),
    productsFor95Pct: z.number(),
    top10RevenueSharePct: z.coerce.number(),
    top20RevenueSharePct: z.coerce.number(),
    averageRevenuePerSku: z.coerce.number(),
  }),
  productAbc: z.array(
    abcItemSchema.extend({
      revenueSharePct: z.coerce.number(),
      entitySharePct: z.coerce.number(),
    })
  ),
  pareto: z.array(
    z.object({
      rank: z.number(),
      id: z.string(),
      code: z.string().nullable(),
      name: z.string(),
      revenue: z.coerce.number(),
      quantitySold: z.coerce.number(),
      revenueSharePct: z.coerce.number(),
      cumulativeSharePct: z.coerce.number(),
      abcClass: z.enum(["A", "B", "C"]),
    })
  ),
  topByQuantity: z.array(
    z.object({
      rank: z.number(),
      id: z.string(),
      name: z.string(),
      quantitySold: z.coerce.number(),
      revenue: z.coerce.number(),
      quantitySharePct: z.coerce.number(),
    })
  ),
  classificationMix: z.array(
    z.object({
      classification: z.string(),
      products: z.number(),
      sharePct: z.coerce.number(),
    })
  ),
  quantityVsRevenue: z.array(
    z.object({
      name: z.string(),
      quantitySold: z.coerce.number(),
      revenue: z.coerce.number(),
      abcClass: z.enum(["A", "B", "C"]),
    })
  ),
  appliedFilters: z.record(z.string(), z.unknown()),
  metadata: metadataSchema,
});

const orderSchema = z.object({
  id: z.string(),
  number: z.string(),
  issuedAt: z.string().nullable(),
  customerId: z.string().nullable(),
  customerName: z.string().nullable(),
  sellerId: z.string().nullable(),
  sellerName: z.string().nullable(),
  status: z.string(),
  grossTotal: z.coerce.number().nullable(),
  netTotal: z.coerce.number(),
  total: z.coerce.number(),
  discount: z.coerce.number(),
  itemCount: z.coerce.number().nullable(),
  skuCount: z.coerce.number().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
});

const orderDetailSchema = z.object({
  order: orderSchema.extend({
    orderTypeId: z.string().nullable().optional(),
    paymentConditionId: z.string().nullable().optional(),
    priceTableId: z.string().nullable().optional(),
    carrierId: z.string().nullable().optional(),
    commercialPolicyId: z.string().nullable().optional(),
  }),
  items: z.array(
    z.object({
      id: z.string().nullable(),
      position: z.number(),
      productId: z.string().nullable(),
      code: z.string().nullable(),
      name: z.string(),
      quantity: z.coerce.number(),
      unitPrice: z.coerce.number().nullable(),
      sourceUnitPrice: z.coerce.number(),
      discount: z.coerce.number(),
      total: z.coerce.number().nullable(),
      sourceTotal: z.coerce.number(),
      priceSource: z.enum(["catalog", "unavailable"]),
    })
  ),
  appliedFilters: z.record(z.string(), z.unknown()),
  metadata: metadataSchema,
});

const productSchema = z.object({
  id: z.string(),
  code: z.string().nullable(),
  name: z.string(),
  categoryId: z.string().nullable(),
  active: z.boolean(),
  quantitySold: z.coerce.number(),
  orderCount: z.number(),
  revenue: z.coerce.number(),
  revenueShare: z.coerce.number(),
  cumulativeRevenueShare: z.coerce.number(),
  abcClass: z.enum(["A", "B", "C"]).nullable(),
  averagePrice: z.coerce.number(),
  listPrice: z.coerce.number().nullable(),
  minimumPrice: z.coerce.number().nullable(),
  stock: z.coerce.number(),
  stockValue: z.coerce.number(),
  averageDailyVelocity: z.coerce.number(),
  estimatedCoverageDays: z.coerce.number().nullable(),
  stockoutRisk: z.boolean(),
  excessStock: z.boolean(),
  lastSaleAt: z.string().nullable(),
  daysWithoutSale: z.number().nullable(),
  neverSold: z.boolean(),
  classification: z.string(),
});

const customerSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  segmentId: z.string().nullable(),
  active: z.boolean(),
  orderCount: z.number(),
  revenue: z.coerce.number(),
  revenueShare: z.coerce.number(),
  cumulativeRevenueShare: z.coerce.number(),
  abcClass: z.enum(["A", "B", "C"]).nullable(),
  averageTicket: z.coerce.number(),
  firstOrderAt: z.string().nullable(),
  lastOrderAt: z.string().nullable(),
  daysSinceLastOrder: z.number().nullable(),
  averageOrderIntervalDays: z.coerce.number().nullable(),
  recency: z.number().nullable(),
  frequency: z.number(),
  monetary: z.coerce.number(),
  rfm: z.object({
    recency: z.number(),
    frequency: z.number(),
    monetary: z.number(),
    score: z.number(),
    segment: z.string(),
  }),
});

const sellerSchema = z.object({
  id: z.string(),
  name: z.string(),
  active: z.boolean(),
  orderCount: z.number(),
  revenue: z.coerce.number(),
  averageTicket: z.coerce.number(),
  customers: z.number(),
  newCustomers: z.number().nullable(),
  newCustomersAvailability: z.string().optional(),
  cancellations: z.number(),
  discountTotal: z.coerce.number(),
});

const pageBaseSchema = z.object({
  page: z.number(),
  pageSize: z.number(),
  totalItems: z.number(),
  totalPages: z.number(),
  sort: z.string(),
  order: z.enum(["asc", "desc"]),
  appliedFilters: z.record(z.string(), z.unknown()),
  metadata: metadataSchema,
  summary: z.record(z.string(), z.unknown()).nullable().optional(),
});

const orderPageSchema = pageBaseSchema.extend({ items: z.array(orderSchema) });
const productPageSchema = pageBaseSchema.extend({ items: z.array(productSchema) });
const customerPageSchema = pageBaseSchema.extend({ items: z.array(customerSchema) });
const associationsSchema = z.object({
  items: z.array(
    z.object({
      productAId: z.string(),
      productAName: z.string(),
      productBId: z.string(),
      productBName: z.string(),
      ordersTogether: z.number(),
    })
  ),
  appliedFilters: z.record(z.string(), z.unknown()),
  metadata: metadataSchema,
});

function paramsFromFilters(filters: AnalyticsFilters): URLSearchParams {
  const params = new URLSearchParams({
    period: filters.period,
    granularity: filters.granularity,
    activeOnly: String(filters.activeOnly),
  });
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.minValue != null) params.set("minValue", String(filters.minValue));
  if (filters.maxValue != null) params.set("maxValue", String(filters.maxValue));
  const arrays: [keyof AnalyticsFilters, string][] = [
    ["statuses", "statuses"],
    ["sellerIds", "sellerIds"],
    ["customerIds", "customerIds"],
    ["excludedCustomerIds", "excludedCustomerIds"],
    ["productIds", "productIds"],
    ["categoryIds", "categoryIds"],
    ["states", "states"],
    ["cities", "cities"],
    ["segmentIds", "segmentIds"],
    ["orderTypeIds", "orderTypeIds"],
    ["paymentConditionIds", "paymentConditionIds"],
  ];
  arrays.forEach(([filterKey, queryKey]) => {
    (filters[filterKey] as string[]).forEach((value) => {
      params.append(queryKey, value);
    });
  });
  return params;
}

type PageOptions = {
  page: number;
  pageSize: number;
  search?: string;
  sort: string;
  order: SortOrder;
};

function pageParams(filters: AnalyticsFilters, options: PageOptions) {
  const params = paramsFromFilters(filters);
  params.set("page", String(options.page));
  params.set("page_size", String(options.pageSize));
  params.set("sort", options.sort);
  params.set("order", options.order);
  if (options.search) params.set("search", options.search);
  return params;
}

async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  if (!API_URL) throw new Error("VITE_BI_API_URL não configurada");
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await authenticatedFetch(`${API_URL}${path}`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || `${response.status} ${response.statusText}`);
    }
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(`Contrato inválido da API: ${z.prettifyError(parsed.error)}`);
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Tempo esgotado ao consultar o BI.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export const analyticsApi = {
  configured: Boolean(API_URL),
  overview(filters: AnalyticsFilters): Promise<OverviewResponse> {
    return request(
      `/api/v1/analytics/overview?${paramsFromFilters(filters)}`,
      overviewSchema
    ) as Promise<OverviewResponse>;
  },
  timeseries(filters: AnalyticsFilters): Promise<TimeseriesResponse> {
    return request(
      `/api/v1/analytics/timeseries?${paramsFromFilters(filters)}`,
      timeseriesSchema
    ) as Promise<TimeseriesResponse>;
  },
  breakdowns(filters: AnalyticsFilters): Promise<BreakdownsResponse> {
    return request(
      `/api/v1/analytics/breakdowns?${paramsFromFilters(filters)}`,
      breakdownsSchema
    ) as Promise<BreakdownsResponse>;
  },
  productInsights(filters: AnalyticsFilters): Promise<ProductInsightsResponse> {
    return request(
      `/api/v1/analytics/product-insights?${paramsFromFilters(filters)}`,
      productInsightsSchema
    ) as Promise<ProductInsightsResponse>;
  },
  rankings(filters: AnalyticsFilters): Promise<RankingsResponse> {
    const schema = z.object({
      products: productPageSchema,
      customers: customerPageSchema,
      sellers: pageBaseSchema.extend({ items: z.array(sellerSchema) }),
      appliedFilters: z.record(z.string(), z.unknown()),
      metadata: metadataSchema,
    });
    return request(
      `/api/v1/analytics/rankings?${paramsFromFilters(filters)}`,
      schema
    ) as Promise<RankingsResponse>;
  },
  orders(
    filters: AnalyticsFilters,
    options: PageOptions
  ): Promise<PageResponse<OrderAnalyticsRow>> {
    const params = pageParams(filters, options);
    const schema = pageBaseSchema.extend({ items: z.array(orderSchema) });
    return request(`/api/v1/analytics/orders?${params}`, schema) as Promise<
      PageResponse<OrderAnalyticsRow>
    >;
  },
  orderDetail(id: string, filters: AnalyticsFilters): Promise<OrderDetailResponse> {
    return request(
      `/api/v1/analytics/orders/${encodeURIComponent(id)}?${paramsFromFilters(filters)}`,
      orderDetailSchema
    ) as Promise<OrderDetailResponse>;
  },
  products(
    filters: AnalyticsFilters,
    options: PageOptions
  ): Promise<PageResponse<ProductAnalyticsRow>> {
    return request(
      `/api/v1/analytics/products?${pageParams(filters, options)}`,
      productPageSchema
    ) as Promise<PageResponse<ProductAnalyticsRow>>;
  },
  productDetail(id: string, filters: AnalyticsFilters): Promise<ProductDetailResponse> {
    const schema = z.object({
      product: productSchema,
      recentOrders: orderPageSchema,
      customers: customerPageSchema,
      associations: associationsSchema,
      appliedFilters: z.record(z.string(), z.unknown()),
      metadata: metadataSchema,
    });
    return request(
      `/api/v1/analytics/products/${encodeURIComponent(id)}?${paramsFromFilters(filters)}`,
      schema
    ) as Promise<ProductDetailResponse>;
  },
  inventory(
    filters: AnalyticsFilters,
    options: PageOptions
  ): Promise<PageResponse<ProductAnalyticsRow>> {
    const schema = pageBaseSchema.extend({ items: z.array(productSchema) });
    return request(
      `/api/v1/analytics/inventory?${pageParams(filters, options)}`,
      schema
    ) as Promise<PageResponse<ProductAnalyticsRow>>;
  },
  customers(
    filters: AnalyticsFilters,
    options: PageOptions
  ): Promise<PageResponse<CustomerAnalyticsRow>> {
    return request(
      `/api/v1/analytics/customers?${pageParams(filters, options)}`,
      customerPageSchema
    ) as Promise<PageResponse<CustomerAnalyticsRow>>;
  },
  customerDetail(id: string, filters: AnalyticsFilters): Promise<CustomerDetailResponse> {
    const schema = z.object({
      customer: customerSchema,
      orders: orderPageSchema,
      products: productPageSchema,
      appliedFilters: z.record(z.string(), z.unknown()),
      metadata: metadataSchema,
    });
    return request(
      `/api/v1/analytics/customers/${encodeURIComponent(id)}?${paramsFromFilters(filters)}`,
      schema
    ) as Promise<CustomerDetailResponse>;
  },
  sellers(
    filters: AnalyticsFilters,
    options: PageOptions
  ): Promise<PageResponse<SellerAnalyticsRow>> {
    const schema = pageBaseSchema.extend({ items: z.array(sellerSchema) });
    return request(
      `/api/v1/analytics/sellers?${pageParams(filters, options)}`,
      schema
    ) as Promise<PageResponse<SellerAnalyticsRow>>;
  },
  sellerDetail(id: string, filters: AnalyticsFilters): Promise<SellerDetailResponse> {
    const schema = z.object({
      seller: sellerSchema,
      orders: orderPageSchema,
      customers: customerPageSchema,
      products: productPageSchema,
      appliedFilters: z.record(z.string(), z.unknown()),
      metadata: metadataSchema,
    });
    return request(
      `/api/v1/analytics/sellers/${encodeURIComponent(id)}?${paramsFromFilters(filters)}`,
      schema
    ) as Promise<SellerDetailResponse>;
  },
  geography(filters: AnalyticsFilters): Promise<GeographyResponse> {
    const schema = z.object({
      states: z.array(
        z.object({
          state: z.string(),
          customers: z.number(),
          orders: z.number(),
          revenue: z.coerce.number(),
        })
      ),
      cities: z.array(
        z.object({
          state: z.string().nullable(),
          city: z.string(),
          customers: z.number(),
          orders: z.number(),
          revenue: z.coerce.number(),
        })
      ),
      appliedFilters: z.record(z.string(), z.unknown()),
      metadata: metadataSchema,
    });
    return request(
      `/api/v1/analytics/geography?${paramsFromFilters(filters)}`,
      schema
    ) as Promise<GeographyResponse>;
  },
  cohorts(filters: AnalyticsFilters): Promise<CohortsResponse> {
    const schema = z.object({
      cohorts: z.array(
        z.object({
          cohort: z.string(),
          size: z.number(),
          retention: z.array(
            z.object({
              monthOffset: z.number(),
              customers: z.number(),
              rate: z.number(),
            })
          ),
        })
      ),
      appliedFilters: z.record(z.string(), z.unknown()),
      metadata: metadataSchema,
    });
    return request(
      `/api/v1/analytics/cohorts?${paramsFromFilters(filters)}`,
      schema
    ) as Promise<CohortsResponse>;
  },
  associations(filters: AnalyticsFilters): Promise<AssociationsResponse> {
    return request(
      `/api/v1/analytics/associations?${paramsFromFilters(filters)}`,
      associationsSchema
    ) as Promise<AssociationsResponse>;
  },
  filterOptions(
    option: string,
    search = "",
    page = 1,
    states: string[] = []
  ): Promise<FilterOptionsResponse> {
    const params = new URLSearchParams({
      option,
      search,
      page: String(page),
      page_size: "100",
    });
    states.forEach((state) => {
      params.append("states", state);
    });
    const schema = z.object({
      items: z.array(z.object({ id: z.string(), label: z.string() })),
      page: z.number(),
      pageSize: z.number(),
      totalItems: z.number(),
      totalPages: z.number(),
      option: z.string(),
    });
    return request(`/api/v1/analytics/filter-options?${params}`, schema);
  },
  async exportReport(
    report: "orders" | "products" | "customers" | "sellers" | "inventory",
    format: "csv" | "xlsx",
    filters: AnalyticsFilters
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await authenticatedFetch(`${API_URL}/api/v1/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report, format, filters }),
    });
    if (!response.ok) {
      throw new Error((await response.text()) || "Falha ao exportar relatório");
    }
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/i);
    return {
      blob: await response.blob(),
      filename: match?.[1] || `xnamai-${report}.${format}`,
    };
  },
};
