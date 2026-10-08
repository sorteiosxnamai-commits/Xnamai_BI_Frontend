import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cap, mockFetch } from "../test/utils";
import { validateNewPassword } from "./ChangePasswordForm";
import { ErpGuard } from "./ErpGuard";
import { clearErpSession, erpAccessToken } from "./erpSession";

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
vi.mock("../../pages/LoginPage", () => ({ LoginPage: () => <div>LOGIN DO BI</div> }));

const ME = {
  username: "ana@x.com",
  roles: ["comercial"],
  permissions: ["read"],
  bootstrap: false,
  authMethod: "erp_session",
  mustChangePassword: false,
  connectionId: "test",
  contractVersion: "erp-1",
};
const TOKENS = {
  accessToken: "erp-token-1",
  tokenType: "bearer",
  expiresIn: 900,
  user: { username: "ana@x.com", displayName: null, roles: ["comercial"], mustChangePassword: false },
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
  auth.user = null;
  auth.loading = false;
  session.refreshSession.mockReset();
  session.refreshSession.mockResolvedValue(null);
});
afterEach(() => {
  clearErpSession();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("sessão individual por cookie: não usa o login do BI e envia o token do ERP", async () => {
  const mock = mockFetch((call) => {
    if (call.url === "/auth/refresh") return { body: TOKENS };
    if (call.url === "/me") return { body: ME };
    if (call.url === "/capabilities") return { body: { connectionId: "test", items: [cap("write.customers")] } };
  });
  renderGuard();
  expect(await screen.findByText("CONTEÚDO ERP")).toBeInTheDocument();
  expect(session.refreshSession).not.toHaveBeenCalled();
  const me = mock.calls.find((c) => c.url === "/me");
  expect(me?.headers.get("Authorization")).toBe("Bearer erp-token-1");
});

test("login individual: usuário e senha vão ao ERP e a sessão passa a valer", async () => {
  let logged = false;
  const mock = mockFetch((call) => {
    if (call.url === "/auth/refresh") return { status: 401, body: { detail: { code: "session_expired", message: "Sessão expirada" } } };
    if (call.url === "/auth/login") {
      logged = true;
      return { body: TOKENS };
    }
    if (call.url === "/me") return logged ? { body: ME } : { status: 401, body: { detail: { code: "unauthenticated", message: "x" } } };
    if (call.url === "/capabilities") return { body: { connectionId: "test", items: [] } };
  });
  renderGuard();
  await userEvent.type(await screen.findByLabelText("Usuário"), "ana@x.com");
  await userEvent.type(screen.getByLabelText("Senha"), "Correct-Horse-Battery-9");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText("CONTEÚDO ERP")).toBeInTheDocument();
  const login = mock.calls.find((c) => c.url === "/auth/login");
  expect(login?.body).toEqual({ username: "ana@x.com", password: "Correct-Horse-Battery-9" });
  expect(erpAccessToken()).toBe("erp-token-1");
});

test("credencial inválida mostra a mensagem genérica e não entra", async () => {
  mockFetch((call) => {
    if (call.url === "/auth/refresh") return { status: 401, body: { detail: { code: "session_expired", message: "x" } } };
    if (call.url === "/auth/login") return { status: 401, body: { detail: { code: "invalid_credentials", message: "Usuário ou senha inválidos" } } };
  });
  renderGuard();
  await userEvent.type(await screen.findByLabelText("Usuário"), "ana@x.com");
  await userEvent.type(screen.getByLabelText("Senha"), "errada");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Usuário ou senha inválidos");
  expect(screen.queryByText("CONTEÚDO ERP")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Senha")).toHaveValue("");
});

test("conta bloqueada (423) é informada", async () => {
  mockFetch((call) => {
    if (call.url === "/auth/refresh") return { status: 401, body: { detail: { code: "session_expired", message: "x" } } };
    if (call.url === "/auth/login") return { status: 423, body: { detail: { code: "account_locked", message: "Conta temporariamente bloqueada por tentativas inválidas" } } };
  });
  renderGuard();
  await userEvent.type(await screen.findByLabelText("Usuário"), "ana@x.com");
  await userEvent.type(screen.getByLabelText("Senha"), "x");
  await userEvent.click(screen.getByRole("button", { name: "Entrar" }));
  expect(await screen.findByText(/temporariamente bloqueada/)).toBeInTheDocument();
});

test("senha temporária: a troca é obrigatória e o ERP não carrega antes", async () => {
  const mock = mockFetch((call) => {
    if (call.url === "/auth/refresh") return { body: { ...TOKENS, user: { ...TOKENS.user, mustChangePassword: true } } };
    if (call.url === "/me") return { body: { ...ME, mustChangePassword: true } };
    if (call.url === "/auth/change-password") return { body: { status: "ok" } };
  });
  renderGuard();
  expect(await screen.findByRole("heading", { name: "Defina a sua senha" })).toBeInTheDocument();
  expect(screen.queryByText("CONTEÚDO ERP")).not.toBeInTheDocument();
  expect(mock.calls.some((c) => c.url === "/capabilities")).toBe(false);
  // validações locais
  await userEvent.type(screen.getByLabelText("Senha atual"), "temporaria-123");
  await userEvent.type(screen.getByLabelText(/Nova senha/), "curta");
  await userEvent.click(screen.getByRole("button", { name: "Salvar nova senha" }));
  expect(await screen.findByText(/ao menos 12 caracteres/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText(/Nova senha/)).toHaveFocus());
  expect(mock.calls.some((c) => c.url === "/auth/change-password")).toBe(false);
});

test("regras da nova senha", () => {
  expect(validateNewPassword("a", "curta", "curta")).toMatch(/12/);
  expect(validateNewPassword("Mesma-senha-123", "Mesma-senha-123", "Mesma-senha-123")).toMatch(/diferente/);
  expect(validateNewPassword("a", "Outra-senha-forte-1", "Outra-senha-forte-2")).toMatch(/confirmação/);
  expect(validateNewPassword("a", "Outra-senha-forte-1", "Outra-senha-forte-1")).toBeNull();
});

test("o login do BI não identifica pessoas: 403 oferece entrar com usuário do ERP", async () => {
  auth.user = { username: "viewer", role: "viewer" };
  mockFetch((call) => {
    if (call.url === "/auth/refresh") return { status: 401, body: { detail: { code: "session_expired", message: "x" } } };
    if (call.url === "/me") return { status: 403, body: { detail: { code: "no_erp_access", message: "Usuário autenticado sem vínculo de acesso ao ERP" } } };
  });
  renderGuard();
  expect(await screen.findByText("Sem acesso ao ERP")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Entrar com usuário do ERP" })).toBeInTheDocument();
});

test("administrador de bootstrap pode escolher o login do BI na tela de login", async () => {
  mockFetch((call) => {
    if (call.url === "/auth/refresh") return { status: 401, body: { detail: { code: "session_expired", message: "x" } } };
  });
  renderGuard();
  await userEvent.click(await screen.findByRole("button", { name: /entrar com o login do BI/ }));
  expect(await screen.findByText("LOGIN DO BI")).toBeInTheDocument();
});
