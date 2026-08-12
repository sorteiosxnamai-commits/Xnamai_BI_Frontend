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
  today?: {
    date: string;
    orders: number;
    revenue: number;
    ticketAverage: number;
    customers: number;
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
  segment?: string;
  summary: Record<string, number>;
  total: number;
  matched?: number;
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

export type OrdersInsight = {
  periodDays: number;
  kpis: {
    orders: number;
    revenue: number;
    ticketAverage: number;
    maxOrder: number;
    minOrder: number;
  };
  biggestOrders: OrderRow[];
  smallestOrders: OrderRow[];
  topCustomersByOrders: { id: string; name: string; orders: number; revenue: number }[];
  topCustomersByRevenue: { id: string; name: string; orders: number; revenue: number }[];
  idleCustomers: { id: string; name: string; lastOrderAt: string | null; daysSinceLastOrder: number }[];
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("VITE_BI_API_URL não configurada");
  if (!API_KEY) throw new Error("VITE_BI_API_KEY não configurada");
  const ctrl = new AbortController();
  const ms = 25000;
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init?.signal || ctrl.signal,
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
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Tempo esgotado ao falar com o backend (25s). Tente de novo.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isTransient(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /502|503|504|Failed to fetch|NetworkError|ERR_FAILED|Unexpected token|<!DOCTYPE|Bad Gateway|Tempo esgotado|AbortError/i.test(msg);
}

async function requestRetry<T>(path: string, init?: RequestInit, retries = 8): Promise<T> {
  let last: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await request<T>(path, init);
    } catch (err) {
      last = err;
      if (!isTransient(err) || i === retries - 1) throw err;
      await sleep(1500 * (i + 1));
    }
  }
  throw last instanceof Error ? last : new Error("Falha de rede");
}

export const api = {
  configured: Boolean(API_URL && API_KEY),
  dashboard: (days: number) => request<Dashboard>(`/api/v1/dashboard?days=${days}`),
  rankings: (days: number) => request<Rankings>(`/api/v1/rankings?days=${days}`),
  orders: (limit = 50, opts?: { days?: number; sort?: string; order?: "asc" | "desc" }) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (opts?.days != null) params.set("days", String(opts.days));
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.order) params.set("order", opts.order);
    return request<OrderRow[]>(`/api/v1/orders?${params}`);
  },
  ordersInsight: (days: number, limit = 10) =>
    requestRetry<OrdersInsight>(`/api/v1/orders/insight?days=${days}&limit=${limit}`),
  products: (limit = 50) => request<ProductRow[]>(`/api/v1/products?limit=${limit}`),
  customers: (limit = 50) => request<CustomerRow[]>(`/api/v1/customers?limit=${limit}`),
  sellers: () => request<SellerRow[]>(`/api/v1/sellers`),
  syncStatus: () => requestRetry<SyncState[]>(`/api/v1/sync/status`, undefined, 3),
  intelligence: (
    inactiveDays = 90,
    riskDays = 90,
    opts?: { limit?: number; segment?: string; sort?: string; order?: "asc" | "desc" }
  ) => {
    const limit = opts?.limit ?? 800;
    const params = new URLSearchParams({
      inactive_days: String(inactiveDays),
      risk_days: String(riskDays),
      limit: String(limit),
    });
    if (opts?.segment && opts.segment !== "todos") params.set("segment", opts.segment);
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.order) params.set("order", opts.order);
    return requestRetry<CustomerIntelligence>(`/api/v1/intelligence/customers?${params}`);
  },
  leads: (inactiveDays = 90, riskDays = 90) =>
    requestRetry<LeadsResponse>(
      `/api/v1/intelligence/leads?inactive_days=${inactiveDays}&risk_days=${riskDays}&limit=300`
    ),
  deadStock: (noSaleDays = 90) =>
    requestRetry<DeadStockResponse>(`/api/v1/intelligence/dead-stock?no_sale_days=${noSaleDays}&limit=300`),
  productMovers: (days: number) =>
    requestRetry<ProductMovers>(`/api/v1/intelligence/product-movers?days=${days}`),
  sync: (resource = "all", full = false) =>
    requestRetry<{ status: string; message?: string }>(
      `/api/v1/sync/${resource}?full=${full ? "true" : "false"}`,
      { method: "POST" },
      2
    ),
  syncAndWait: async (
    resource = "all",
    full = false,
    onProgress?: (states: SyncState[]) => void,
    opts?: { intervalMs?: number; maxMs?: number }
  ) => {
    const started = await api.sync(resource, full);
    const intervalMs = opts?.intervalMs ?? 8000;
    const maxMs = opts?.maxMs ?? 90 * 60 * 1000;
    const t0 = Date.now();
    let failStreak = 0;
    await sleep(1500);
    while (Date.now() - t0 < maxMs) {
      let states: SyncState[];
      try {
        states = await api.syncStatus();
        failStreak = 0;
      } catch (err) {
        failStreak += 1;
        if (failStreak >= 4) {
          throw new Error(
            "Backend indisponível durante a sync (Render reiniciou ou sobrecarregou). Espere 1–2 min e clique Sincronizar de novo."
          );
        }
        await sleep(intervalMs * failStreak);
        continue;
      }
      onProgress?.(states);
      const running = states.some((s) => s.status === "running");
      if (running) {
        await sleep(intervalMs);
        continue;
      }
      const interrupted = states.some((s) => s.status === "interrupted" || s.status === "partial");
      if (interrupted) {
        // Não dispara sync de novo automaticamente — evita martelar o Render
        return states;
      }
      const failed = states.filter((s) => s.status === "error");
      if (failed.length && states.every((s) => s.status !== "success" && s.status !== "partial" && !(s.records || 0))) {
        throw new Error(failed[0]?.error || started.message || "Sync falhou");
      }
      return states;
    }
    const states = await api.syncStatus();
    onProgress?.(states);
    return states;
  },
};
