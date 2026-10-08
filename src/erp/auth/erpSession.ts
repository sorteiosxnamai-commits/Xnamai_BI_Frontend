import { ErpApiError, apiUrl, normalizeError } from "../api/errors";

/**
 * Sessão individual do ERP, independente do login do BI. O access token vive só
 * em memória; o refresh é um cookie httpOnly rotativo (path /api/v1/erp/auth).
 */
export type ErpSessionUser = {
  username: string;
  displayName?: string | null;
  roles: string[];
  mustChangePassword: boolean;
};
export type ErpSessionResult = { accessToken: string; expiresIn: number; user: ErpSessionUser };

let accessToken = "";
let refreshing: Promise<ErpSessionResult | null> | null = null;

export const erpAccessToken = () => accessToken;

async function post(path: string, body?: unknown, token?: string): Promise<Response> {
  const headers = new Headers();
  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${apiUrl()}/api/v1/erp/auth${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function parse(raw: string): ErpSessionResult {
  const data = JSON.parse(raw) as ErpSessionResult;
  accessToken = data.accessToken;
  return data;
}

export async function erpLogin(username: string, password: string): Promise<ErpSessionResult> {
  const response = await post("/login", { username, password });
  const raw = await response.text();
  if (!response.ok) throw normalizeError(response.status, raw);
  return parse(raw);
}

/** Renova pela cookie. Falha vira null e avisa a interface (evento). */
export function erpRefresh(): Promise<ErpSessionResult | null> {
  if (!apiUrl()) return Promise.resolve(null);
  if (refreshing) return refreshing;
  refreshing = post("/refresh")
    .then(async (response) => {
      if (!response.ok) {
        accessToken = "";
        return null;
      }
      return parse(await response.text());
    })
    .catch(() => null)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function erpLogout(): Promise<void> {
  accessToken = "";
  if (!apiUrl()) return;
  await post("/logout").catch(() => undefined);
}

export async function erpChangePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await post("/change-password", { currentPassword, newPassword }, accessToken);
  const raw = await response.text();
  if (!response.ok) throw normalizeError(response.status, raw);
}

export function clearErpSession() {
  accessToken = "";
}

export { ErpApiError };
