import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cap, mockFetch } from "../test/utils";
import { ErpGuard } from "./ErpGuard";
import { clearErpSession } from "./erpSession";

const auth = vi.hoisted(() => ({
  user: null as null | { username: string; role: "admin" | "viewer" },
  loading: false,
  signOut: vi.fn(async () => undefined),
}));
const session = vi.hoisted(() => ({
  refreshSession: vi.fn<() => Promise<unknown>>(async () => null),
}));

vi.mock("../../auth/AuthProvider", () => ({ useAuth: () => auth }));
vi.mock("../../auth/session", () => ({
  refreshSession: session.refreshSession,
  authenticatedFetch: (input: string, init?: RequestInit) => fetch(input, init),
}));
vi.mock("../../theme/AppearanceSelect", () => ({ AppearanceSelect: () => null }));
vi.mock("../../pages/LoginPage", () => ({ LoginPage: () => <div>TELA DE LOGIN</div> }));

const ME = {
  username: "admin@xnamai.com",
  roles: ["erp_admin"],
  permissions: ["*"],
  bootstrap: true,
  connectionId: "test",
  contractVersion: "erp-1",
};

function renderGuard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ErpGuard>
          <div>CONTEÚDO ERP</div>
        </ErpGuard>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.stubEnv("VITE_BI_API_URL", "https://api.test");
  auth.user = { username: "admin@xnamai.com", role: "admin" };
  auth.loading = false;
  session.refreshSession.mockReset();
  session.refreshSession.mockResolvedValue(null);
});
afterEach(() => {
  clearErpSession();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("autorizado: /me e /capabilities liberam o conteúdo", async () => {
  mockFetch((call) => {
    if (call.url === "/me") return { body: ME };
    if (call.url === "/capabilities") return { body: { connectionId: "test", items: [cap("write.customers")] } };
  });
  renderGuard();
  expect(await screen.findByText("CONTEÚDO ERP")).toBeInTheDocument();
});

test("módulo desativado (404 erp_disabled) tem tela própria", async () => {
  mockFetch(() => ({ status: 404, body: { detail: { code: "erp_disabled", message: "Módulo ERP desativado" } } }));
  renderGuard();
  expect(await screen.findByText("Módulo ERP desativado")).toBeInTheDocument();
  expect(screen.queryByText("CONTEÚDO ERP")).not.toBeInTheDocument();
});

test("autenticado sem vínculo ERP (403) não vê o ERP, mesmo sendo admin do BI", async () => {
  mockFetch(() => ({ status: 403, body: { detail: { code: "no_erp_access", message: "Usuário autenticado sem vínculo de acesso ao ERP" } } }));
  renderGuard();
  expect(await screen.findByText("Sem acesso ao ERP")).toBeInTheDocument();
  expect(screen.queryByText("CONTEÚDO ERP")).not.toBeInTheDocument();
});

test("sessão expirada (401) volta ao login", async () => {
  mockFetch(() => ({ status: 401, body: { detail: { code: "unauthenticated", message: "Não autenticado" } } }));
  renderGuard();
  expect(await screen.findByRole("heading", { name: "Acesso ao ERP" })).toBeInTheDocument();
  expect(screen.queryByText("CONTEÚDO ERP")).not.toBeInTheDocument();
});

test("portal → ERP: sem usuário no provider, renova a sessão pelo cookie", async () => {
  auth.user = null;
  session.refreshSession.mockResolvedValue({ accessToken: "t", user: { username: "admin@xnamai.com", role: "admin" } });
  mockFetch((call) => {
    if (call.url === "/me") return { body: ME };
    if (call.url === "/capabilities") return { body: { connectionId: "test", items: [] } };
  });
  renderGuard();
  expect(await screen.findByText("CONTEÚDO ERP")).toBeInTheDocument();
  expect(session.refreshSession).toHaveBeenCalledTimes(1);
});

test("sem cookie nem usuário: mostra o login do ERP e só tenta renovar a sessão", async () => {
  auth.user = null;
  const mock = mockFetch(() => undefined);
  renderGuard();
  expect(await screen.findByRole("heading", { name: "Acesso ao ERP" })).toBeInTheDocument();
  expect(mock.calls.map((c) => c.url)).toEqual(["/auth/refresh"]);
});

test("erro de servidor oferece tentar novamente", async () => {
  mockFetch(() => ({ status: 503, body: { detail: { code: "x", message: "Banco indisponível" } } }));
  renderGuard();
  expect(await screen.findByText("Banco indisponível")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
});
