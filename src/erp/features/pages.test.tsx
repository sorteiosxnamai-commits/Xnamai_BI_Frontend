import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { cap, erpContext, mockFetch, page, renderErp } from "../test/utils";
import { CapabilitiesPage } from "./CapabilitiesPage";
import { CustomersPage } from "./customers/CustomersPage";
import { ExternalPage } from "./ExternalPage";
import { IntegrationPage } from "./integration/IntegrationPage";
import { InventoryPage } from "./inventory/InventoryPage";
import { OverviewPage } from "./OverviewPage";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const disabledWrite = cap("write.customers", { enabled: false, reason: "Flag ERP_WRITE_CUSTOMERS desligada" });

test("capacidade desligada: aviso com motivo e nenhum botão de criar", async () => {
  mockFetch(() => ({ body: page([]) }));
  renderErp(<CustomersPage />, { context: erpContext(["*"], [disabledWrite]) });
  expect(await screen.findByText(/Flag ERP_WRITE_CUSTOMERS desligada/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Novo cliente" })).not.toBeInTheDocument();
});

test("capacidade ligada mostra 'Novo cliente'; perfil sem permissão não vê", async () => {
  mockFetch(() => ({ body: page([]) }));
  const enabled = cap("write.customers");
  const a = renderErp(<CustomersPage />, { context: erpContext(["*"], [enabled]) });
  expect(await screen.findByRole("button", { name: "Novo cliente" })).toBeInTheDocument();
  a.unmount();
  renderErp(<CustomersPage />, { context: erpContext(["read"], [enabled]) });
  await screen.findByText("Clientes");
  expect(screen.queryByRole("button", { name: "Novo cliente" })).not.toBeInTheDocument();
});

test("visão geral: dado indisponível não vira zero e o resumo de pedidos mostra a cobertura", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/operational-summary")) {
      return {
        body: {
          filters: {},
          coverage: { complete: false, resources: { orders: "running", customers: "never" }, note: "Importação parcial." },
          orders: { count: 7, byKind: { order: 7 } },
          values: { net: "700.00", gross: "700.00", note: "Valor vendido; não é valor recebido." },
          variation: { available: false, reason: "Sem período definido para comparar" },
          payment: { byStatus: { unknown: 7 }, pix: { available: false, reason: "Sem provedor de Pix" } },
          pendencies: { itemsIncomplete: 2, customerMissing: 1, any: 3 },
        },
      };
    }
    return {
    body: {
      connectionId: "test",
      generatedAt: "2026-10-07T12:00:00+00:00",
      source: "Mercos (espelho ERP)",
      dataThrough: null,
      enabled: true,
      resources: [
        { resource: "customers", label: "Clientes", status: "never", records: null, dataThrough: null, lastSuccessAt: null },
        { resource: "orders", label: "Pedidos e orçamentos", status: "success", records: 12, dataThrough: "2026-10-07T10:00:00+00:00", lastSuccessAt: "2026-10-07T10:05:00+00:00", unresolved: 0 },
      ],
      operations: { unknown: 2, failed: 1 },
      openConflicts: 1,
      pendingReferences: [{ resource: "orders", field: "customerId", target: "customers", pending: 3 }],
    },
    };
  });
  renderErp(<OverviewPage />);
  expect(await screen.findByRole("heading", { name: "Visão Geral" })).toBeInTheDocument();
  expect(await screen.findByText("Parcial")).toBeInTheDocument(); // cobertura da importação
  expect(screen.getByText(/Valor vendido; não é valor recebido/)).toBeInTheDocument();
  expect(screen.getByText(/Variação indisponível: Sem período definido/)).toBeInTheDocument();
  expect(await screen.findByText("indisponível")).toBeInTheDocument();
  expect(screen.getByText(/data de corte indisponível/)).toBeInTheDocument();
  expect(screen.getByText("12")).toBeInTheDocument();
  expect(screen.getByText("Há operações aguardando decisão")).toBeInTheDocument();
  expect(screen.getByText(/2 em verificação/)).toBeInTheDocument();
});

test("matriz de capacidades mostra implementado ≠ habilitado e o motivo", async () => {
  const items = [
    cap("read.titles", { label: "Consultar títulos", implementedInErp: false, enabled: false, supportedByAdaptor: false, reason: "Exige extensão do Mercos Adaptor" }),
    cap("read.customers", { label: "Leitura: Clientes", enabled: true, accountAccess: "allowed" }),
  ];
  renderErp(<CapabilitiesPage />, { context: erpContext(["*"], items) });
  expect(screen.getByText("Exige extensão do Mercos Adaptor")).toBeInTheDocument();
  expect(screen.getByText("Pendente")).toBeInTheDocument();
  await userEvent.click(screen.getByLabelText(/Somente indisponíveis/));
  expect(screen.queryByText("Leitura: Clientes")).not.toBeInTheDocument();
  expect(screen.getByText("Consultar títulos")).toBeInTheDocument();
});

test("recursos externos pendentes mostram motivo e não oferecem ação", async () => {
  mockFetch(() => ({
    body: {
      items: [],
      availability: { capability: "read.titles", enabled: false, implementedInErp: false, supportedByAdaptor: false, reason: "Exige extensão do Mercos Adaptor" },
    },
  }));
  renderErp(<ExternalPage />);
  expect(await screen.findByText("Recurso ainda não disponível")).toBeInTheDocument();
  expect(screen.getByText(/Exige extensão do Mercos Adaptor/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /criar|enviar|baixar/i })).not.toBeInTheDocument();
});

const status = {
  connectionId: "test",
  adaptorConfigured: true,
  writeKeyConfigured: false,
  webhookConfigured: false,
  resources: [
    { resource: "customers", label: "Clientes", upstream: "clientes (v1)", localRecords: 10, unmappedFields: 2, status: "success", cursor: null, transportCursor: null, dataThrough: null, lastSuccessAt: null, lastAttemptAt: null, unresolved: 0, retryAfter: null, error: null },
    { resource: "orders", label: "Pedidos e orçamentos", upstream: "pedidos (v2)", localRecords: null, unmappedFields: 0, status: "waiting_rate_limit", cursor: null, transportCursor: null, dataThrough: null, lastSuccessAt: null, lastAttemptAt: null, unresolved: 0, retryAfter: "2026-10-07T12:30:00+00:00", error: "Mercos limitou as requisições" },
  ],
  jobs: { queued: 1 },
  pendingReferences: [],
};

test("'Sincronizar' agenda job no backend (202) e não percorre páginas no navegador", async () => {
  const mock = mockFetch((call) => {
    if (call.url === "/integration/status") return { body: status };
    if (call.method === "POST" && call.url === "/integration/sync") {
      return { status: 202, body: { jobId: 7, kind: "sync", resource: "customers", mode: "incremental", status: "queued", attempts: 0, statusUrl: "/api/v1/erp/integration/jobs/7", created: true } };
    }
    if (call.url === "/integration/jobs/7") return { body: { jobId: 7, kind: "sync", resource: "customers", mode: "incremental", status: "queued", attempts: 0, statusUrl: "/x" } };
  });
  renderErp(<IntegrationPage />, { route: "/erp/integracoes" });
  expect(await screen.findByText("Webhook")).toBeInTheDocument();
  expect(screen.getByText(/Ausente \(escritas bloqueadas\)/)).toBeInTheDocument();
  expect(screen.getByText("indisponível")).toBeInTheDocument();
  const buttons = screen.getAllByRole("button", { name: "Sincronizar" });
  await userEvent.click(buttons[0]);
  expect(await screen.findByText(/Job 7/)).toBeInTheDocument();
  const posts = mock.calls.filter((c) => c.method === "POST");
  expect(posts).toHaveLength(1);
  expect(posts[0].body).toEqual({ resource: "customers", full: false });
  // nenhuma chamada a rotas do Mercos/Adaptor a partir do navegador
  expect(mock.calls.every((c) => !c.url.includes("mercos") && !c.url.startsWith("/v1/"))).toBe(true);
});

test("operação unknown na lista não oferece 'tentar de novo'; oferece reconciliar", async () => {
  const unknownOp = {
    operationId: "aaaaaaaa-0000-0000-0000-000000000001", kind: "create_customer", status: "unknown",
    targetResource: "customers", targetId: null, externalId: null, operator: "admin@xnamai.com", attempts: 1,
    errorCode: "transport", error: "Resultado desconhecido: ReadTimeout", nextAttemptAt: null, completedAt: null,
    mirrorConfirmedAt: null, createdAt: "2026-10-07T12:00:00+00:00", statusUrl: "/x", synchronized: false,
    canReconcile: true, canRetry: false, reconcileEvidence: null,
  };
  mockFetch((call) => {
    if (call.url.startsWith("/integration/operations?")) return { body: page([unknownOp], { sort: "createdAt", order: "desc" }) };
    if (call.url === `/integration/operations/${unknownOp.operationId}`) return { body: unknownOp };
  });
  renderErp(<IntegrationPage />, { route: "/erp/integracoes?aba=operacoes" });
  await userEvent.click(await screen.findByText("Criar cliente"));
  expect(await screen.findByText("Reconciliar resultado desconhecido")).toBeInTheDocument();
  expect(screen.getAllByText(/não será reenviada automaticamente/i).length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: /tentar de novo|reenviar/i })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Verificar evidências no espelho" })).toBeInTheDocument();
  // confirmar decisão exige confirmação explícita
  await userEvent.type(screen.getByLabelText("ID externo confirmado"), "55");
  await userEvent.click(screen.getByRole("button", { name: "Foi criado no Mercos…" }));
  expect(screen.getByText("Confirmar que o Mercos registrou")).toBeInTheDocument();
});

test("estoque: movimentos oficiais bloqueados em modo consulta ao saldo Mercos", async () => {
  mockFetch((call) => {
    if (call.url === "/inventory/authority") {
      return { body: { scope: "default", authority: "mercos", effective: false, cutoverAt: null, reconciledAt: null, publishEnabled: false, publishReason: "pendente no Adaptor", movementsEnabled: false, movementsReason: "Modo consulta ao saldo Mercos: movimentos oficiais exigem corte e autoridade ERP" } };
    }
    if (call.url === "/inventory/warehouses") return { body: { items: [] } };
    if (call.url.startsWith("/inventory/balances")) {
      return { body: { ...page([]), authority: { scope: "default", authority: "mercos", effective: false, cutoverAt: null, reconciledAt: null, publishEnabled: false, publishReason: "x", movementsEnabled: false, movementsReason: "Modo consulta ao saldo Mercos: movimentos oficiais exigem corte e autoridade ERP" } } };
    }
  });
  renderErp(<InventoryPage />);
  expect((await screen.findAllByText(/Mercos \(modo consulta\)/)).length).toBeGreaterThan(0);
  const confirm = await screen.findByRole("button", { name: "Confirmar ajuste" });
  expect(confirm).toBeDisabled();
  expect(screen.getByRole("button", { name: "Reservar" })).toBeDisabled();
});
