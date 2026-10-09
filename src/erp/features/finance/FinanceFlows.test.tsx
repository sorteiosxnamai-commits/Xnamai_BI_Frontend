import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Call, erpContext, mockFetch, page, renderErp } from "../../test/utils";
import { RefundsPage } from "../refunds/RefundsPage";
import { FinancePage } from "./FinancePage";
import { OrderFinancePage } from "./OrderFinancePage";

beforeEach(() => {
  vi.stubEnv("VITE_BI_API_URL", "https://api.test");
  window.URL.createObjectURL = vi.fn(() => "blob:test");
  window.URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const summary = (extra: Record<string, unknown> = {}) => ({
  period: { from: null, to: null },
  sales: { orders: 12, net: "5000.00", variation: { available: false, reason: "Sem período definido para comparar" } },
  cash: { received: "1200.00", reversed: "200.00", net: "1000.00", variation: { available: true, percent: "25.00", previous: "800.00" } },
  receivable: { open: "3000.00", overdue: "400.00" },
  refunds: { byStatus: { requested: { count: 2, amount: "100.00" }, approved: { count: 1, amount: "50.00" } }, returned: "70.00" },
  pix: { available: false, reason: "Sem provedor de Pix configurado" },
  formulas: { sales: "Vendas = soma do valor líquido dos pedidos. Não é valor recebido.", cash: "Recebido = baixas menos estornos." },
  ...extra,
});

const order = (extra: Record<string, unknown> = {}, finance: Record<string, unknown> = { state: "open", price: "300.00" }) => ({
  id: "10", number: "10", kind: "order", customerId: "c1", customerName: "Casa Flor", issuedAt: "2026-10-06T12:00:00+00:00",
  issueDate: "2026-10-06", netTotal: "300.00", grossTotal: null, discountTotal: null, itemCount: 2, itemsComplete: true,
  statuses: { commercial: "2", billing: null, fulfillment: "not_started", payment: null }, version: 1,
  sourceUpdatedAt: null, sourceDeleted: false, capturedAt: null,
  operational: {
    customerName: "Casa Flor", responsible: { sellerId: "s1", name: "Ana" }, state: { code: "in_progress", label: "Em andamento" },
    itemsPreview: [], totals: { gross: null, discount: null, freight: null, net: "300.00" }, pendencies: [],
    lastExternalUpdateAt: "2026-10-06T12:00:00+00:00", lastHumanAction: null, shipping: { state: "none" },
    invoice: { state: "none" }, payment: { state: "paid", source: "mercos_mirror" }, pix: { state: "unknown" }, finance,
  },
  ...extra,
});

const refundRow = (extra: Record<string, unknown> = {}) => ({
  id: 4, orderId: "10", settlementId: 9, amount: "50.00", reason: "Cliente desistiu", status: "requested", version: 1,
  requestedBy: "ana@x.com", requestedAt: "2026-10-08T10:00:00+00:00", decidedBy: null, decidedAt: null, decisionNote: null,
  externalReference: null, externalConfirmedBy: null, externalConfirmedAt: null, reversalSettlementId: null,
  statement: "Solicitação registrada. Não altera nenhuma baixa e não devolve dinheiro.", ...extra,
});

function financeSetup(options: { permissions?: string[]; route?: string; blob?: { status?: number; body?: unknown } } = {}) {
  const calls: Call[] = [];
  mockFetch((call) => {
    calls.push(call);
    if (call.url.startsWith("/finance/orders-summary")) return { body: summary() };
    if (call.url.startsWith("/finance/orders-report.csv")) return options.blob ?? { body: "pedido;cliente\n10;Casa Flor" };
    if (call.url.startsWith("/refund-requests")) return { body: page([refundRow()]) };
    if (call.url.startsWith("/sales-orders")) return { body: page([order({}, { state: "open", price: "300.00", deadline: "overdue" })]) };
    if (call.url.startsWith("/finance/")) return { body: page([]) };
  });
  renderErp(<FinancePage />, { route: options.route ?? "/erp/financeiro", context: erpContext(options.permissions ?? ["*"]) });
  return { calls };
}

test("indicadores separam vendas, caixa e a receber, mostram fórmulas e Pix indisponível", async () => {
  financeSetup();
  expect(await screen.findByText("Vendas (valor vendido)")).toBeInTheDocument();
  expect(await screen.findByText("R$ 5.000,00")).toBeInTheDocument();
  expect(screen.getByText("Recebido (caixa)")).toBeInTheDocument();
  expect(screen.getByText("R$ 1.000,00")).toBeInTheDocument(); // líquido de estornos
  expect(screen.getByText(/\+25,00% vs\. período anterior/)).toBeInTheDocument();
  expect(screen.getByText(/Variação indisponível: Sem período definido/)).toBeInTheDocument(); // vendas sem período
  expect(screen.getByText("A receber", { selector: ".erp-kpi-title" })).toBeInTheDocument();
  expect(screen.getByText("R$ 3.000,00")).toBeInTheDocument();
  expect(screen.getByText(/R\$ 400,00 vencido/)).toBeInTheDocument();
  const pix = screen.getByText("Pix pendentes").parentElement as HTMLElement;
  expect(within(pix).getByText("Indisponível")).toBeInTheDocument();
  await userEvent.click(screen.getByText("Como cada indicador é calculado"));
  expect(screen.getByText(/Não é valor recebido/)).toBeInTheDocument();
});

test("tabela separa situação financeira local do pagamento do Mercos e não inventa Pix", async () => {
  financeSetup();
  const row = (await screen.findAllByRole("row"))[1];
  const cells = within(row);
  expect(cells.getByText("Em aberto")).toBeInTheDocument(); // local
  expect(cells.getByText("Vencida")).toBeInTheDocument();
  expect(cells.getByText("Pago")).toBeInTheDocument(); // espelho Mercos, separado
  expect(cells.getByText("Cobrar parcela vencida")).toBeInTheDocument();
  expect(cells.getByText("—", { selector: ".erp-muted" })).toBeInTheDocument();
  expect(cells.getByText("Ana")).toBeInTheDocument();
  expect(screen.queryByText(/Pix gerado|Link Pix enviado/)).not.toBeInTheDocument();
});

test("filtro de situação financeira vai ao servidor", async () => {
  const { calls } = financeSetup();
  await screen.findByText("#10");
  await userEvent.selectOptions(screen.getByLabelText("Situação financeira"), "overdue");
  await waitFor(() =>
    expect(calls.some((c) => c.url.startsWith("/sales-orders") && c.url.includes("financeStatus=overdue"))).toBe(true),
  );
});

test("exportar relatório usa os mesmos filtros e avisa quando o servidor trunca", async () => {
  const { calls } = financeSetup({ route: "/erp/financeiro?from=2026-10-01&to=2026-10-31" });
  await screen.findByText("#10");
  await userEvent.click(screen.getByRole("button", { name: /Exportar relatório/ }));
  await waitFor(() => expect(calls.some((c) => c.url.startsWith("/finance/orders-report.csv"))).toBe(true));
  const call = calls.find((c) => c.url.startsWith("/finance/orders-report.csv"));
  expect(call?.url).toContain("dateFrom=2026-10-01");
  expect(call?.url).toContain("dateTo=2026-10-31");
  expect(window.URL.createObjectURL).toHaveBeenCalled();
});

test("falha ao exportar aparece como erro, não como arquivo vazio", async () => {
  financeSetup({ blob: { status: 403, body: { detail: { code: "forbidden", message: "Sem permissão de financeiro" } } } });
  await screen.findByText("#10");
  await userEvent.click(screen.getByRole("button", { name: /Exportar relatório/ }));
  expect(await screen.findByText("Sem permissão de financeiro")).toBeInTheDocument();
  expect(window.URL.createObjectURL).not.toHaveBeenCalled();
});

test("sem permissões de baixa e de reembolso, os botões e a seção não aparecem", async () => {
  financeSetup({ permissions: ["read", "finance:read"] });
  await screen.findByText("#10");
  expect(screen.queryByRole("button", { name: "Registrar pagamento" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Solicitar reembolso" })).not.toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Solicitações financeiras" })).not.toBeInTheDocument();
});

const orderFinance = (extra: Record<string, unknown> = {}) => ({
  orderId: "10", orderTotal: "300.00", state: "paid", overdue: false, obligation: "300.00", paid: "300.00", open: "0.00",
  titles: [{ id: 3, status: "open", total: "300.00", origin: "local", installments: [{ id: 7, number: 1, dueDate: "2026-12-01", amount: "300.00", settledAmount: "300.00", status: "settled", overdue: false }] }],
  payments: [{ settlementId: 9, titleId: 3, installmentId: 7, amount: "300.00", settledAt: "2026-10-08T12:00:00+00:00", operator: "ana@x.com", reference: null, reversed: false, refundable: "250.00", refundCommitted: "50.00" }],
  externalTitles: [], externalNote: null, pix: { available: false, reason: "Sem provedor de Pix configurado" }, ...extra,
});

function orderSetup(finance: unknown, options: { permissions?: string[]; replies?: Record<string, { status?: number; body: unknown }> } = {}) {
  const calls: Call[] = [];
  mockFetch((call) => {
    calls.push(call);
    for (const [prefix, reply] of Object.entries(options.replies ?? {})) {
      if (call.method === "POST" && call.url.startsWith(prefix)) return reply;
    }
    if (call.url === "/sales-orders/10/finance") return { body: finance };
    if (call.url === "/sales-orders/10/history") return { body: { items: [] } };
    if (call.url.startsWith("/finance/accounts")) return { body: { items: [] } };
  });
  renderErp(
    <Routes>
      <Route path="/erp/financeiro/pedidos/:id" element={<OrderFinancePage />} />
    </Routes>,
    { route: "/erp/financeiro/pedidos/10", context: erpContext(options.permissions ?? ["*"]) },
  );
  return { calls };
}

test("pedido sem título: valida o formulário e cria com Idempotency-Key", async () => {
  const { calls } = orderSetup(orderFinance({ state: "none", obligation: "0.00", paid: "0.00", titles: [], payments: [] }), {
    replies: { "/sales-orders/10/receivable": { status: 201, body: orderFinance() } },
  });
  const form = within(await screen.findByRole("form", { name: "Criar título a receber do pedido" }));
  await userEvent.click(form.getByRole("button", { name: "Criar título" }));
  expect(await form.findByText("Informe a data do primeiro vencimento.")).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false);
  await userEvent.type(form.getByLabelText("Primeiro vencimento"), "2026-12-01");
  await userEvent.clear(form.getByLabelText("Parcelas"));
  await userEvent.type(form.getByLabelText("Parcelas"), "3");
  await userEvent.click(form.getByRole("button", { name: "Criar título" }));
  await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
  const post = calls.find((c) => c.method === "POST");
  expect(post?.body).toMatchObject({ firstDueDate: "2026-12-01", installments: 3, acknowledgeExternalTitle: false });
  expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
});

test("título já existente no Mercos exige confirmação explícita antes de criar o local", async () => {
  const { calls } = orderSetup(orderFinance({ state: "none", titles: [], payments: [], obligation: "0.00", paid: "0.00" }), {
    replies: {
      "/sales-orders/10/receivable": {
        status: 409,
        body: { detail: { code: "external_title_exists", message: "Este pedido já tem título no Mercos. Criar também um título local duplicaria a obrigação." } },
      },
    },
  });
  const form = within(await screen.findByRole("form", { name: "Criar título a receber do pedido" }));
  await userEvent.type(form.getByLabelText("Primeiro vencimento"), "2026-12-01");
  await userEvent.click(form.getByRole("button", { name: "Criar título" }));
  expect(await form.findByText(/duplicaria a obrigação/)).toBeInTheDocument();
  await userEvent.click(form.getByRole("checkbox"));
  await userEvent.click(form.getByRole("button", { name: "Criar título" }));
  await waitFor(() => expect(calls.filter((c) => c.method === "POST").length).toBe(2));
  expect(calls.filter((c) => c.method === "POST")[1].body).toMatchObject({ acknowledgeExternalTitle: true });
});

test("reembolso: limite pelo reembolsável, motivo obrigatório e envio sem alterar a baixa", async () => {
  const { calls } = orderSetup(orderFinance(), {
    replies: { "/refund-requests": { status: 201, body: refundRow() } },
  });
  await userEvent.click(await screen.findByRole("button", { name: "Solicitar reembolso" }));
  const form = within(screen.getByRole("form", { name: "Solicitar reembolso da baixa 9" }));
  expect(form.getByLabelText("Valor a reembolsar (R$)")).toHaveValue("250.00"); // sugere o reembolsável
  await userEvent.clear(form.getByLabelText("Valor a reembolsar (R$)"));
  await userEvent.type(form.getByLabelText("Valor a reembolsar (R$)"), "999");
  await userEvent.click(form.getByRole("button", { name: "Enviar solicitação" }));
  expect(await form.findByText(/Acima do reembolsável/)).toBeInTheDocument();
  await userEvent.clear(form.getByLabelText("Valor a reembolsar (R$)"));
  await userEvent.type(form.getByLabelText("Valor a reembolsar (R$)"), "100");
  await userEvent.click(form.getByRole("button", { name: "Enviar solicitação" }));
  expect(await form.findByText(/Informe o motivo/)).toBeInTheDocument();
  await userEvent.type(form.getByLabelText("Motivo"), "Produto devolvido");
  expect(screen.getByText(/Solicitar não altera a baixa e não devolve dinheiro/)).toBeInTheDocument();
  await userEvent.click(form.getByRole("button", { name: "Enviar solicitação" }));
  await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
  expect(calls.find((c) => c.method === "POST")?.body).toEqual({
    orderId: "10", settlementId: 9, amount: "100", reason: "Produto devolvido",
  });
});

test("baixa já estornada ou sem saldo reembolsável não oferece reembolso", async () => {
  orderSetup(orderFinance({ payments: [{ settlementId: 9, titleId: 3, installmentId: 7, amount: "300.00", settledAt: null, operator: "ana@x.com", reference: null, reversed: true, refundable: "0.00", refundCommitted: "0.00" }] }));
  expect(await screen.findByText("Estornada")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Solicitar reembolso" })).not.toBeInTheDocument();
});

function refundsSetup(row: Record<string, unknown>, options: { permissions?: string[]; user?: string; replies?: Record<string, { status?: number; body: unknown }> } = {}) {
  const calls: Call[] = [];
  mockFetch((call) => {
    calls.push(call);
    for (const [prefix, reply] of Object.entries(options.replies ?? {})) {
      if (call.method === "POST" && call.url.startsWith(prefix)) return reply;
    }
    if (call.url === `/refund-requests/${row.id}`) {
      return { body: { ...row, events: [{ at: "2026-10-08T10:00:00+00:00", operator: "ana@x.com", action: "requested", reason: "Cliente desistiu" }] } };
    }
    if (call.url.startsWith("/refund-requests")) return { body: page([row]) };
  });
  renderErp(<RefundsPage />, { route: "/erp/reembolsos", context: erpContext(options.permissions ?? ["*"]) });
  return { calls };
}

test("lista de reembolsos explica cada estado sem prometer devolução", async () => {
  refundsSetup(refundRow({ status: "approved", decidedBy: "fin@x.com" }));
  await userEvent.click(await screen.findByText("#SR-0004"));
  expect((await screen.findAllByText("Aprovado · devolução pendente")).length).toBeGreaterThan(0);
  expect(await screen.findByText("O que este estado significa")).toBeInTheDocument();
  expect(screen.getByText(/Solicitação registrada/)).toBeInTheDocument();
  expect(screen.getByText("requested")).toBeInTheDocument(); // histórico
});

test("aprovar exige permissão própria e envia a versão esperada", async () => {
  const a = refundsSetup(refundRow(), { permissions: ["read", "refunds:read", "refunds:request"] });
  await userEvent.click(await screen.findByText("#SR-0004"));
  await screen.findByText("O que este estado significa");
  expect(screen.queryByRole("button", { name: "Aprovar solicitação" })).not.toBeInTheDocument();
  expect(a.calls.some((c) => c.method === "POST")).toBe(false);
});

test("aprovador aprova com versão esperada e rejeita só com motivo", async () => {
  const { calls } = refundsSetup(refundRow(), {
    replies: { "/refund-requests/4/approve": { body: refundRow({ status: "approved", version: 2 }) } },
  });
  await userEvent.click(await screen.findByText("#SR-0004"));
  await userEvent.click(await screen.findByRole("button", { name: "Rejeitar" }));
  expect(await screen.findByText(/Informe o motivo da rejeição/)).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Aprovar solicitação" }));
  await waitFor(() => expect(calls.some((c) => c.url === "/refund-requests/4/approve")).toBe(true));
  expect(calls.find((c) => c.url === "/refund-requests/4/approve")?.body).toMatchObject({ expectedVersion: 1 });
});

test("aprovado: estorno local pede confirmação e confirmação externa exige referência", async () => {
  const { calls } = refundsSetup(refundRow({ status: "approved", version: 2 }), {
    replies: {
      "/refund-requests/4/apply-local-reversal": {
        status: 409,
        body: { detail: { code: "partial_reversal_unsupported", message: "O estorno local existente é integral e este reembolso é parcial." } },
      },
    },
  });
  await userEvent.click(await screen.findByText("#SR-0004"));
  await userEvent.click(await screen.findByRole("button", { name: "Confirmar devolução externa (manual)" }));
  expect(await screen.findByText(/Informe a referência da devolução/)).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false);
  await userEvent.click(screen.getByRole("button", { name: "Aplicar estorno local…" }));
  expect(screen.getByText(/estorna a baixa inteira/)).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false); // ainda só pediu confirmação
  await userEvent.click(screen.getByRole("button", { name: "Confirmar estorno local" }));
  expect(await screen.findByText(/estorno local existente é integral/)).toBeInTheDocument(); // 409 do servidor visível
});
