const API_URL = (import.meta.env.VITE_BI_API_URL || "").replace(/\/$/, "");
const API_KEY = import.meta.env.VITE_BI_API_KEY || "";

export type Dashboard = {
  periodDays: number;
  kpis: {
    revenue: number;
    revenueChange: number;
    orders: number;
    ordersChange: number;
    ticketAverage: number;
    customers: number;
    customersTotal?: number;
    cancellations: number;
  };
  salesEvolution: { date: string; orders: number; revenue: number }[];
  status: { status: string; orders: number; value: number }[];
};

export type Rankings = {
  products: { name: string; quantity: number; revenue: number }[];
  customers: { name: string; orders: number; revenue: number }[];
  sellers: { name: string; orders: number; revenue: number }[];
};

export type OrderRow = {
  id: string;
  number: string;
  customerName: string;
  sellerName: string;
  status: string;
  date: string | null;
  total: number;
};

export type ProductRow = {
  id: string;
  code: string;
  name: string;
  stock: number;
  price: number;
  active: boolean;
};

export type CustomerRow = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
};

export type SellerRow = { id: string; name: string; active: boolean };

export type SyncState = {
  resource: string;
  status: string;
  cursor: string | null;
  lastSuccessAt: string | null;
  records: number | null;
  error: string | null;
};

export type ClassifiedCustomer = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  segment: "ativo" | "em_risco" | "recuperar" | "lead_novo" | string;
  potential: string;
  orders: number;
  revenue: number;
  ticketAverage: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
};

export type CustomerIntelligence = {
  inactiveDays: number;
  riskDays: number;
  summary: Record<string, number>;
  total: number;
  customers: ClassifiedCustomer[];
};

export type LeadsResponse = {
  inactiveDays: number;
  riskDays: number;
  count: number;
  leads: ClassifiedCustomer[];
};

export type DeadStockResponse = {
  noSaleDays: number;
  count: number;
  totalStockValue: number;
  products: {
    id: string;
    code: string | null;
    name: string;
    stock: number;
    price: number;
    stockValue: number;
    lastSaleAt: string | null;
    daysSinceLastSale: number | null;
    neverSold: boolean;
  }[];
};

export type ProductMovers = {
  periodDays: number;
  top: { id: string | null; name: string; code: string | null; quantity: number; revenue: number }[];
  slow: { id: string | null; name: string; code: string | null; quantity: number; revenue: number }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("VITE_BI_API_URL não configurada");
  if (!API_KEY) throw new Error("VITE_BI_API_KEY não configurada");
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "X-API-Key": API_KEY,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok && res.status !== 202) {
    const text = await res.text();
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const api = {
  configured: Boolean(API_URL && API_KEY),
  dashboard: (days: number) => request<Dashboard>(`/api/v1/dashboard?days=${days}`),
  rankings: (days: number) => request<Rankings>(`/api/v1/rankings?days=${days}`),
  orders: (limit = 50) => request<OrderRow[]>(`/api/v1/orders?limit=${limit}`),
  products: (limit = 50) => request<ProductRow[]>(`/api/v1/products?limit=${limit}`),
  customers: (limit = 50) => request<CustomerRow[]>(`/api/v1/customers?limit=${limit}`),
  sellers: () => request<SellerRow[]>(`/api/v1/sellers`),
  syncStatus: () => request<SyncState[]>(`/api/v1/sync/status`),
  intelligence: (inactiveDays = 90, riskDays = 45) =>
    request<CustomerIntelligence>(
      `/api/v1/intelligence/customers?inactive_days=${inactiveDays}&risk_days=${riskDays}&limit=800`
    ),
  leads: (inactiveDays = 90, riskDays = 45) =>
    request<LeadsResponse>(
      `/api/v1/intelligence/leads?inactive_days=${inactiveDays}&risk_days=${riskDays}&limit=300`
    ),
  deadStock: (noSaleDays = 90) =>
    request<DeadStockResponse>(`/api/v1/intelligence/dead-stock?no_sale_days=${noSaleDays}&limit=300`),
  productMovers: (days: number) =>
    request<ProductMovers>(`/api/v1/intelligence/product-movers?days=${days}`),
  sync: (resource = "all", full = false) =>
    request<{ status: string; message?: string }>(`/api/v1/sync/${resource}?full=${full ? "true" : "false"}`, {
      method: "POST",
    }),
  syncAndWait: async (
    resource = "all",
    full = false,
    onProgress?: (states: SyncState[]) => void,
    opts?: { intervalMs?: number; maxMs?: number }
  ) => {
    const started = await api.sync(resource, full);
    const intervalMs = opts?.intervalMs ?? 5000;
    const maxMs = opts?.maxMs ?? 45 * 60 * 1000;
    const t0 = Date.now();
    await sleep(800);
    while (Date.now() - t0 < maxMs) {
      const states = await api.syncStatus();
      onProgress?.(states);
      const running = states.some((s) => s.status === "running");
      if (!running) {
        const failed = states.filter((s) => s.status === "error" || s.status === "interrupted");
        if (failed.length && states.every((s) => s.status !== "success" && s.status !== "partial" && !(s.records || 0))) {
          throw new Error(failed[0]?.error || started.message || "Sync falhou");
        }
        return states;
      }
      await sleep(intervalMs);
    }
    const states = await api.syncStatus();
    onProgress?.(states);
    return states;
  },
};
