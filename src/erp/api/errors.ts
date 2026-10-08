/** Erro de API com código estável: 401, 403, 404 (módulo desativado), 409, 422, 503. */
export class ErpApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: Record<string, unknown>;

  constructor(status: number, code: string, message: string, detail: Record<string, unknown> = {}) {
    super(message);
    this.name = "ErpApiError";
    this.status = status;
    this.code = code;
    this.detail = detail;
  }

  get disabled(): boolean {
    return this.status === 404 && this.code === "erp_disabled";
  }
}

export function apiUrl(): string {
  return (import.meta.env.VITE_BI_API_URL || "").replace(/\/$/, "");
}

export function normalizeError(status: number, raw: string): ErpApiError {
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    body = null;
  }
  const record = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const detail = record.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const d = detail as Record<string, unknown>;
    return new ErpApiError(
      status,
      typeof d.code === "string" ? d.code : `http_${status}`,
      typeof d.message === "string" ? d.message : `Erro ${status}`,
      d,
    );
  }
  if (Array.isArray(detail)) {
    // 422 do FastAPI: lista de problemas de validação
    const message = detail
      .map((item) => {
        const entry = item as { loc?: unknown[]; msg?: string };
        return `${(entry.loc || []).slice(1).join(".")}: ${entry.msg ?? "inválido"}`;
      })
      .join("; ");
    return new ErpApiError(status, "validation_error", message || "Dados inválidos", { issues: detail });
  }
  if (typeof detail === "string") return new ErpApiError(status, `http_${status}`, detail);
  if (typeof record.message === "string") {
    return new ErpApiError(status, typeof record.code === "string" ? record.code : `http_${status}`, record.message);
  }
  return new ErpApiError(status, `http_${status}`, raw.slice(0, 200) || `Erro ${status}`);
}

