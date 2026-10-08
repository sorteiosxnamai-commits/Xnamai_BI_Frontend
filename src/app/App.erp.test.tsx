import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AuthProvider } from "../auth/AuthProvider";
import { clearErpSession } from "../erp/auth/erpSession";
import { AppearanceProvider } from "../theme/AppearanceProvider";
import { App } from "./App";

// O primeiro /erp baixa o chunk do ERP (muitos módulos): sob carga passa de 5s.
vi.setConfig({ testTimeout: 60_000 });

function matchMedia() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <AppearanceProvider>
          <MemoryRouter initialEntries={[path]}>
            <App />
          </MemoryRouter>
        </AppearanceProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  matchMedia();
  vi.stubEnv("VITE_BI_API_URL", "https://api.test");
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ detail: "Sessão expirada" }), { status: 401 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  clearErpSession();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const erpRefreshCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/api/v1/erp/auth/refresh")).length;

test("flag desligada: /erp não abre e volta ao portal", async () => {
  renderAt("/erp");
  expect(await screen.findByText("Escolha o ambiente")).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Acesso ao ERP" })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});

test("flag ligada: /erp/... entra no guard do ERP e pede o login individual do ERP", async () => {
  vi.stubEnv("VITE_ERP_ENABLED", "true");
  renderAt("/erp/clientes");
  expect(await screen.findByRole("heading", { name: "Acesso ao ERP" })).toBeInTheDocument();
  expect(erpRefreshCalls()).toBeGreaterThan(0);
  // o login do BI continua sendo outra tela, não a do ERP
  expect(screen.queryByRole("heading", { name: "Acesso ao BI" })).not.toBeInTheDocument();
});

test("/erpfoo NÃO é rota do ERP: segue para o BI sem acionar o guard do ERP", async () => {
  vi.stubEnv("VITE_ERP_ENABLED", "true");
  renderAt("/erpfoo");
  expect(await screen.findByRole("heading", { name: "Acesso ao BI" })).toBeInTheDocument();
  expect(erpRefreshCalls()).toBe(0);
});

test("o portal continua em / com a flag ligada", async () => {
  vi.stubEnv("VITE_ERP_ENABLED", "true");
  renderAt("/");
  expect(await screen.findByRole("link", { name: "Entrar no ERP" })).toHaveAttribute("href", "/erp");
  expect(screen.getByRole("link", { name: "Entrar no BI" })).toHaveAttribute("href", "/overview");
});
