import { z } from "zod";
import { authenticatedFetch, refreshSession } from "../../auth/session";
import { erpAccessToken, erpRefresh } from "../auth/erpSession";
import { apiUrl, ErpApiError, normalizeError } from "./errors";

export { apiUrl, ErpApiError };

/** Disparado quando um 401 não pôde ser renovado; o ErpGuard volta ao login. */
export const ERP_AUTH_EXPIRED = "erp-auth-expired";

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
};

async function send(url: string, options: RequestOptions, signal: AbortSignal): Promise<Response> {
  const headers = new Headers();
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  const token = erpAccessToken();
  if (token) {
    // sessão individual do ERP; o token do BI só é usado pelo admin de bootstrap
    headers.set("Authorization", `Bearer ${token}`);
    return fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal,
      credentials: "include",
    });
  }
  return authenticatedFetch(url, {
    method: options.method || "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal,
  });
}

/**
 * Chamada ao backend ERP (/api/v1/erp). O navegador nunca fala com o Mercos nem
 * com o Adaptor, e nenhum token Mercos / X-API-Key existe aqui.
 */
export async function erpRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const base = apiUrl();
  if (!base) throw new ErpApiError(0, "not_configured", "VITE_BI_API_URL não configurada");
  const url = `${base}/api/v1/erp${path}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);
  const onAbort = () => controller.abort();
  options.signal?.addEventListener("abort", onAbort);
  try {
    let response = await send(url, options, controller.signal);
    if (response.status === 401) {
      // Sessão de acesso expirada: renova uma vez e repete (só leituras e
      // escritas ainda não aceitas, pois 401 nunca chegou à regra de negócio).
      const renewed = erpAccessToken() ? await erpRefresh() : await refreshSession();
      if (renewed) response = await send(url, options, controller.signal);
      if (!renewed && response.status === 401) {
        // Sem como renovar (cookie de renovação ausente/expirado): é falha de autenticação,
        // nunca uma lista vazia. A interface volta ao login e explica o motivo.
        window.dispatchEvent(new Event(ERP_AUTH_EXPIRED));
        throw new ErpApiError(401, "session_expired", "Sessão expirada. Entre novamente para continuar.");
      }
    }
    const raw = await response.text();
    if (!response.ok) throw normalizeError(response.status, raw);
    let json: unknown;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      throw new ErpApiError(response.status, "invalid_json", "Resposta inválida do servidor ERP");
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ErpApiError(
        response.status,
        "invalid_contract",
        `Contrato inválido da API ERP: ${z.prettifyError(parsed.error)}`,
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // Para escrita, o servidor pode ter recebido: nunca afirmar falha.
      throw new ErpApiError(0, "timeout", "Tempo esgotado ao consultar o ERP");
    }
    if (error instanceof TypeError) {
      // fetch rejeitado: a conexão caiu; o servidor pode ou não ter recebido.
      throw new ErpApiError(0, "network", "Falha de rede ao falar com o ERP");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Baixa um arquivo (ex.: relatório CSV) com a mesma sessão e a mesma renovação de login das demais
 * chamadas. Devolve o Blob e se o servidor avisou que o relatório foi truncado.
 */
export async function erpDownload(path: string): Promise<{ blob: Blob; truncated: boolean }> {
  const base = apiUrl();
  if (!base) throw new ErpApiError(0, "not_configured", "VITE_BI_API_URL não configurada");
  const url = `${base}/api/v1/erp${path}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 60_000);
  try {
    let response = await send(url, {}, controller.signal);
    if (response.status === 401) {
      const renewed = erpAccessToken() ? await erpRefresh() : await refreshSession();
      if (renewed) response = await send(url, {}, controller.signal);
      if (!renewed && response.status === 401) {
        window.dispatchEvent(new Event(ERP_AUTH_EXPIRED));
        throw new ErpApiError(401, "session_expired", "Sessão expirada. Entre novamente para continuar.");
      }
    }
    if (!response.ok) throw normalizeError(response.status, await response.text());
    return { blob: await response.blob(), truncated: response.headers.get("X-Report-Truncated") === "true" };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ErpApiError(0, "timeout", "Tempo esgotado ao gerar o relatório");
    }
    if (error instanceof TypeError) throw new ErpApiError(0, "network", "Falha de rede ao baixar o relatório");
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
