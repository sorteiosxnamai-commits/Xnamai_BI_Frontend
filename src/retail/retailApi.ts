const API_URL = (import.meta.env.VITE_BI_API_URL || "").replace(/\/$/, "");

export type RetailChannel = {
  platform: string;
  label: string;
  feePct: number;
  shippingKey: string;
  shippingLabel: string;
  retailPrice: number | null;
  cost: number;
  fee: number | null;
  freight: number;
  packaging: number;
  netMargin: number | null;
  marginPct: number | null;
  hasPrice?: boolean;
  seller?: string | null;
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
  porqueCanalDetalhe?: string | null;
  comparativoCanais?: {
    plataforma?: string;
    label?: string;
    pros?: string[];
    contras?: string[];
    veredito?: string;
  }[];
  packUnits?: number;
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

export type RetailJob = {
  id: number;
  status: string;
  mode: string;
  batchSize: number;
  concurrency?: number;
  total: number;
  cursor: number;
  processed: number;
  failed: number;
  skipped: number;
  remainingInJob: number;
  progressPct: number;
  currentProductId?: string | null;
  lastError?: string | null;
  errors?: { id: string; error: string; at?: string }[];
  catalogPending?: number | null;
  catalogAnalyzed?: number | null;
  catalogPoolSize?: number | null;
  heartbeatAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  resumable?: boolean;
  running?: boolean;
};

export type RetailJobSnapshot = {
  job: RetailJob | null;
  catalogPending: number;
  catalogAnalyzed?: number;
  catalogPoolSize?: number;
  hasActiveJob: boolean;
  created?: boolean;
};

async function retailRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error("VITE_BI_API_URL nao configurada");
  const controller = new AbortController();
  const timeoutMs = path.includes("analyze-jobs") && init?.method === "POST" ? 60_000 : 45_000;
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Timeout na API - o job continua no servidor; atualize ou use Retomar.");
    }
    if (error instanceof TypeError) {
      throw new Error(
        "Falha de rede (Failed to fetch). Se o job ja iniciou, use Retomar; o progresso nao e perdido.",
      );
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export const retailApi = {
  configured: Boolean(API_URL),
  recommended: (top = 100) =>
    retailRequest<RetailRecommendedResponse>(`/api/v1/retail/recommended?top=${top}`),
  analysis: (id: string, refresh = false) =>
    retailRequest<RetailProduct>(
      `/api/v1/retail/products/${encodeURIComponent(id)}/analysis${refresh ? "?refresh=true" : ""}`,
    ),
  startJob: (mode: "batch" | "all" = "batch", batchSize = 10, resume = true) =>
    retailRequest<RetailJobSnapshot>(`/api/v1/retail/analyze-jobs`, {
      method: "POST",
      body: JSON.stringify({ mode, batchSize, resume }),
    }),
  jobStatus: () => retailRequest<RetailJobSnapshot>(`/api/v1/retail/analyze-jobs/active`),
  resumeJob: (id: number) =>
    retailRequest<RetailJobSnapshot>(`/api/v1/retail/analyze-jobs/${id}/resume`, {
      method: "POST",
    }),
  cancelJob: (id: number) =>
    retailRequest<RetailJobSnapshot>(`/api/v1/retail/analyze-jobs/${id}/cancel`, {
      method: "POST",
    }),
  economics: () => retailRequest<Record<string, unknown>>("/api/v1/retail/economics"),
};
