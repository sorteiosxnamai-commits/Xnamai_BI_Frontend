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
  aiScore?: number | null;
  aiReason?: string | null;
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
  view?: "main" | "new" | "ai";
  count: number;
  newCount?: number;
  topCount: number;
  top: CrmLead[];
  queue: CrmLead[];
  queuePage?: number;
  queuePageSize?: number;
  queueTotal?: number;
  hasMore?: boolean;
  inProgress: number;
  open: number;
  aiScored?: number;
  aiPending?: number;
};

export type CrmLeadsParams = {
  search?: string;
  top?: number;
  view?: "main" | "new" | "ai";
  queuePage?: number;
  queuePageSize?: number;
  refreshAi?: boolean;
};

export type CrmLeadAnalysis = {
  companyProfile?: string;
  sector?: string;
  website?: string | null;
  publicProducts?: string[];
  purchasePreferences?: string[];
  approachStrategy?: string;
  openingMessage?: string;
  talkingPoints?: string[];
  risksOrCautions?: string[];
  sources?: { title: string; url: string }[];
  confidence?: string;
};

export type CrmLeadAnalysisResponse = {
  contact: {
    phone?: string | null;
    email?: string | null;
    whatsappUrl?: string | null;
  };
  analysis: CrmLeadAnalysis;
  cached: boolean;
  generatedAt?: string | null;
};

export type CrmFinishPayload = {
  sellerName: string;
  outcome: "won" | "lost" | "discarded";
  notes?: string;
  saleValue?: number;
  orderNumber?: string;
};

export type CrmFinishResponse = {
  id: string;
  status: string;
  outcome: string;
  saleValue?: number | null;
  orderNumber?: string | null;
  finishedAt?: string | null;
};

export type CrmDashboard = {
  periodDays: number;
  kpis: {
    openLeads: number;
    inProgress: number;
    finishedToday: number;
    finishedMonth: number;
    finishedPeriod: number;
    salesWonPeriod: number;
    salesValuePeriod: number;
    billingOpen: number;
    billingFinished: number;
    billingFinishedPeriod: number;
    averageHandleMinutes: number;
  };
  series: { date: string; attendances: number; revenue: number; sales?: number }[];
  recentFinished: {
    id: string;
    name: string;
    sellerName: string | null;
    finishedAt: string | null;
    outcome?: string | null;
    saleValue?: number | null;
    orderNumber?: string | null;
    revenue: number;
  }[];
  sellers: { sellerName: string; attendances: number; revenue: number; salesWon?: number }[];
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
  leads: ({
    search = "",
    top = 20,
    view = "main",
    queuePage = 1,
    queuePageSize = 40,
    refreshAi = false,
  }: CrmLeadsParams = {}) => {
    const params = new URLSearchParams({
      top: String(top),
      view,
      queuePage: String(queuePage),
      queuePageSize: String(queuePageSize),
    });
    if (search.trim()) params.set("search", search.trim());
    if (refreshAi) params.set("refreshAi", "true");
    return crmRequest<CrmLeadsResponse>(`/api/v1/crm/leads?${params}`);
  },
  lead: (id: string) => crmRequest<CrmLeadDetail>(`/api/v1/crm/leads/${id}`),
  analyzeLead: (id: string, refresh = false) =>
    crmRequest<CrmLeadAnalysisResponse>(
      `/api/v1/crm/leads/${id}/analysis${refresh ? "?refresh=true" : ""}`,
    ),
  claim: (id: string, sellerName: string) =>
    crmRequest<CrmLeadDetail>(`/api/v1/crm/leads/${id}/claim`, {
      method: "POST",
      body: JSON.stringify({ sellerName }),
    }),
  finish: (id: string, payload: CrmFinishPayload) =>
    crmRequest<CrmFinishResponse>(`/api/v1/crm/leads/${id}/finish`, {
      method: "POST",
      body: JSON.stringify({
        sellerName: payload.sellerName,
        outcome: payload.outcome,
        notes: payload.notes,
        saleValue: payload.saleValue,
        orderNumber: payload.orderNumber,
      }),
    }),
  dashboard: (days = 30) => crmRequest<CrmDashboard>(`/api/v1/crm/dashboard?days=${days}`),
};
