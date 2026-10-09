import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ERP_AUTH_EXPIRED } from "../../api/client";
import { ErpShell } from "../../components/ErpShell";
import { type Call, erpContext, mockFetch, page, renderErp } from "../../test/utils";
import { OrdersPage } from "./OrdersPage";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ref = (state: string, extra: Record<string, unknown> = {}) => ({ state, ...extra });

function order(id: string, overrides: Record<string, unknown> = {}, operational: Record<string, unknown> = {}) {
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
    itemCount: 2,
    itemsComplete: true,
    statuses: { commercial: "2", billing: null, fulfillment: "not_started", payment: null },
    version: 1,
    sourceUpdatedAt: null,
    sourceDeleted: false,
    capturedAt: null,
    operational: {
      customerName: "Mercado Central",
      responsible: { sellerId: "s1", name: "Vendedora Ana" },
      state: { code: "in_progress", label: "Em andamento" },
      itemsPreview: [{ name: "Cerveja Pilsen", code: "CP-600", quantity: "1" }],
      totals: { gross: "99.00", discount: null, freight: null, net: "99.00" },
      pendencies: [],
      lastExternalUpdateAt: "2026-10-06T12:00:00+00:00",
      lastHumanAction: null,
      shipping: ref("unavailable", { reason: "Sem fonte de frete nesta base" }),
      invoice: ref("unavailable"),
      payment: ref("unknown"),
      pix: ref("unknown", { reason: "Sem provedor de Pix configurado" }),
      ...operational,
    },
    ...overrides,
  };
}

const summary = (overrides: Record<string, unknown> = {}) => ({
  filters: {},
  coverage: { complete: true, resources: { orders: "success", customers: "success" }, note: null },
  orders: { count: 2, byKind: { order: 2 } },
  values: { net: "198.00", gross: "198.00", note: "Valor vendido; não é valor recebido." },
  variation: { available: false, reason: "Sem período definido para comparar" },
  payment: { byStatus: { paid: 1, unknown: 1 }, pix: { available: false, reason: "Sem provedor de Pix" } },
  pendencies: { itemsIncomplete: 1, customerMissing: 0, any: 1 },
  ...overrides,
});

function setup(
  items: unknown[],
  options: { summary?: unknown; route?: string; permissions?: string[]; status?: number } = {},
) {
  const calls: Call[] = [];
  const mocked = mockFetch((call) => {
    calls.push(call);
    if (options.status) return { status: options.status, body: { detail: "Sessão inválida ou expirada" } };
    if (call.url.startsWith("/operational-summary")) return { body: options.summary ?? summary() };
    if (call.url.startsWith("/sales-orders")) return { body: page(items, { sort: "issuedAt", order: "desc" }) };
  });
  const view = renderErp(<OrdersPage />, {
    route: options.route ?? "/erp/pedidos",
    context: erpContext(options.permissions ?? ["*"]),
  });
  return { ...mocked, view, calls };
}

test("tabela mostra frete, nota, pagamento, Pix e pendências sem inventar estados", async () => {
  setup([
    order("100", {}, { payment: ref("paid"), pendencies: [] }),
    order("101", { itemsComplete: false, itemCount: null }, {
      pendencies: [{ code: "items_incomplete", label: "Itens ainda não sincronizados" }],
      shipping: ref("none"),
      invoice: ref("draft"),
    }),
  ]);
  const rows = await screen.findAllByRole("row");
  const first = within(rows[1]);
  expect(first.getByText("#100")).toBeInTheDocument();
  expect(first.getByText("Mercos: 2")).toBeInTheDocument(); // status de origem preservado
  expect(first.getByText("2 itens")).toBeInTheDocument();
  expect(first.getByText("Pago")).toBeInTheDocument();
  expect(first.getAllByText("Indisponível").length).toBe(2); // frete e nota sem fonte
  expect(first.getAllByText("—", { selector: ".erp-muted" })).toHaveLength(2); // Pix desconhecido e sem pendências
  expect(first.getByText("sincronizado do Mercos")).toBeInTheDocument(); // nenhuma ação humana
  const second = within(rows[2]);
  expect(second.getByText("Incompleto")).toBeInTheDocument();
  expect(second.getByText("Não cotado")).toBeInTheDocument();
  expect(second.getByText("Rascunho")).toBeInTheDocument();
  expect(second.getByText("Itens")).toBeInTheDocument(); // pendência
  // nunca aparece "Emitida" nem "Pix gerado" sem fonte real
  expect(screen.queryByText(/Emitida|Pix gerado/)).not.toBeInTheDocument();
});

test("ação humana é distinguida da atualização vinda do Mercos", async () => {
  setup([
    order("100", {}, { lastHumanAction: { at: "2026-10-07T15:00:00+00:00", operator: "ana@x.com", action: "update_order" } }),
  ]);
  expect(await screen.findByText("por ana@x.com")).toBeInTheDocument();
});

test("indicadores vêm do resumo do filtro; variação e fontes ausentes aparecem como indisponíveis", async () => {
  setup([order("100")]);
  expect(await screen.findByText("Pedidos no filtro")).toBeInTheDocument();
  expect(await screen.findByText("2")).toBeInTheDocument();
  expect(screen.getByText(/Variação indisponível: Sem período definido para comparar/)).toBeInTheDocument();
  expect(screen.getByText("Em cotação de frete")).toBeInTheDocument();
  expect(screen.getAllByText("Indisponível").length).toBeGreaterThanOrEqual(2); // frete e fiscal sem fonte (cartões)
  expect(screen.getByText(/1 sem itens · 0 sem cliente/)).toBeInTheDocument();
});

test("variação disponível mostra o percentual calculado e o período anterior", async () => {
  setup([order("100")], {
    summary: summary({ variation: { available: true, percent: "75.00", previousNet: "200.00" } }),
  });
  expect(await screen.findByText(/\+75,00% vs\. período anterior/)).toBeInTheDocument();
});

test("importação parcial avisa que os totais não cobrem tudo", async () => {
  setup([order("100")], {
    summary: summary({
      coverage: { complete: false, resources: { orders: "running", customers: "never" }, note: "Importação parcial: totais refletem só o sincronizado." },
    }),
  });
  expect(await screen.findByText("Dados parcialmente sincronizados")).toBeInTheDocument();
  expect(screen.getByText(/Importação parcial: totais refletem só o sincronizado/)).toBeInTheDocument();
});

test("filtros escrevem na URL e chegam ao servidor junto com o resumo", async () => {
  const { calls } = setup([order("100")]);
  await screen.findByText("#100");
  await userEvent.selectOptions(screen.getByLabelText("Status"), "quote");
  await waitFor(() =>
    expect(calls.some((c) => c.url.startsWith("/sales-orders") && c.url.includes("kind=quote"))).toBe(true),
  );
  expect(calls.some((c) => c.url.startsWith("/operational-summary") && c.url.includes("kind=quote"))).toBe(true);
  await userEvent.selectOptions(screen.getByLabelText("Pendências"), "true");
  await waitFor(() => expect(calls.some((c) => c.url.includes("pending=true") && c.url.includes("kind=quote"))).toBe(true));
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Limpar filtros" })).not.toBeInTheDocument());
});

test("URL direta aplica busca, período e filtros desde a primeira consulta", async () => {
  const { calls } = setup([order("100")], {
    route: "/erp/pedidos?search=cerveja&from=2026-10-01&to=2026-10-31&kind=order&pending=false",
  });
  await screen.findByText("#100");
  const list = calls.find((c) => c.url.startsWith("/sales-orders"));
  expect(list?.url).toContain("search=cerveja");
  expect(list?.url).toContain("dateFrom=2026-10-01");
  expect(list?.url).toContain("dateTo=2026-10-31");
  expect(list?.url).toContain("kind=order");
  expect(list?.url).toContain("pending=false");
  expect(list?.url).toContain("include=operational");
  expect(screen.getByLabelText("Buscar por número do pedido, cliente ou produto")).toHaveValue("cerveja");
});

test("sessão expirada é erro com aviso de login, nunca tabela vazia", async () => {
  const expired = vi.fn();
  window.addEventListener(ERP_AUTH_EXPIRED, expired);
  setup([], { status: 401 });
  expect(await screen.findAllByText("Sessão expirada. Entre novamente para continuar.")).not.toHaveLength(0);
  expect(screen.queryByText(/Nenhum pedido/)).not.toBeInTheDocument();
  expect(expired).toHaveBeenCalled();
  window.removeEventListener(ERP_AUTH_EXPIRED, expired);
});

test("lista vazia real explica o motivo e diferencia filtro de ausência de dados", async () => {
  setup([], { summary: summary({ orders: { count: 0, byKind: {} } }) });
  expect(await screen.findByText(/Nenhum pedido no espelho/)).toBeInTheDocument();
});

test("botão global exige escolher o pedido explicitamente", async () => {
  const { calls } = setup([order("100"), order("101")], { permissions: ["*"] });
  await screen.findByText("#100");
  await userEvent.click(screen.getByRole("button", { name: /Nova cotação de frete/ }));
  const dialog = await screen.findByRole("dialog", { name: "Nova cotação de frete" });
  expect(within(dialog).getByText("Escolha o pedido")).toBeInTheDocument();
  expect(calls.some((c) => c.url.includes("/sales-orders") && c.url.includes("page_size=8"))).toBe(true);
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("sem permissão de frete e fiscal, os botões e itens de menu não aparecem", async () => {
  setup([order("100")], { permissions: ["read"] });
  await screen.findByText("#100");
  expect(screen.queryByRole("button", { name: /Nova cotação de frete/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Montar nota fiscal/ })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Ações do pedido 100" }));
  const menu = screen.getByRole("menu");
  expect(within(menu).getByText("Abrir pedido")).toBeInTheDocument();
  expect(within(menu).queryByText("Cotação de frete")).not.toBeInTheDocument();
});

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

test("menu na ordem do plano, permissões e Configurações como destino das telas existentes", () => {
  mockFetch(() => ({ body: page([]) }));
  renderErp(
    <ErpShell>
      <Where />
    </ErpShell>,
    { route: "/erp/integracoes", context: erpContext(["*"]) },
  );
  const nav = within(screen.getByRole("navigation", { name: "Navegação principal" }));
  expect(nav.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Visão Geral",
    "Pedidos",
    "Nota Fiscal",
    "Frete",
    "Financeiro",
    "Reembolsos",
    "Configurações",
  ]);
  // /erp/integracoes pertence a Configurações: o item fica ativo
  expect(nav.getByRole("link", { name: "Configurações" })).toHaveAttribute("aria-current", "page");
});

test("operador sem permissões extras só vê o que pode usar", () => {
  mockFetch(() => ({ body: page([]) }));
  renderErp(<ErpShell><span /></ErpShell>, { route: "/erp", context: erpContext(["read"]) });
  const names = within(screen.getByRole("navigation", { name: "Navegação principal" }))
    .getAllByRole("link")
    .map((link) => link.textContent);
  expect(names).toEqual(["Visão Geral", "Pedidos", "Configurações"]);
});

test("busca do cabeçalho leva a Pedidos com o termo e mantém o período", async () => {
  mockFetch(() => ({ body: page([]) }));
  renderErp(
    <Routes>
      <Route
        path="*"
        element={
          <ErpShell>
            <Where />
          </ErpShell>
        }
      />
    </Routes>,
    { route: "/erp/financeiro?from=2026-10-01&to=2026-10-31", context: erpContext(["*"]) },
  );
  const field = screen.getByLabelText("Buscar pedidos por número, cliente ou produto");
  await userEvent.type(field, "cerveja{Enter}");
  const where = await screen.findByTestId("where");
  await waitFor(() => expect(where.textContent).toContain("/erp/pedidos"));
  expect(where.textContent).toContain("search=cerveja");
  expect(where.textContent).toContain("from=2026-10-01");
  expect(where.textContent).toContain("to=2026-10-31");
});

test("período rejeita data final anterior à inicial e aplica um intervalo válido", async () => {
  mockFetch(() => ({ body: page([]) }));
  renderErp(
    <ErpShell>
      <Where />
    </ErpShell>,
    { route: "/erp/pedidos", context: erpContext(["*"]) },
  );
  await userEvent.click(screen.getByRole("button", { name: /Todo o período/ }));
  const dialog = screen.getByRole("dialog", { name: "Escolher período" });
  await userEvent.type(within(dialog).getByLabelText("De"), "2026-10-10");
  await userEvent.type(within(dialog).getByLabelText("Até"), "2026-10-01");
  expect(within(dialog).getByRole("alert")).toHaveTextContent("A data final não pode ser anterior à inicial.");
  expect(within(dialog).getByRole("button", { name: "Aplicar período" })).toBeDisabled();
  await userEvent.clear(within(dialog).getByLabelText("Até"));
  await userEvent.type(within(dialog).getByLabelText("Até"), "2026-10-20");
  await userEvent.click(within(dialog).getByRole("button", { name: "Aplicar período" }));
  expect(await screen.findByRole("button", { name: /10\/10\/2026 – 20\/10\/2026/ })).toBeInTheDocument();
  expect(screen.getByTestId("where").textContent).toContain("from=2026-10-10&to=2026-10-20");
});

test("tela pequena: menu lateral abre e fecha com estado acessível", async () => {
  mockFetch(() => ({ body: page([]) }));
  renderErp(<ErpShell><span /></ErpShell>, { route: "/erp", context: erpContext(["*"]) });
  const toggle = screen.getByRole("button", { name: "Abrir menu" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  await userEvent.click(toggle);
  expect(screen.getByRole("button", { name: "Fechar menu" })).toHaveAttribute("aria-expanded", "true");
  expect(document.querySelector(".erp-shell")).toHaveClass("erp-nav-open");
  await userEvent.click(screen.getByRole("link", { name: "Pedidos" }));
  expect(document.querySelector(".erp-shell")).not.toHaveClass("erp-nav-open");
});

test("aviso de uso interno pode ser dispensado e não exibe sino nem suporte fictícios", async () => {
  mockFetch(() => ({ body: page([]) }));
  window.localStorage.clear();
  renderErp(<ErpShell><span /></ErpShell>, { route: "/erp", context: erpContext(["*"]) });
  expect(screen.getAllByText(/Uso interno/).length).toBeGreaterThan(0);
  expect(screen.queryByText(/Abrir suporte|Precisa de ajuda/)).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /notifica/i })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Dispensar aviso" }));
  expect(screen.queryByRole("note")).not.toBeInTheDocument();
});
