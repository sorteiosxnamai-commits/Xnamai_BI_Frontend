export type AuthUser = { username: string; role: "admin" | "viewer" };
export type AuthResult = {
  accessToken: string;
  tokenType: "bearer";
  expiresIn: number;
  user: AuthUser;
};

const API_URL = (import.meta.env.VITE_BI_API_URL || "").replace(/\/$/, "");
let accessToken = "";
let refreshPromise: Promise<AuthResult | null> | null = null;

async function readAuthResponse(response: Response): Promise<AuthResult> {
  const raw = await response.text();
  if (!response.ok) {
    let message = raw || "Falha de autenticacao";
    try {
      const parsed = JSON.parse(raw) as { detail?: unknown };
      if (typeof parsed.detail === "string" && parsed.detail) message = parsed.detail;
    } catch {
      /* keep raw body */
    }
    throw new Error(message);
  }
  return JSON.parse(raw) as AuthResult;
}

function applySession(result: AuthResult) {
  accessToken = result.accessToken;
  return result;
}

export async function login(username: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  return applySession(await readAuthResponse(response));
}

export async function refreshSession(): Promise<AuthResult | null> {
  if (!API_URL) return null;
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_URL}/api/v1/auth/refresh`, {
    method: "POST",
    credentials: "include",
  })
    .then(async (response) => {
      if (!response.ok) {
        accessToken = "";
        window.dispatchEvent(new Event("bi-auth-expired"));
        return null;
      }
      return applySession(await readAuthResponse(response));
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function logout(): Promise<void> {
  accessToken = "";
  if (!API_URL) return;
  await fetch(`${API_URL}/api/v1/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function authenticatedFetch(
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

export const authConfigured = Boolean(API_URL);
