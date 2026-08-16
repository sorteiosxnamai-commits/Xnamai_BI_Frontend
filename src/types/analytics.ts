export type Period = "7d" | "30d" | "90d" | "365d" | "ytd" | "all";
export type Granularity = "day" | "week" | "month" | "quarter" | "year";
export type SortOrder = "asc" | "desc";
export type AppliedFilters = Record<string, unknown>;

export type AnalyticsFilters = {
  dateFrom?: string;
  dateTo?: string;
  period: Period;
  granularity: Granularity;
  statuses: string[];
  sellerIds: string[];
  customerIds: string[];
  productIds: string[];
  categoryIds: string[];
  states: string[];
  cities: string[];
  segmentIds: string[];
  orderTypeIds: string[];
  paymentConditionIds: string[];
  minValue?: number;
  maxValue?: number;
  activeOnly: boolean;
};

export type AnalyticsMetadata = {
  generatedAt: string;
  dataThrough: string | null;
  isPartial: boolean;
  warnings: string[];
  quality: {
    ordersWithItemsPct?: number;
    orders?: number;
    ordersWithItems?: number;
  };
};

export type KpiValue = {
  value: number;
  previousValue: number;
  absoluteChange: number;
  percentageChange: number | null;
  trend: "up" | "down" | "stable";
  isPositive: boolean;
  definition: string;
};

export type OverviewResponse = {
  kpis: Record<string, KpiValue>;
  appliedFilters: AppliedFilters;
  metadata: AnalyticsMetadata;
};

export type TimeseriesPoint = {
  period: string;
  revenue: number;
  orders: number;
  averageTicket: number;
  customers: number;
  items: number;
  cancellations: number;
  discounts: number;
};

export type TimeseriesResponse = {
  items: TimeseriesPoint[];
  previousItems: TimeseriesPoint[];
  granularity: Granularity;
  appliedFilters: AppliedFilters;
  metadata: AnalyticsMetadata;
};

export type BreakdownsResponse = {
  statuses: { status: string; orders: number; value: number }[];
  orderValueBands: { band: string; orders: number; value: number }[];
  productAbc: { class: "A" | "B" | "C"; entities: number; revenue: number }[];
  customerAbc: { class: "A" | "B" | "C"; entities: number; revenue: number }[];
  appliedFilters: AppliedFilters;
  metadata: AnalyticsMetadata;
};

export type PageResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  sort: string;
  order: SortOrder;
  appliedFilters: AppliedFilters;
  metadata: AnalyticsMetadata;
  summary?: Record<string, unknown> | null;
};

export type OrderAnalyticsRow = {
  id: string;
  number: string;
  issuedAt: string | null;
  customerId: string | null;
  customerName: string | null;
  sellerId: string | null;
  sellerName: string | null;
  status: string;
  grossTotal: number | null;
  netTotal: number;
  total: number;
  discount: number;
  itemCount: number | null;
  skuCount: number | null;
  city: string | null;
  state: string | null;
};

export type OrderDetailResponse = {
  order: OrderAnalyticsRow & {
    orderTypeId?: string | null;
    paymentConditionId?: string | null;
    priceTableId?: string | null;
    carrierId?: string | null;
    commercialPolicyId?: string | null;
  };
  items: {
    id: string | null;
    position: number;
    productId: string | null;
    code: string | null;
    name: string;
    quantity: number;
    unitPrice: number | null;
    sourceUnitPrice: number;
    discount: number;
    total: number | null;
    sourceTotal: number;
    priceSource: "catalog" | "unavailable";
  }[];
  metadata: AnalyticsMetadata;
};

export type ProductAnalyticsRow = {
  id: string;
  code: string | null;
  name: string;
  categoryId: string | null;
  active: boolean;
  quantitySold: number;
  orderCount: number;
  revenue: number;
  revenueShare: number;
  cumulativeRevenueShare: number;
  abcClass: "A" | "B" | "C" | null;
  averagePrice: number;
  listPrice: number | null;
  minimumPrice: number | null;
  stock: number;
  stockValue: number;
  averageDailyVelocity: number;
  estimatedCoverageDays: number | null;
  stockoutRisk: boolean;
  excessStock: boolean;
  lastSaleAt: string | null;
  daysWithoutSale: number | null;
  neverSold: boolean;
  classification: string;
};

export type CustomerCohortMember = {
  id: string;
  name: string;
  rank: number;
  revenue: number;
  orderCount: number;
  averageMonthlyOrders: number;
};

export type CustomerCohortSummary = {
  customerCount: number;
  orderCount: number;
  revenue: number;
  revenueSharePct: number;
  orderSharePct: number;
  averageMonthlyOrders: number;
  averageRevenuePerCustomer: number;
  averageOrderValue: number;
  members?: CustomerCohortMember[];
  membersOmitted?: number;
};

export type CustomersPageSummary = {
  periodMonths?: number;
  totalRevenue?: number;
  concentrationTop5Pct: number;
  concentrationTop10Pct: number;
  concentrationTop20Pct: number;
  concentrationRestPct?: number;
  top5?: CustomerCohortSummary;
  top10?: CustomerCohortSummary;
  top20?: CustomerCohortSummary;
  ranks6to10?: CustomerCohortSummary;
  ranks11to20?: CustomerCohortSummary;
  rest?: CustomerCohortSummary;
};

export type CustomerAnalyticsRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  segmentId: string | null;
  active: boolean;
  orderCount: number;
  revenue: number;
  revenueShare: number;
  cumulativeRevenueShare: number;
  abcClass: "A" | "B" | "C" | null;
  averageTicket: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  averageOrderIntervalDays: number | null;
  recency: number | null;
  frequency: number;
  monetary: number;
  rfm: {
    recency: number;
    frequency: number;
    monetary: number;
    score: number;
    segment: string;
  };
};

export type SellerAnalyticsRow = {
  id: string;
  name: string;
  active: boolean;
  orderCount: number;
  revenue: number;
  averageTicket: number;
  customers: number;
  newCustomers: number | null;
  cancellations: number;
  discountTotal: number;
};

export type ProductDetailResponse = {
  product: ProductAnalyticsRow;
  recentOrders: PageResponse<OrderAnalyticsRow>;
  customers: PageResponse<CustomerAnalyticsRow>;
  associations: AssociationsResponse;
  metadata: AnalyticsMetadata;
};

export type CustomerDetailResponse = {
  customer: CustomerAnalyticsRow;
  orders: PageResponse<OrderAnalyticsRow>;
  products: PageResponse<ProductAnalyticsRow>;
  metadata: AnalyticsMetadata;
};

export type SellerDetailResponse = {
  seller: SellerAnalyticsRow;
  orders: PageResponse<OrderAnalyticsRow>;
  customers: PageResponse<CustomerAnalyticsRow>;
  products: PageResponse<ProductAnalyticsRow>;
  metadata: AnalyticsMetadata;
};

export type RankingsResponse = {
  products: PageResponse<ProductAnalyticsRow>;
  customers: PageResponse<CustomerAnalyticsRow>;
  sellers: PageResponse<SellerAnalyticsRow>;
  appliedFilters: AppliedFilters;
  metadata: AnalyticsMetadata;
};

export type GeographyResponse = {
  states: {
    state: string;
    customers: number;
    orders: number;
    revenue: number;
  }[];
  cities: {
    state: string | null;
    city: string;
    customers: number;
    orders: number;
    revenue: number;
  }[];
  metadata: AnalyticsMetadata;
};

export type CohortsResponse = {
  cohorts: {
    cohort: string;
    size: number;
    retention: {
      monthOffset: number;
      customers: number;
      rate: number;
    }[];
  }[];
  metadata: AnalyticsMetadata;
};

export type AssociationsResponse = {
  items: {
    productAId: string;
    productAName: string;
    productBId: string;
    productBName: string;
    ordersTogether: number;
  }[];
  metadata: AnalyticsMetadata;
};

export type FilterOption = { id: string; label: string };
export type FilterOptionsResponse = {
  items: FilterOption[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  option: string;
};
