const API_URL = (import.meta.env.VITE_BI_API_URL || "").replace(/\/$/, "");

export type RetailChannel = {
  platform: string;
  label: string;
  feePct: number;
  shippingKey: string;
  shippingLabel: string;
  retailPrice: number;
  cost: number;
  fee: number;
  freight: number;
  packaging: number;
  netMargin: number;
  marginPct: number;
  source?: string | null;
  url?: string | null;
};

export type RetailProduct = {
  id: string;
  rank?: number;
  code?: string | null;
  name: string;
  listPrice: number;
  stock?: number;
  mercosRevenue?: number;
  mercosQuantity?: number;
  analyzed: boolean;
  stale?: boolean;
  recomendacaoScore: number;
  apelo?: string;
  melhorPlataforma: string;
  melhorPlataformaLabel: string;
  melhorEnvio?: string;
  melhorEnvioLabel?: string;
  porquePlataforma?: string | null;
  margemLiquida?: number | null;
  margemLiquidaPct?: number | null;
  custoEstimado?: number;
  motivoCurto: string;
  motivos?: string[];
  channels?: RetailChannel[];
  sources?: { title?: string; url?: string }[];
  confidence?: string | null;
  generatedAt?: string | null;
  aiPayload?: Record<string, unknown> | null;
  marketPrices?: Record<string, unknown> | null;
  cached?: boolean;
  heuristic?: boolean;
};

export type RetailRecommendedResponse = {
  items: RetailProduct[];
  poolSize: number;
  analyzedCount: number;
  pendingCount: number;
  top: number;
  dashboard: {
    platformDistribution: { platform: string; label: string; count: number }[];
    appealDistribution: { alto: number; medio: number; baixo: number };
    avgMarginPct: number | null;
    avgRecommendationScore: number | null;
  };
  economics: Record<string, unknown>;
  disclaimer: string;
};

export type RetailBatchResponse = {
  processed: { id: string; name?: string; recomendacaoScore?: number; melhorPlataforma?: string; heuristic?: boolean }[];
  processedCount: number;
  errors: { id: string; error: string }[];
  pendingCount: number;
  poolSize: number;
  analyzedCount: number;
};

async function retailRequest<T>(path: string, init?: RequestInit): Promise<T> {
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
      /* keep raw */
    }
    throw new Error(message);
  }
  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

export const retailApi = {
  configured: Boolean(API_URL),
  recommended: (top = 100) =>
    retailRequest<RetailRecommendedResponse>(`/api/v1/retail/recommended?top=${top}`),
  analysis: (id: string, refresh = false) =>
    retailRequest<RetailProduct>(
      `/api/v1/retail/products/${encodeURIComponent(id)}/analysis${refresh ? "?refresh=true" : ""}`,
    ),
  analyzeBatch: (limit = 10, refresh = false) =>
    retailRequest<RetailBatchResponse>(`/api/v1/retail/analyze-batch`, {
      method: "POST",
      body: JSON.stringify({ limit, refresh }),
    }),
  economics: () => retailRequest<Record<string, unknown>>("/api/v1/retail/economics"),
};
