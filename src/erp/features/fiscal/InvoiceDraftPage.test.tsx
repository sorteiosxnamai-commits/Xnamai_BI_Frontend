import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Call, erpContext, mockFetch, page, renderErp } from "../../test/utils";
import { InvoiceDraftPage } from "./InvoiceDraftPage";
import { InvoiceListPage } from "./InvoiceListPage";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ISSUER = { available: false, reason: "Nenhum emissor fiscal está configurado." };

const orderDetail = {
  id: "10", number: "10", kind: "order", customerId: "c1", customerName: "Casa Flor Ltda",
  issuedAt: null, issueDate: "2026-10-06", netTotal: "12480.00", grossTotal: null, discountTotal: null,
  itemCount: 6, itemsComplete: true,
  statuses: { commercial: "2", billing: null, fulfillment: "not_started", payment: null },
  version: 1, sourceUpdatedAt: null, sourceDeleted: false, capturedAt: null, incomplete: false, items: [],
  operational: {
    customerName: "Casa Flor Ltda", responsible: { sellerId: null, name: null },
    state: { code: "in_progress", label: "Em andamento" }, itemsPreview: [],
    totals: { gross: null, discount: null, freight: null, net: "12480.00" }, pendencies: [],
    lastExternalUpdateAt: null, lastHumanAction: null, shipping: { state: "none" },
    invoice: { state: "draft" }, payment: { state: "unknown" }, pix: { state: "unknown" },
  },
};

const item = (key: string, name: string, qty: string, total: string, extra: Record<string, unknown> = {}) => ({
  sourceKey: key, position: 0, productId: null, code: `SKU-${key}`, name,
  sourceQuantity: qty, unitValue: "120.00", sourceLineTotal: total, quantity: "0", lineValue: "0.00",
  allocatedElsewhere: "0", available: qty, included: false, status: "excluded", ...extra,
});

const draft = (extra: Record<string, unknown> = {}) => ({
  id: 5, orderId: "10", status: "draft", version: 1, stale: false, percent: "30",
  orderTotal: "12480.00",
  target: { percent: "30", value: "3744.00" },
  effective: { value: "3735.00", percentOfOrder: "29.93", achievedOfTarget: "99.76" },
  difference: { value: "-9.00", direction: "below" },
  counts: { included: 1, total: 2 },
  items: [
    item("i:a", "Vaso Aurora", "10", "1200.00", { quantity: "10", lineValue: "1200.00", included: true, status: "included" }),
    item("i:b", "Kit Jardim", "5", "1250.00"),
  ],
  review: { required: false, changes: [], note: null },
  notes: null, issuance: ISSUER,
  statement: "Rascunho de planejamento: não emite nota fiscal e não gera chave, protocolo, XML nem DANFE.",
  organizeNote: "Organização automática: ordem dos itens até o alvo, sem garantia de combinação ótima.",
  createdBy: "ana@x.com", createdAt: "2026-10-08T10:00:00+00:00",
  ...extra,
});

function setup(
  drafts: unknown[],
  options: { permissions?: string[]; replies?: Record<string, { status?: number; body: unknown }> } = {},
) {
  const calls: Call[] = [];
  mockFetch((call) => {
    calls.push(call);
    for (const [prefix, reply] of Object.entries(options.replies ?? {})) {
      if (call.method !== "GET" && call.url.startsWith(prefix)) return reply;
    }
    if (call.url === "/sales-orders/10") return { body: orderDetail };
    if (call.url === "/sales-orders/10/history") return { body: { items: [] } };
    if (call.url === "/sales-orders/10/invoice-drafts") return { body: { orderId: "10", issuance: ISSUER, items: drafts } };
  });
  renderErp(
    <Routes>
      <Route path="/erp/notas-fiscais/pedidos/:id/montagem" element={<InvoiceDraftPage />} />
    </Routes>,
    { route: "/erp/notas-fiscais/pedidos/10/montagem", context: erpContext(options.permissions ?? ["*"]) },
  );
  return { calls };
}

test("mostra alvo, valor alocado e diferença assinada; emissão fica indisponível com motivo", async () => {
  setup([draft()]);
  expect(await screen.findByRole("heading", { name: "Montagem da Nota Fiscal" })).toBeInTheDocument();
  expect(screen.getByText("1 de 2")).toBeInTheDocument();
  expect(screen.getByText(/Valor alvo da nota \(30%\)/)).toBeInTheDocument();
  const diffLabel = screen.getByText("Diferença para a meta");
  expect(within(diffLabel.parentElement as HTMLElement).getByText(/-R\$\s*9,00|R\$\s*-9,00|−R\$\s*9,00/)).toBeInTheDocument();
  expect(screen.getByText("Não emitida")).toBeInTheDocument();
  const issue = screen.getByRole("button", { name: "Emitir nota fiscal" });
  expect(issue).toBeDisabled();
  expect(screen.getAllByText(/Nenhum emissor fiscal está configurado/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/chave de acesso|protocolo de autorização|DANFE emitido/i)).not.toBeInTheDocument();
});

test("sem rascunho: valida o percentual e cria com Idempotency-Key", async () => {
  const { calls } = setup([], {
    replies: { "/sales-orders/10/invoice-drafts": { status: 201, body: draft() } },
  });
  const form = within(await screen.findByRole("form", { name: "Novo rascunho de nota fiscal" }));
  await userEvent.type(form.getByLabelText("Percentual da nota (%)"), "150");
  await userEvent.click(form.getByRole("button", { name: "Criar rascunho" }));
  expect(await form.findByText("Informe um percentual maior que 0 e até 100.")).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false);
  await userEvent.clear(form.getByLabelText("Percentual da nota (%)"));
  await userEvent.type(form.getByLabelText("Percentual da nota (%)"), "30");
  await userEvent.click(form.getByRole("button", { name: "Criar rascunho" }));
  await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
  const post = calls.find((c) => c.method === "POST");
  expect(post?.body).toEqual({ percent: "30", organize: true });
  expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
});

test("organizar automaticamente envia a versão esperada", async () => {
  const { calls } = setup([draft()], { replies: { "/invoice-drafts/5/organize": { body: draft({ version: 2 }) } } });
  await userEvent.click(await screen.findByRole("button", { name: "Organizar itens automaticamente" }));
  await waitFor(() => expect(calls.some((c) => c.url === "/invoice-drafts/5/organize")).toBe(true));
  expect(calls.find((c) => c.url === "/invoice-drafts/5/organize")?.body).toEqual({ expectedVersion: 1 });
});

test("ajuste manual só envia o que mudou e recusa quantidade acima do disponível", async () => {
  const { calls } = setup([draft()], { replies: { "/invoice-drafts/5": { body: draft({ version: 2 }) } } });
  await userEvent.click(await screen.findByRole("button", { name: "Ajustar manualmente" }));
  const field = screen.getByLabelText("Quantidade na nota de Kit Jardim");
  await userEvent.clear(field);
  await userEvent.type(field, "9");
  await userEvent.click(screen.getByRole("button", { name: "Salvar montagem da nota" }));
  expect(await screen.findByText(/máximo disponível 5/)).toBeInTheDocument();
  expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  await userEvent.clear(field);
  await userEvent.type(field, "3");
  await userEvent.click(screen.getByRole("button", { name: "Salvar montagem da nota" }));
  await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
  const patch = calls.find((c) => c.method === "PATCH");
  expect(patch?.url).toBe("/invoice-drafts/5");
  expect(patch?.body).toMatchObject({ expectedVersion: 1, items: [{ sourceKey: "i:b", quantity: "3" }], acknowledgeReview: false });
});

test("pedido mudou na origem: mostra o que mudou, bloqueia edição e exige confirmar a revisão", async () => {
  const stale = draft({
    stale: true,
    review: {
      required: true, note: "O pedido mudou na origem depois deste rascunho; revise e confirme antes de editar.",
      changes: [{ sourceKey: "i:b", kind: "removed", name: "Fertilizante Orgânico 1L", before: { quantity: "12", lineTotal: "696.00" }, after: null, valueDifference: "-696.00", reason: "Item removido do pedido na origem" }],
    },
    items: [item("i:b", "Fertilizante Orgânico 1L", "12", "696.00", { status: "removed_at_source" })],
  });
  const { calls } = setup([stale], { replies: { "/invoice-drafts/5": { body: draft({ version: 2 }) } } });
  expect(await screen.findByRole("alert", { name: "Revisão necessária" })).toBeInTheDocument();
  expect(screen.getAllByText("Fertilizante Orgânico 1L").length).toBeGreaterThan(0);
  expect(screen.getByText("Removido do pedido")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Salvar montagem da nota" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Organizar itens automaticamente" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "Aplicar revisão e alinhar ao pedido" }));
  await waitFor(() => expect(calls.some((c) => c.method === "PATCH")).toBe(true));
  expect(calls.find((c) => c.method === "PATCH")?.body).toMatchObject({ acknowledgeReview: true, expectedVersion: 1 });
});

test("conflito de versão aparece como erro e não perde o que foi digitado", async () => {
  setup([draft()], {
    replies: {
      "/invoice-drafts/5": {
        status: 409,
        body: { detail: { code: "version_conflict", message: "O rascunho foi alterado por outra pessoa; recarregue e confira antes de salvar" } },
      },
    },
  });
  await userEvent.click(await screen.findByRole("button", { name: "Ajustar manualmente" }));
  const field = screen.getByLabelText("Quantidade na nota de Kit Jardim");
  await userEvent.clear(field);
  await userEvent.type(field, "2");
  await userEvent.click(screen.getByRole("button", { name: "Salvar montagem da nota" }));
  expect(await screen.findByText(/alterado por outra pessoa/)).toBeInTheDocument();
  expect(screen.getByLabelText("Quantidade na nota de Kit Jardim")).toHaveValue("2");
});

test("cancelar exige motivo", async () => {
  const { calls } = setup([draft()]);
  await userEvent.click(await screen.findByRole("button", { name: "Cancelar rascunho e liberar itens" }));
  expect(await screen.findByText(/Informe o motivo do cancelamento/)).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false);
});

test("perfil de consulta vê a montagem sem botões de edição nem de criação", async () => {
  setup([draft()], { permissions: ["read", "invoices:read"] });
  expect(await screen.findByText("Itens do pedido")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Salvar montagem da nota" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Organizar itens automaticamente" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancelar rascunho e liberar itens" })).not.toBeInTheDocument();
});

test("lista de notas mostra contagens por situação e o aviso de emissão indisponível", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/operational-summary")) {
      return {
        body: {
          filters: {}, coverage: { complete: true, resources: {}, note: null },
          orders: { count: 3, byKind: {} }, values: { net: "0", gross: "0", note: null },
          variation: { available: false, reason: "x" }, payment: { byStatus: {}, pix: { available: false } },
          pendencies: { itemsIncomplete: 0, customerMissing: 0, any: 0 },
          invoice: { available: true, counts: { none: 5, draft: 2, stale: 1 }, reason: ISSUER.reason },
        },
      };
    }
    if (call.url.startsWith("/sales-orders")) {
      return { body: page([{ ...orderDetail, operational: { ...orderDetail.operational, invoice: { state: "stale", reason: "Pedido alterado na origem" } } }]) };
    }
  });
  renderErp(<InvoiceListPage />, { route: "/erp/notas-fiscais", context: erpContext(["*"]) });
  expect(await screen.findByText("Revisar rascunho")).toBeInTheDocument();
  expect(await screen.findByText("5")).toBeInTheDocument();
  expect(screen.getByText("Emissão fiscal indisponível")).toBeInTheDocument();
  expect(screen.queryByText(/Emitida/)).not.toBeInTheDocument();
});
