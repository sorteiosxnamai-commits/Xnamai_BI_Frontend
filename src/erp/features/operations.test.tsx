import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AccountPage } from "./AccountPage";
import { AdminPage } from "./AdminPage";
import { OrderDetailPage, itemsPayload } from "./orders/OrderDetailPage";
import { PurchasingPage } from "./purchasing/PurchasingPage";
import { cap, erpContext, mockFetch, page, renderErp } from "../test/utils";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const operation = (extra: Record<string, unknown> = {}) => ({
  operationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", kind: "update_order", status: "queued",
  targetResource: "orders", targetId: "10", externalId: null, operator: "ana@x.com", attempts: 0,
  errorCode: null, error: null, nextAttemptAt: null, completedAt: null, mirrorConfirmedAt: null,
  createdAt: null, statusUrl: "/x", synchronized: false, canReconcile: false, canRetry: false, ...extra,
});

const order = {
  id: "10", number: "100", kind: "order", customerId: "1", customerName: "Cliente X", sellerId: null,
  issuedAt: null, issueDate: "2026-10-06", netTotal: "99.00", grossTotal: null, discountTotal: null,
  itemCount: 1, itemsComplete: true,
  statuses: { commercial: "2", billing: null, fulfillment: "not_started", payment: null },
  version: 2, sourceUpdatedAt: null, sourceDeleted: false, capturedAt: null, orderTypeId: null,
  paymentConditionId: null, priceTableId: null, carrierId: null, commercialPolicyId: null,
  expectedDeliveryDate: null, freightTotal: null, notes: "obs", incomplete: false, incompleteReason: null,
  items: [
    { id: "1", position: 0, productId: "7", code: "P7", name: "Produto 7", quantity: "2.0000", listUnitPrice: "10.00", unitPrice: "9.50", discount: null, total: "19.00", excluded: false },
  ],
};

function orderHandler(onPatch?: (body: unknown) => void) {
  return (call: { url: string; method: string; body: unknown }) => {
    if (call.method === "PATCH") {
      onPatch?.(call.body);
      return { status: 202, body: operation() };
    }
    if (call.url.startsWith("/integration/operations/")) return { body: operation() };
    if (call.url === "/sales-orders/10") return { body: order };
    if (call.url.startsWith("/catalogs/")) return { body: page([]) };
    if (call.url.startsWith("/products")) return { body: page([]) };
  };
}

function renderOrder() {
  return renderErp(
    <Routes>
      <Route path="/erp/pedidos/:id" element={<OrderDetailPage />} />
    </Routes>,
    { route: "/erp/pedidos/10", context: erpContext(["*"], [cap("write.orders")]) },
  );
}

test("editar itens: envia a lista inteira só quando os itens mudaram", async () => {
  const bodies: unknown[] = [];
  mockFetch(orderHandler((b) => bodies.push(b)));
  renderOrder();
  await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
  const qty = screen.getByLabelText("Quantidade");
  expect(qty).toHaveValue("2");
  await userEvent.clear(qty);
  await userEvent.type(qty, "3");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText("Envio pendente")).toBeInTheDocument();
  expect(bodies).toEqual([{ items: [{ productId: "7", quantity: "3", unitPrice: "9.50" }], expectedVersion: 2 }]);
});

test("editar só observações não reenvia os itens (campos intencionais apenas)", async () => {
  const bodies: unknown[] = [];
  mockFetch(orderHandler((b) => bodies.push(b)));
  renderOrder();
  await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
  const notes = screen.getByLabelText("Observações");
  await userEvent.clear(notes);
  await userEvent.type(notes, "nova observação");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  await screen.findByText("Envio pendente");
  expect(bodies).toEqual([{ notes: "nova observação", expectedVersion: 2 }]);
});

test("item inválido bloqueia o envio com mensagem", async () => {
  const bodies: unknown[] = [];
  mockFetch(orderHandler((b) => bodies.push(b)));
  renderOrder();
  await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
  const qty = screen.getByLabelText("Quantidade");
  await userEvent.clear(qty);
  await userEvent.type(qty, "0");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText(/Item 1: quantidade inválida/)).toBeInTheDocument();
  expect(bodies).toHaveLength(0);
});

test("itemsPayload valida produto, quantidade e preço", () => {
  const product = { id: "7" } as never;
  expect(itemsPayload([])).toBe("Inclua ao menos um item.");
  expect(itemsPayload([{ key: 1, product: null, quantity: "1", unitPrice: "" }])).toMatch(/escolha o produto/);
  expect(itemsPayload([{ key: 1, product, quantity: "1", unitPrice: "abc" }])).toMatch(/preço inválido/);
  expect(itemsPayload([{ key: 1, product, quantity: "1,5", unitPrice: "1.234,56" }])).toEqual([
    { productId: "7", quantity: "1.5", unitPrice: "1234.56" },
  ]);
});

const po = {
  id: 5, number: "PC-000005", supplierId: 1, supplierName: "Forn", status: "received", expectedDate: null,
  total: "25.00", version: 3, createdBy: "ana@x.com", approvedBy: "admin@xnamai.com", cancelReason: null,
  items: [{ id: 9, position: 0, productId: "77", description: "Caixa", quantity: "10", receivedQuantity: "10", pendingQuantity: "0", unitCost: "2.5" }],
  receipts: [
    { id: 3, invoiceNumber: "NF1", receivedBy: "ana@x.com", receivedAt: "2026-10-07T12:00:00+00:00", reversedAt: null, reversedBy: null, reverseReason: null, warehouseId: 1, lines: [{ itemId: 9, quantity: "10" }] },
    { id: 2, invoiceNumber: "NF0", receivedBy: "ana@x.com", receivedAt: "2026-10-06T12:00:00+00:00", reversedAt: "2026-10-06T13:00:00+00:00", reversedBy: "adm", reverseReason: "NF errada", warehouseId: 1, lines: [{ itemId: 9, quantity: "5" }] },
  ],
};

test("estorno de recebimento: pede confirmação com os efeitos e envia com Idempotency-Key", async () => {
  const mock = mockFetch((call) => {
    if (call.url.startsWith("/purchase-orders?")) return { body: page([po], { sort: "createdAt", order: "desc" }) };
    if (call.url === "/purchase-orders/5") return { body: po };
    if (call.method === "POST" && call.url.endsWith("/reversals")) return { status: 201, body: { receiptId: 3, status: "approved" } };
  });
  renderErp(<PurchasingPage />, { context: erpContext(["*"], []) });
  await userEvent.click(await screen.findByText("PC-000005"));
  const receipts = await screen.findByRole("region", { name: "Recebimentos" });
  expect(within(receipts).getByText("Estornado")).toBeInTheDocument();
  expect(within(receipts).getByText("NF errada")).toBeInTheDocument();
  // só o recebimento válido tem botão de estorno
  await userEvent.click(within(receipts).getByRole("button", { name: "Estornar" }));
  await userEvent.type(screen.getByLabelText("Motivo do estorno"), "NF recusada");
  await userEvent.click(screen.getByRole("button", { name: "Estornar recebimento" }));
  expect(await screen.findByText(/Tudo ou nada/)).toBeInTheDocument();
  expect(mock.calls.some((c) => c.method === "POST")).toBe(false); // ainda não enviou
  await userEvent.click(screen.getByRole("button", { name: "Confirmar estorno" }));
  await waitFor(() => expect(mock.calls.some((c) => c.method === "POST")).toBe(true));
  const post = mock.calls.find((c) => c.method === "POST");
  expect(post?.url).toBe("/purchase-orders/5/receipts/3/reversals");
  expect(post?.body).toEqual({ reason: "NF recusada" });
  expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
});

test("sem permissão de recebimento não há botão de estornar", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/purchase-orders?")) return { body: page([po]) };
    if (call.url === "/purchase-orders/5") return { body: po };
  });
  renderErp(<PurchasingPage />, { context: erpContext(["purchases:read"], []) });
  await userEvent.click(await screen.findByText("PC-000005"));
  const receipts = await screen.findByRole("region", { name: "Recebimentos" });
  expect(within(receipts).queryByRole("button", { name: "Estornar" })).not.toBeInTheDocument();
});

test("administração: senha temporária aparece uma única vez e há encerrar sessões", async () => {
  let issued = false;
  const base = { username: "ana@x.com", displayName: "Ana", roles: ["comercial"], active: true, mustChangePassword: false, locked: false, lastLoginAt: null };
  mockFetch((call) => {
    if (call.url === "/operators") {
      return { body: { roles: ["comercial"], items: [{ ...base, hasPassword: issued, activeSessions: issued ? 2 : 0 }] } };
    }
    if (call.method === "POST" && call.url === "/operators/ana%40x.com/password") {
      issued = true;
      return { body: { username: "ana@x.com", temporaryPassword: "Tmp-Pass-AbC123", mustChangePassword: true, note: "Entregue por canal seguro." } };
    }
    if (call.method === "POST" && call.url.endsWith("/revoke-sessions")) return { body: { username: "ana@x.com", sessionsRevoked: 2 } };
  });
  renderErp(<AdminPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Criar senha" }));
  await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
  expect(await screen.findByText("Tmp-Pass-AbC123")).toBeInTheDocument();
  expect(screen.getByText(/exibida uma única vez/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Já anotei, fechar" }));
  expect(screen.queryByText("Tmp-Pass-AbC123")).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Encerrar sessões" })).toBeInTheDocument();
});

test("minha conta: login do BI não tem senha/sessões próprias do ERP", () => {
  const ctx = erpContext(["*"], []);
  ctx.me = { ...ctx.me, authMethod: "bi_bootstrap" };
  mockFetch(() => undefined);
  renderErp(<AccountPage />, { context: ctx });
  expect(screen.getByText("Você entrou com o login do BI (administrador)")).toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Trocar senha" })).not.toBeInTheDocument();
});

test("minha conta: operador individual lista sessões e troca a senha", async () => {
  const ctx = erpContext(["read"], []);
  ctx.me = { ...ctx.me, authMethod: "erp_session" };
  mockFetch((call) => {
    if (call.url === "/auth/sessions") {
      return { body: { items: [
        { id: "s1", current: true, createdAt: "2026-10-07T12:00:00+00:00", lastUsedAt: null, expiresAt: null, ip: "10.0.0.1", userAgent: "Chrome" },
        { id: "s2", current: false, createdAt: "2026-10-06T12:00:00+00:00", lastUsedAt: null, expiresAt: null, ip: "10.0.0.2", userAgent: "Firefox" },
      ] } };
    }
  });
  renderErp(<AccountPage />, { context: ctx });
  expect(await screen.findByText("Esta sessão")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Encerrar" })).toBeInTheDocument();
  expect(screen.getByRole("form", { name: "Trocar senha" })).toBeInTheDocument();
});
