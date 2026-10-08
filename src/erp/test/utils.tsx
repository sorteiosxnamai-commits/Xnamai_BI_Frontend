import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";
import { ErpContext, type ErpContextValue } from "../auth/context";
import type { Capability } from "../api/schemas";

export const CONNECTION = "test";

export function cap(key: string, overrides: Partial<Capability> = {}): Capability {
  return {
    key,
    label: key,
    area: "write",
    situation: "A",
    supportedByAdaptor: true,
    documentedByProvider: true,
    accountAccess: "unknown",
    implementedInErp: true,
    enabled: true,
    lastValidatedAt: null,
    reason: null,
    source: null,
    ...overrides,
  };
}

export function erpContext(
  permissions: string[] = ["*"],
  capabilities: Capability[] = [],
): ErpContextValue {
  const set = new Set(permissions);
  return {
    me: {
      username: "admin@xnamai.com",
      roles: ["erp_admin"],
      permissions,
      bootstrap: true,
      connectionId: CONNECTION,
      contractVersion: "erp-1",
    },
    connectionId: CONNECTION,
    capabilities,
    can: (permission) => set.has("*") || set.has(permission),
    capability: (key) => capabilities.find((item) => item.key === key),
    signOut: async () => undefined,
  };
}

export function renderErp(
  ui: ReactElement,
  options: { context?: ErpContextValue; route?: string } = {},
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
  });
  const result = render(
    <QueryClientProvider client={client}>
      <ErpContext.Provider value={options.context ?? erpContext()}>
        <MemoryRouter initialEntries={[options.route ?? "/"]}>{ui}</MemoryRouter>
      </ErpContext.Provider>
    </QueryClientProvider>,
  );
  return { ...result, client };
}

export type Call = { url: string; method: string; headers: Headers; body: unknown };
type Handler = (call: Call) => { status?: number; body?: unknown } | undefined;

/** Fetch simulado: nenhum teste toca rede real nem o Mercos. */
export function mockFetch(handler: Handler) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    let body: unknown ;
    if (typeof init?.body === "string") body = JSON.parse(init.body);
    const call: Call = {
      url: String(input).replace("https://api.test/api/v1/erp", ""),
      method: init?.method ?? "GET",
      headers,
      body,
    };
    calls.push(call);
    const reply = handler(call) ?? { status: 404, body: { detail: { code: "not_mocked", message: call.url } } };
    return new Response(JSON.stringify(reply.body ?? null), {
      status: reply.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return { calls, fn };
}

export function page<T>(items: T[], extra: Record<string, unknown> = {}) {
  return {
    items,
    page: 1,
    pageSize: 25,
    totalItems: items.length,
    totalPages: items.length ? 1 : 0,
    sort: "name",
    order: "asc",
    appliedFilters: {},
    ...extra,
  };
}
