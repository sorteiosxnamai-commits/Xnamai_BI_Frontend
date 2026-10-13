import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { erpContext, mockFetch, page, renderErp } from "../test/utils";
import { IntegrationPage } from "./integration/IntegrationPage";
import { OverviewPage } from "./OverviewPage";
import { OrderDetailPage } from "./orders/OrderDetailPage";
import { OrdersPage } from "./orders/OrdersPage";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ALLOWED = { allowed: true, code: null, reason: null };
const CANCELLED = (what: string) => ({ allowed: false, code: "order_cancelled", reason: `Pedido cancelado não ${what}` });

function listOrder(id: string, extra: Record<string, unknown> = {}, operational: Record<string, unknown> = {}) {
  return {
    id,
    number: id,
    kind: "order",
    customerId: "10",
    customerName: "Mercado Central",
    sellerId: null,
    issuedAt: "2026-10-06T12:00:00+00:00",
    issueDate: "2026-10-06",
    netTotal: "99.00",
    grossTotal: "99.00",
    discountTotal: null,
    totalsUnknown: false,
    itemCount: 2,
    itemsComplete: true,
    statuses: { commercial: "2", billing: null, fulfillment: "not_started", payment: null },
    version: 1,
    sourceUpdatedAt: "2026-10-05T09:30:00+00:00",
    sourceDeleted: false,
    capturedAt: "2026-10-07T08:00:00+00:00",
    operational: {
      customerName: "Mercado Central",
      responsible: { sellerId: null, name: null },
      state: { code: "in_progress", label: "Em andamento" },
      itemsPreview: [],
      totals: { gross: "99.00", discount: null, freight: null, net: "99.00", unknown: false },
      actions: { shipping: ALLOWED, invoice: ALLOWED, receivable: ALLOWED },
      pendencies: [],
      lastExternalUpdateAt: "2026-10-05T09:30:00+00:00",
      lastHumanAction: null,
      shipping: { state: "none" },
      invoice: { state: "none" },
      payment: { state: "unknown" },
      pix: { state: "unknown" },
      ...operational,
    },
    ...extra,
  };
}

const summary = (overrides: Record<string, unknown> = {}) => ({
  filters: {},
  coverage: { complete: false, resources: { orders: "running", customers: "success" }, note: "Importação parcial." },
  orders: { count: 5, byKind: { order: 3, quote: 1, cancelled: 1 } },
  values: {
    net: "780.00",
    gross: "780.00",
    note: "Soma de pedidos, orçamentos e cancelados do filtro; não é valor recebido.",
    sold: { count: 3, net: "600.00", excludes: ["cancelled", "quote"], unknownTotals: 1 },
    byKind: { order: { count: 3, net: "600.00" }, quote: { count: 1, net: "80.00" }, cancelled: { count: 1, net: "100.00" } },
  },
  dates: {
    orderDate: { min: "2020-01-02", max: "2020-09-23" },
    sourceUpdatedAtMax: "2020-09-23T08:37:00+00:00",
    capturedAtMax: "2026-10-12T08:00:00+00:00",
    checkpoint: { status: "running", cursor: "2020-05-29T19:53:00", dataThrough: "2020-05-29T22:53:00+00:00", lastAttemptAt: null },
  },
  variation: { available: false, reason: "Importação parcial: o período anterior pode estar incompleto" },
  payment: { byStatus: { unknown: 5 }, pix: { available: false, reason: "Sem provedor de Pix" } },
  pendencies: { itemsIncomplete: 2, customerMissing: 1, any: 3 },
  ...overrides,
});

test("pedido incompleto mostra traço com 'dados incompletos', e o zero real continua R$ 0,00", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/operational-summary")) return { body: summary() };
    if (call.url.startsWith("/sales-orders")) {
      return {
        body: page([
          listOrder("1", { netTotal: null, grossTotal: null, totalsUnknown: true, itemsComplete: false, itemCount: null }),
          listOrder("2", { netTotal: "0.00", grossTotal: "0.00", totalsUnknown: false }),
        ]),
      };
    }
  });
  renderErp(<OrdersPage />);
  const rows = await screen.findAllByRole("row");
  const incomplete = within(rows[1]);
  expect(incomplete.getByText(/dados incompletos/)).toBeInTheDocument();
  expect(incomplete.queryByText(/R\$\s?0,00/)).not.toBeInTheDocument();
  expect(within(rows[2]).getByText(/R\$\s?0,00/)).toBeInTheDocument(); // zero de pedido completo é real
});

test("datas separadas: pedido, alterado no Mercos e sincronizado", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/operational-summary")) return { body: summary() };
    if (call.url.startsWith("/sales-orders")) return { body: page([listOrder("1")]) };
  });
  renderErp(<OrdersPage />);
  const row = within((await screen.findAllByRole("row"))[1]);
  expect(row.getByText(/^Pedido: 06\/10\/2026/)).toBeInTheDocument();
  expect(row.getByText(/Alterado no Mercos:/)).toBeInTheDocument();
  expect(row.getByText(/Sincronizado:/)).toBeInTheDocument();
});

test("indicadores explicam o que excluem e marcam o total como parcial enquanto a carga não termina", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/operational-summary")) return { body: summary() };
    if (call.url.startsWith("/sales-orders")) return { body: page([listOrder("1")]) };
  });
  renderErp(<OrdersPage />);
  expect(await screen.findByText("Pedidos no filtro (parcial)")).toBeInTheDocument();
  expect(screen.getByText(/Inclui 3 pedidos · 1 orçamento · 1 cancelado/)).toBeInTheDocument();
  expect(screen.getByText(/Data do pedido: 02\/01\/2020 a 23\/09\/2020/)).toBeInTheDocument();
  expect(screen.getByText(/carga de pedidos em andamento, cursor de alteração em/)).toBeInTheDocument();
});

test("pedido cancelado: ações incompatíveis aparecem desabilitadas, com o motivo", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/operational-summary")) return { body: summary() };
    if (call.url.startsWith("/sales-orders")) {
      return {
        body: page([
          listOrder(
            "4",
            { kind: "cancelled" },
            { actions: { shipping: CANCELLED("recebe cotação de frete"), invoice: CANCELLED("recebe rascunho fiscal"), receivable: CANCELLED("gera título") } },
          ),
        ]),
      };
    }
  });
  renderErp(<OrdersPage />);
  const row = within((await screen.findAllByRole("row"))[1]);
  await (await import("@testing-library/user-event")).default.click(row.getByRole("button", { name: /Ações do pedido/ }));
  const shipping = screen.getByRole("menuitem", { name: /Cotação de frete/ });
  expect(shipping).toHaveAttribute("aria-disabled", "true");
  expect(shipping).toHaveTextContent("indisponível: Pedido cancelado");
  expect(shipping).toHaveAttribute("title", "Pedido cancelado não recebe cotação de frete");
  expect(screen.getByRole("menuitem", { name: /Montagem da nota fiscal/ })).toHaveAttribute("aria-disabled", "true");
  expect(screen.getByRole("menuitem", { name: /Abrir pedido/ })).not.toHaveAttribute("aria-disabled");
});

const detail = (references: Record<string, unknown>) => ({
  ...listOrder("6", { sellerId: "s1", carrierId: "0", paymentConditionId: "247134" }),
  orderTypeId: null,
  paymentConditionId: "247134",
  priceTableId: null,
  carrierId: "0",
  commercialPolicyId: null,
  expectedDeliveryDate: null,
  freightTotal: null,
  notes: null,
  incomplete: false,
  incompleteReason: null,
  items: [],
  references,
});

test("referências: nome quando existe; 'Cadastro não disponível' com ID técnico secundário; zero não vira ausência", async () => {
  mockFetch((call) => {
    if (call.url === "/sales-orders/6/history") return { body: { items: [] } };
    if (call.url === "/sales-orders/6") {
      return {
        body: detail({
          customer: { id: "10", name: "Mercado Central", state: "resolved", reasonCode: null, reason: null },
          seller: { id: "s1", name: "Vendedora Ana", state: "resolved", reasonCode: null, reason: null },
          orderType: { id: null, name: null, state: "absent", reasonCode: null, reason: null },
          paymentCondition: { id: "247134", name: null, state: "unavailable", reasonCode: "not_in_synced_data", reason: "Não consta no cadastro já sincronizado" },
          priceTable: { id: null, name: null, state: "absent", reasonCode: null, reason: null },
          carrier: { id: "0", name: null, state: "unavailable", reasonCode: "zero_id_unconfirmed", reason: "O Mercos enviou o ID 0; não há confirmação de que isso signifique ausência" },
          commercialPolicy: { id: null, name: null, state: "absent", reasonCode: null, reason: null },
        }),
      };
    }
  });
  renderErp(
    <Routes>
      <Route path="/erp/pedidos/:id" element={<OrderDetailPage />} />
    </Routes>,
    { route: "/erp/pedidos/6", context: erpContext(["*"]) },
  );
  expect(await screen.findByText("Vendedora Ana")).toBeInTheDocument();
  const payment = screen.getByText("Condição de pagamento").closest("div") as HTMLElement;
  expect(within(payment).getByText("Cadastro não disponível")).toBeInTheDocument();
  expect(within(payment).getByText(/ID técnico 247134/)).toBeInTheDocument();
  const carrier = screen.getByText("Transportadora").closest("div") as HTMLElement;
  expect(within(carrier).getByText("Cadastro não disponível")).toBeInTheDocument(); // 0 NÃO vira "—"
  expect(within(carrier).getByText(/ID técnico 0/)).toBeInTheDocument();
  expect(within(screen.getByText("Tipo de pedido").closest("div") as HTMLElement).getByText("—")).toBeInTheDocument();
  expect(screen.getByText("Data do pedido")).toBeInTheDocument();
  expect(screen.getByText("Alterado no Mercos (cursor)")).toBeInTheDocument();
  expect(screen.getByText("Última sincronização no ERP")).toBeInTheDocument();
});

const resource = (name: string, phase: string, status: string, extra: Record<string, unknown> = {}) => ({
  resource: name,
  label: name,
  status,
  phase,
  records: null,
  recordsPartial: false,
  dataThrough: null,
  lastSuccessAt: null,
  lastAttemptAt: "2026-10-13T11:00:00+00:00",
  unresolved: 0,
  error: null,
  ...extra,
});

test("visão geral separa concluída, em andamento, acesso negado, erro e não iniciada — sem 12/12", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/operational-summary")) return { body: summary() };
    return {
      body: {
        connectionId: "test",
        generatedAt: "2026-10-13T12:00:00+00:00",
        source: "Mercos (espelho ERP)",
        dataThrough: null,
        enabled: true,
        resources: [
          resource("clientes", "done", "success", { records: 33166, lastSuccessAt: "2026-10-13T11:04:00+00:00" }),
          resource("pedidos", "running", "running", { records: 5080, recordsPartial: true }),
          resource("transportadoras", "denied", "forbidden", { error: "Acesso negado (403) em carriers: Sem permissão Mercos" }),
          resource("categorias", "error", "failed", { error: "falhou" }),
          resource("segmentos", "not_started", "never", { lastAttemptAt: null }),
        ],
        phases: { done: 1, running: 1, denied: 1, error: 1, not_started: 1 },
        operations: {},
        openConflicts: 0,
        pendingReferences: [
          { resource: "orders", field: "carrierId", target: "carriers", pending: 5080, distinctIds: 3, reasonCode: "access_denied", reason: "A leitura deste cadastro foi negada pelo Mercos (HTTP 403) nesta conta" },
        ],
      },
    };
  });
  renderErp(<OverviewPage />);
  expect(await screen.findByText("1 de 5 concluídas")).toBeInTheDocument();
  expect(screen.queryByText(/12 \/ 12|todos já sincronizaram/)).not.toBeInTheDocument();
  const group = screen.getByRole("region", { name: "Carga por recurso" });
  expect(within(group).getByText("1 em andamento")).toBeInTheDocument();
  expect(within(group).getByText("1 acesso negado (403)")).toBeInTheDocument();
  expect(within(group).getByText("1 com erro")).toBeInTheDocument();
  expect(within(group).getByText("1 não iniciadas")).toBeInTheDocument();
  expect(screen.getByText("Carga concluída")).toBeInTheDocument();
  expect(screen.getByText("Acesso negado (403)", { selector: ".erp-badge" })).toBeInTheDocument();
  expect(screen.getByText("(parcial)")).toBeInTheDocument(); // 5080 locais, carga não concluída
  expect(screen.getByText(/negada pelo Mercos \(HTTP 403\)/)).toBeInTheDocument();
  expect(screen.getByText(/3 ID\(s\) distinto\(s\)/)).toBeInTheDocument();
  // valor vendido: rótulo explícito e exclusões
  expect(await screen.findByText(/Valor vendido — só pedidos \(exclui cancelados e orçamentos\) · parcial/)).toBeInTheDocument();
  expect(await screen.findByText(/1 pedido\(s\) incompleto\(s\) sem valor conhecido não entram na soma/)).toBeInTheDocument();
});

test("aba de diagnóstico lista reinícios, releitura, fila e lacunas sem pedir escrita", async () => {
  const diagnostics = {
    generatedAt: "2026-10-13T12:00:00+00:00",
    checkpoint: { status: "running", cursor: "2020-05-29T19:53:00", dataThrough: "2020-05-29T22:53:00+00:00", lastAttemptAt: null, lastSuccessAt: null, recordsPersistedTotal: 5080 },
    mirror: { orders: 5080, orderDate: { min: "2020-01-02", max: "2020-09-23" }, sourceUpdatedAtMax: "2020-09-23T08:37:00+00:00", capturedAtMax: "2026-10-13T11:00:00+00:00" },
    runs: {
      recent: [{ runId: 9, mode: "full", status: "running", startedAt: "2026-10-13T11:15:00+00:00", finishedAt: null, pages: 19, received: 380, persisted: 0, unchanged: 380, cursorBefore: null, cursorAfter: null, error: null }],
      restartsRecorded: 2,
      restartTimes: ["2026-10-13T09:47:00+00:00"],
      received: 1760,
      persisted: 0,
      unchanged: 1760,
      rereadRatio: 1,
      intentionalOverlapSeconds: 5,
    },
    findings: [{ code: "full_run_restarted_from_start", message: "Carga completa recomeçou da primeira página" }],
    jobs: { processing: [{ jobId: 1, kind: "sync", resource: "all", mode: "full" }], queued: [{ jobId: 2, kind: "sync", resource: "customers", mode: "incremental" }], oldestQueuedAgeMinutes: 42, blockedBehindProcessing: true },
    hydration: { pendingOrders: 442, note: "A hidratação de itens só é enfileirada quando um job de pedidos termina ou é interrompido" },
    ordersWithoutItems: { total: 442, byKind: { order: 300, cancelled: 142 }, orderDate: { min: "2020-01-02", max: "2020-09-23" } },
    ordersWithoutCustomer: {
      customerIdMissingInMirror: { orders: 76, distinctCustomerIds: 12, sampleCustomerIds: ["900", "901"], orderDate: { min: "2020-01-05", max: "2020-03-01" }, reasonCode: "not_in_synced_data", reason: "Não consta no cadastro já sincronizado (pode ser um cadastro antigo ou removido na origem)" },
      withoutCustomerIdInSource: 0,
    },
    unresolvedReferences: [],
  };
  mockFetch((call) => {
    if (call.url === "/integration/diagnostics/orders") return { body: diagnostics };
  });
  renderErp(<IntegrationPage />, { route: "/erp/integracoes?aba=diagnostico" });
  expect(await screen.findByText("Carga de pedidos")).toBeInTheDocument();
  expect(screen.getByText(/full_run_restarted_from_start/)).toBeInTheDocument();
  expect(screen.getByText(/1760 de 1760 \(100%\)/)).toBeInTheDocument();
  expect(screen.getByText(/esperando um job em processamento/)).toBeInTheDocument();
  expect(screen.getByText(/76 pedidos · 12 cliente\(s\) distinto\(s\)/)).toBeInTheDocument();
  expect(screen.getByText(/cadastro antigo ou removido na origem/)).toBeInTheDocument();
});

test("recursos mostram implementado, habilitado, conta e a última atualização incremental", async () => {
  const base = { upstream: "x (v1)", unmappedFields: 0, cursor: null, transportCursor: null, dataThrough: null, lastSuccessAt: null, lastAttemptAt: null, unresolved: 0, retryAfter: null, error: null };
  mockFetch((call) => {
    if (call.url === "/integration/status") {
      return {
        body: {
          connectionId: "test",
          adaptorConfigured: true,
          writeKeyConfigured: false,
          webhookConfigured: false,
          jobs: {},
          pendingReferences: [],
          resources: [
            { ...base, resource: "customers", label: "Clientes", status: "success", phase: "done", localRecords: 33166, capability: { implementedInErp: true, enabled: true, accountAccess: "allowed" }, lastIncremental: { finishedAt: "2026-10-13T12:00:00+00:00", received: 5, persisted: 2, unchanged: 3, cursorAfter: "2026-10-13T11:59:00" } },
            { ...base, resource: "carriers", label: "Transportadoras", status: "forbidden", phase: "denied", localRecords: null, capability: { implementedInErp: true, enabled: false, accountAccess: "denied" }, lastIncremental: null },
          ],
        },
      };
    }
  });
  renderErp(<IntegrationPage />, { route: "/erp/integracoes?aba=recursos" });
  expect(await screen.findByText("2 gravados de 5")).toBeInTheDocument();
  expect(screen.getByText("conta: negado (403)")).toBeInTheDocument();
  expect(screen.getByText("conta: permitido")).toBeInTheDocument();
  expect(screen.getByText("nenhuma ainda")).toBeInTheDocument();
  expect(screen.getByText("desabilitado")).toBeInTheDocument();
});

test("conciliação com o BI: só roda ao clicar e lista divergências explicadas e inexplicadas", async () => {
  const recon = {
    resource: "orders",
    readOnly: true,
    asOf: "2026-10-10T00:00:00+00:00",
    asOfBasis: "menor cursor confirmado entre ERP e BI",
    scope: { dateFrom: null, dateTo: null, filters: "mesmo período e mesmo instante de atualização nos dois lados" },
    erp: { count: 5080, checkpoint: { status: "running", cursor: "2020-05-29T19:53:00", dataThrough: null, lastSuccessAt: null } },
    bi: { count: 5200, syncState: { status: "success", cursor: "2026-10-20T00:00:00", lastSuccessAt: null } },
    matched: 5000,
    totals: { divergences: 3, explained: 1, unexplained: 2 },
    divergences: [
      { code: "net_total_mismatch", title: "Total líquido diferente", cause: "x", impact: "Valor vendido diverge entre BI e ERP", fix: "Conferir a versão mais recente", count: 3, explained: 1, unexplained: 2, samples: [{ id: "o2" }, { id: "o3" }] },
    ],
    notes: ["Nenhum dos lados foi alterado; o BI não sobrescreve o espelho do ERP."],
  };
  const calls: string[] = [];
  mockFetch((call) => {
    calls.push(call.url);
    if (call.url === "/integration/diagnostics/orders") return { body: ORDERS_DIAGNOSTICS_EMPTY };
    if (call.url.startsWith("/integration/reconciliation/orders")) return { body: recon };
  });
  renderErp(<IntegrationPage />, { route: "/erp/integracoes?aba=diagnostico" });
  const button = await screen.findByRole("button", { name: "Conciliar" });
  expect(calls.some((url) => url.includes("reconciliation"))).toBe(false); // não varre sem pedido
  await (await import("@testing-library/user-event")).default.click(button);
  expect(await screen.findByText("Total líquido diferente")).toBeInTheDocument();
  expect(screen.getByText(/3 \(1 explicadas · 2 inexplicadas\)/)).toBeInTheDocument();
  expect(screen.getByText("o2, o3")).toBeInTheDocument();
  expect(screen.getByText(/o BI não sobrescreve o espelho do ERP/)).toBeInTheDocument();
});

const ORDERS_DIAGNOSTICS_EMPTY = {
  generatedAt: null,
  checkpoint: { status: "running", cursor: null, dataThrough: null, lastAttemptAt: null, lastSuccessAt: null },
  mirror: { orders: 0, orderDate: { min: null, max: null }, sourceUpdatedAtMax: null, capturedAtMax: null },
  runs: { recent: [], restartsRecorded: 0, restartTimes: [], received: 0, persisted: 0, unchanged: 0, rereadRatio: null, intentionalOverlapSeconds: 5 },
  findings: [],
  jobs: { processing: [], queued: [], oldestQueuedAgeMinutes: null, blockedBehindProcessing: false },
  hydration: { pendingOrders: 0, note: null },
  ordersWithoutItems: { total: 0, byKind: {}, orderDate: { min: null, max: null } },
  ordersWithoutCustomer: { customerIdMissingInMirror: { orders: 0, distinctCustomerIds: 0, sampleCustomerIds: [], orderDate: { min: null, max: null }, reasonCode: null, reason: null }, withoutCustomerIdInSource: 0 },
  unresolvedReferences: [],
};
