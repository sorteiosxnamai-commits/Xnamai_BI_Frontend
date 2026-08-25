const API_URL = (import.meta.env.VITE_BI_API_URL || "").replace(/\/$/, "");

export type CrmProduct = {
  productId?: string | null;
  name: string;
  code?: string | null;
  quantity: number;
  unitPrice?: number;
  total: number;
  date?: string | null;
  orderNumber?: string | null;
  stock?: number | null;
  listPrice?: number | null;
  revenue?: number;
  orders?: number;
  lastDate?: string | null;
};

export type CrmLead = {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  email: string | null;
  phone: string | null;
  document?: string | null;
  segment: string;
  orders: number;
  revenue: number;
  ticketAverage: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  daysSinceLastOrder: number | null;
  sellerName?: string | null;
  attendanceStatus: "open" | "in_progress" | "finished" | string;
  claimedBy?: string | null;
  claimedAt?: string | null;
  lastProducts: CrmProduct[];
};

export type CrmOrder = {
  id: string;
  number: string;
  status: string;
  date: string | null;
  total: number;
  sellerName?: string | null;
  items: CrmProduct[];
};

export type CrmLeadDetail = CrmLead & {
  tradeName?: string | null;
  legalName?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  zipCode?: string | null;
  ie?: string | null;
  branch?: string | null;
  blocked?: boolean;
  type?: string | null;
  extraPhone?: string | null;
  mobile?: string | null;
  extraEmail?: string | null;
  createdAtSource?: string | null;
  updatedAtSource?: string | null;
  active?: boolean;
  mostBoughtProducts: CrmProduct[];
  orderHistory: CrmOrder[];
  notes?: string | null;
};

export type CrmLeadsResponse = {
  count: number;
  topCount: number;
  top: CrmLead[];
  queue: CrmLead[];
  hidden?: number;
  inProgress: number;
  open: number;
};

export type CrmDashboard = {
  periodDays: number;
  kpis: {
    openLeads: number;
    inProgress: number;
    finishedToday: number;
    finishedMonth: number;
    finishedPeriod: number;
    billingOpen: number;
    billingFinished: number;
    billingFinishedPeriod: number;
    averageHandleMinutes: number;
  };
  series: { date: string; attendances: number; revenue: number }[];
  recentFinished: {
    id: string;
    name: string;
    sellerName: string | null;
    finishedAt: string | null;
    revenue: number;
  }[];
  sellers: { sellerName: string; attendances: number; revenue: number }[];
};

async function crmRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("VITE_BI_API_URL nao configurada");
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text || `${response.status} ${response.statusText}`;
    try {
      const parsed = JSON.parse(text) as { detail?: unknown };
      if (typeof parsed.detail === "string" && parsed.detail) message = parsed.detail;
    } catch {
      /* keep raw body */
    }
    throw new Error(message);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export const crmApi = {
  configured: Boolean(API_URL),
  leads: (search = "", top = 20) => {
    const params = new URLSearchParams({ top: String(top) });
    if (search.trim()) params.set("search", search.trim());
    return crmRequest<CrmLeadsResponse>(`/api/v1/crm/leads?${params}`);
  },
  lead: (id: string) => crmRequest<CrmLeadDetail>(`/api/v1/crm/leads/${id}`),
  claim: (id: string, sellerName: string) =>
    crmRequest<CrmLeadDetail>(`/api/v1/crm/leads/${id}/claim`, {
      method: "POST",
      body: JSON.stringify({ sellerName }),
    }),
  finish: (id: string, sellerName: string, notes?: string) =>
    crmRequest<{ id: string; status: string }>(`/api/v1/crm/leads/${id}/finish`, {
      method: "POST",
      body: JSON.stringify({ sellerName, notes }),
    }),
  dashboard: (days = 30) => crmRequest<CrmDashboard>(`/api/v1/crm/dashboard?days=${days}`),
};
