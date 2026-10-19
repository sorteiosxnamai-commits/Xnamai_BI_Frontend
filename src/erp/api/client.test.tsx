import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { z } from "zod";
import { clearErpSession } from "../auth/erpSession";
import { ERP_AUTH_EXPIRED, ErpApiError, erpRequest } from "./client";

const session = vi.hoisted(() => ({
  refreshSession: vi.fn<() => Promise<unknown>>(async () => null),
}));
vi.mock("../../auth/session", () => ({
  refreshSession: session.refreshSession,
  authenticatedFetch: (input: string, init?: RequestInit) => fetch(input, init),
}));

beforeEach(() => {
  vi.stubEnv("VITE_BI_API_URL", "https://api.test");
});
afterEach(() => {
  clearErpSession();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  session.refreshSession.mockReset();
  session.refreshSession.mockResolvedValue(null);
});

test("401 sem renovação vira erro de sessão expirada e avisa a interface, não lista vazia", async () => {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ detail: "Sessão inválida ou expirada" }), { status: 401 });
    }),
  );
  const expired = vi.fn();
  window.addEventListener(ERP_AUTH_EXPIRED, expired);
  const error = await erpRequest("/integration/runs", z.object({ items: z.array(z.unknown()) })).catch((e) => e);
  window.removeEventListener(ERP_AUTH_EXPIRED, expired);
  expect(error).toBeInstanceOf(ErpApiError);
  expect(error.status).toBe(401);
  expect(error.code).toBe("session_expired");
  expect(expired).toHaveBeenCalledTimes(1);
  expect(session.refreshSession).toHaveBeenCalledTimes(1); // tentou renovar uma única vez
  expect(calls).toHaveLength(1); // sem segunda chamada quando não renovou
});

test("401 renovado repete a chamada uma vez e devolve os dados", async () => {
  session.refreshSession.mockResolvedValue({ accessToken: "novo" });
  let n = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      n += 1;
      return n === 1
        ? new Response("{}", { status: 401 })
        : new Response(JSON.stringify({ items: [1] }), { status: 200 });
    }),
  );
  const data = await erpRequest("/integration/status", z.object({ items: z.array(z.number()) }));
  expect(data.items).toEqual([1]);
  expect(n).toBe(2);
});

test("401 persistente após renovar a sessão avisa o guard e não mostra lista vazia", async () => {
  session.refreshSession.mockResolvedValue({ accessToken: "novo" });
  const fetchMock = vi.fn(async () => new Response("{}", { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
  const expired = vi.fn();
  window.addEventListener(ERP_AUTH_EXPIRED, expired);
  try {
    const error = await erpRequest("/sales-orders?dateFrom=2025-01-01", z.object({ items: z.array(z.unknown()) }))
      .catch((e) => e);
    expect(error).toBeInstanceOf(ErpApiError);
    expect(error.code).toBe("session_expired");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(expired).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener(ERP_AUTH_EXPIRED, expired);
  }
});
