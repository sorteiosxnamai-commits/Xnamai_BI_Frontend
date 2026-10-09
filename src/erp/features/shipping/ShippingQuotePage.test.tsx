import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Call, erpContext, mockFetch, page, renderErp } from "../../test/utils";
import { ShippingPage } from "./ShippingPage";
import { ShippingQuotePage } from "./ShippingQuotePage";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const orderDetail = {
  id: "10",
  number: "10",
  kind: "order",
  customerId: "c1",
  customerName: "Mercado Central",
  issuedAt: null,
  issueDate: "2026-10-06",
  netTotal: "459.90",
  grossTotal: null,
  discountTotal: null,
  itemCount: 5,
  itemsComplete: true,
  statuses: { commercial: "2", billing: null, fulfillment: "not_started", payment: null },
  version: 1,
  sourceUpdatedAt: null,
  sourceDeleted: false,
  capturedAt: null,
  incomplete: false,
  items: [],
  operational: {
    customerName: "Mercado Central",
    responsible: { sellerId: null, name: null },
    state: { code: "in_progress", label: "Em andamento" },
    itemsPreview: [],
    totals: { gross: null, discount: null, freight: null, net: "459.90" },
    pendencies: [],
    lastExternalUpdateAt: null,
    lastHumanAction: null,
    shipping: { state: "none" },
    invoice: { state: "unavailable" },
    payment: { state: "unknown" },
    pix: { state: "unknown" },
  },
};

const option = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  carrier: "Correios",
  service: "PAC",
  price: "23.90",
  deadlineMinDays: 5,
  deadlineMaxDays: 7,
  validUntil: null,
  expired: false,
  tracking: true,
  pickupMode: "Postagem",
  notes: null,
  source: "manual",
  createdBy: "ana@x.com",
  createdAt: "2026-10-08T10:00:00+00:00",
  ...extra,
});

const quote = (extra: Record<string, unknown> = {}) => ({
  id: 7,
  orderId: "10",
  status: "draft",
  stored_status: "draft",
  stale: false,
  staleReason: null,
  source: "manual",
  version: 1,
  orderVersion: 1,
  originZip: null,
  destination: { zip: "01234567", city: "São Paulo", state: "SP" },
  declaredValue: "459.90",
  volumes: [{ position: 0, weightKg: "1.25", lengthCm: "30", widthCm: "20", heightCm: "15" }],
  totals: { volumes: 1, weightKg: "1.250", cubageM3: "0.0090", items: 5 },
  items: [],
  options: [],
  selectedOptionId: null,
  selectedAt: null,
  selectedBy: null,
  selectionReason: null,
  notes: null,
  createdBy: "ana@x.com",
  createdAt: "2026-10-08T10:00:00+00:00",
  statement: "Seleção local: não contrata o frete, não gera etiqueta e não confirma envio.",
  ...extra,
});

const provider = { available: false, reason: "Nenhum conector de cotação de frete está configurado nesta base." };

function setup(
  quotes: unknown[],
  options: { permissions?: string[]; replies?: Record<string, { status?: number; body: unknown }> } = {},
) {
  const calls: Call[] = [];
  mockFetch((call) => {
    calls.push(call);
    for (const [prefix, reply] of Object.entries(options.replies ?? {})) {
      if (call.method === "POST" && call.url.startsWith(prefix)) return reply;
    }
    if (call.url === "/sales-orders/10") return { body: orderDetail };
    if (call.url === "/sales-orders/10/history") return { body: { items: [] } };
    if (call.url === "/sales-orders/10/shipping-quotes" && call.method === "GET") {
      return { body: { orderId: "10", provider, items: quotes } };
    }
  });
  renderErp(
    <Routes>
      <Route path="/erp/frete/pedidos/:id/cotacao" element={<ShippingQuotePage />} />
    </Routes>,
    { route: "/erp/frete/pedidos/10/cotacao", context: erpContext(options.permissions ?? ["*"]) },
  );
  return { calls };
}

test("automática desabilitada explica a dependência; nenhum preço aparece sem cadastro", async () => {
  setup([]);
  expect(await screen.findByRole("heading", { name: "Cotação de Frete" })).toBeInTheDocument();
  const auto = screen.getByRole("button", { name: /Cotar automaticamente/ });
  expect(auto).toBeDisabled();
  expect(screen.getAllByText(/Nenhum conector de cotação de frete/).length).toBeGreaterThan(0);
  expect(screen.getByText("Sem cotação para este pedido")).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument(); // nenhuma opção/preço inventado
  expect(screen.queryByText("Selecionar frete (local)")).not.toBeInTheDocument();
});

test("criar cotação com vários volumes envia decimais exatos e Idempotency-Key", async () => {
  const { calls } = setup([], {
    replies: { "/sales-orders/10/shipping-quotes": { status: 201, body: quote() } },
  });
  await screen.findByRole("form", { name: "Dados para cotação" });
  const form = within(screen.getByRole("form", { name: "Dados para cotação" }));
  await userEvent.type(form.getAllByLabelText("Peso (kg)")[0], "1,25");
  await userEvent.type(form.getAllByLabelText("Comprimento (cm)")[0], "30");
  await userEvent.type(form.getAllByLabelText("Largura (cm)")[0], "20");
  await userEvent.type(form.getAllByLabelText("Altura (cm)")[0], "15");
  await userEvent.click(form.getByRole("button", { name: /Adicionar volume/ }));
  await userEvent.type(form.getAllByLabelText("Peso (kg)")[1], "2");
  await userEvent.type(form.getAllByLabelText("Comprimento (cm)")[1], "40");
  await userEvent.type(form.getAllByLabelText("Largura (cm)")[1], "40");
  await userEvent.type(form.getAllByLabelText("Altura (cm)")[1], "10");
  expect(form.getByText(/Total informado: 3,25 kg/)).toBeInTheDocument();
  await userEvent.click(form.getByRole("button", { name: "Criar cotação (rascunho)" }));
  await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
  const post = calls.find((c) => c.method === "POST");
  expect(post?.url).toBe("/sales-orders/10/shipping-quotes");
  expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
  expect(post?.body).toMatchObject({
    volumes: [
      { weightKg: "1.25", lengthCm: "30", widthCm: "20", heightCm: "15" },
      { weightKg: "2", lengthCm: "40", widthCm: "40", heightCm: "10" },
    ],
  });
}, 20_000);

test("volume inválido mostra o erro e não envia nada", async () => {
  const { calls } = setup([]);
  const form = within(await screen.findByRole("form", { name: "Dados para cotação" }));
  await userEvent.type(form.getAllByLabelText("Peso (kg)")[0], "0");
  await userEvent.type(form.getAllByLabelText("Comprimento (cm)")[0], "30");
  await userEvent.type(form.getAllByLabelText("Largura (cm)")[0], "20");
  await userEvent.type(form.getAllByLabelText("Altura (cm)")[0], "15");
  await userEvent.click(form.getByRole("button", { name: "Criar cotação (rascunho)" }));
  expect(await form.findByText(/Volume 1: informe peso e as três dimensões/)).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false);
});

test("selecionar a opção é local e envia a versão esperada", async () => {
  const draft = quote({ options: [option(1), option(2, { carrier: "Jadlog", service: "Normal", price: "29.80" })] });
  const { calls } = setup([draft], {
    replies: { "/shipping-quotes/7/select": { body: quote({ stored_status: "selected", status: "selected", selectedOptionId: 2, version: 2, options: draft.options }) } },
  });
  await userEvent.click(await screen.findByRole("radio", { name: "Escolher Jadlog Normal" }));
  await userEvent.click(screen.getByRole("button", { name: "Selecionar frete (local)" }));
  await waitFor(() => expect(calls.some((c) => c.url === "/shipping-quotes/7/select")).toBe(true));
  const post = calls.find((c) => c.url === "/shipping-quotes/7/select");
  expect(post?.body).toEqual({ optionId: 2, expectedVersion: 1 });
  expect(post?.headers.get("Idempotency-Key")).toBeTruthy();
});

test("trocar a seleção exige motivo antes de enviar", async () => {
  const selected = quote({
    stored_status: "selected", status: "selected", selectedOptionId: 1, version: 2,
    options: [option(1), option(2, { carrier: "Jadlog", service: "Normal", price: "29.80" })],
  });
  const { calls } = setup([selected]);
  await userEvent.click(await screen.findByRole("radio", { name: "Escolher Jadlog Normal" }));
  await userEvent.click(screen.getByRole("button", { name: "Selecionar frete (local)" }));
  expect(await screen.findByText("Informe o motivo para trocar o frete já selecionado.")).toBeInTheDocument();
  expect(calls.some((c) => c.method === "POST")).toBe(false);
});

test("cotação desatualizada bloqueia a seleção e manda refazer", async () => {
  const stale = quote({
    stale: true, status: "stale", staleReason: "O pedido foi alterado depois desta cotação; revise antes de usar.",
    options: [option(1)],
  });
  setup([stale]);
  expect(await screen.findByText("Cotação desatualizada", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Escolher Correios PAC" })).toBeDisabled();
  expect(screen.queryByRole("button", { name: "Selecionar frete (local)" })).not.toBeInTheDocument();
});

test("opção vencida não pode ser escolhida", async () => {
  setup([quote({ options: [option(1, { expired: true, validUntil: "2026-10-01T10:00:00+00:00" })] })]);
  expect(await screen.findByText("Vencida")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Escolher Correios PAC" })).toBeDisabled();
});

test("conflito de versão aparece como erro e preserva o que a pessoa escolheu", async () => {
  const draft = quote({ options: [option(1)] });
  setup([draft], {
    replies: {
      "/shipping-quotes/7/select": {
        status: 409,
        body: { detail: { code: "version_conflict", message: "A cotação foi alterada por outra pessoa; recarregue e confira antes de selecionar" } },
      },
    },
  });
  await userEvent.click(await screen.findByRole("radio", { name: "Escolher Correios PAC" }));
  await userEvent.click(screen.getByRole("button", { name: "Selecionar frete (local)" }));
  expect(await screen.findByText(/alterada por outra pessoa/)).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Escolher Correios PAC" })).toBeChecked();
});

test("registro manual valida o valor e envia a opção como cadastro manual", async () => {
  const { calls } = setup([quote()], {
    replies: { "/shipping-quotes/7/options": { status: 201, body: quote({ options: [option(1)] }) } },
  });
  const form = within(await screen.findByRole("form", { name: "Registrar cotação obtida fora do sistema" }));
  await userEvent.type(form.getByLabelText("Transportadora"), "Correios");
  await userEvent.type(form.getByLabelText("Serviço"), "PAC");
  await userEvent.click(form.getByRole("button", { name: "Registrar opção" }));
  expect(await form.findByText("Informe o valor do frete (ex.: 23,90).")).toBeInTheDocument();
  await userEvent.type(form.getByLabelText("Valor do frete (R$)"), "23,90");
  await userEvent.click(form.getByRole("button", { name: "Registrar opção" }));
  await waitFor(() => expect(calls.some((c) => c.url === "/shipping-quotes/7/options")).toBe(true));
  expect(calls.find((c) => c.url === "/shipping-quotes/7/options")?.body).toMatchObject({
    carrier: "Correios", service: "PAC", price: "23.90",
  });
});

test("perfil só de consulta vê a cotação, sem formulários nem seleção", async () => {
  setup([quote({ options: [option(1)] })], { permissions: ["read", "shipping:read"] });
  expect(await screen.findByText("Opções de frete")).toBeInTheDocument();
  expect(screen.queryByRole("form", { name: "Registrar cotação obtida fora do sistema" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Selecionar frete (local)" })).not.toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Escolher Correios PAC" })).toBeDisabled();
  expect(screen.getByText(/só consulta cotações/)).toBeInTheDocument();
});

test("lista de frete mostra contagens por estado e a opção selecionada", async () => {
  const calls: Call[] = [];
  mockFetch((call) => {
    calls.push(call);
    if (call.url.startsWith("/operational-summary")) {
      return {
        body: {
          filters: {}, coverage: { complete: true, resources: {}, note: null },
          orders: { count: 2, byKind: {} }, values: { net: "0", gross: "0", note: null },
          variation: { available: false, reason: "x" }, payment: { byStatus: {}, pix: { available: false } },
          pendencies: { itemsIncomplete: 0, customerMissing: 0, any: 0 },
          shipping: { available: true, counts: { none: 4, draft: 1, selected: 2, stale: 0 } },
        },
      };
    }
    if (call.url.startsWith("/sales-orders")) {
      return {
        body: page([{ ...orderDetail, operational: { ...orderDetail.operational, shipping: { state: "selected", label: "Correios · PAC", price: "23.90", deadline: "5 a 7 dias úteis" } } }]),
      };
    }
  });
  renderErp(<ShippingPage />, { route: "/erp/frete?shipping=selected", context: erpContext(["*"]) });
  expect(await screen.findByText("Correios · PAC")).toBeInTheDocument();
  expect(screen.getByText("5 a 7 dias úteis")).toBeInTheDocument();
  expect(await screen.findByText("4")).toBeInTheDocument();
  expect(calls.find((c) => c.url.startsWith("/sales-orders"))?.url).toContain("shipping=selected");
});
