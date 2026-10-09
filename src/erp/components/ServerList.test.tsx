import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { ZodType } from "zod";
import { type Customer, customerSchema, type Page, pageOf } from "../api/schemas";
import { mockFetch, page, renderErp } from "../test/utils";
import { type Column, ServerList } from "./ServerList";

const schema = pageOf(customerSchema) as unknown as ZodType<Page<Customer>>;
const row = (id: string, name: string): Record<string, unknown> => ({
  id, name, tradeName: null, personType: null, document: "••90", city: "SP", state: "SP",
  email: null, phone: null, segmentId: null, sellerId: null, blocked: false, active: true,
  piiRestricted: true, version: 1, sourceUpdatedAt: null, sourceDeleted: false, capturedAt: null,
});
const columns: Column<Customer>[] = [
  { key: "name", header: "Cliente", sortKey: "name", render: (c) => c.name },
  { key: "city", header: "Cidade", render: (c) => c.city ?? "—" },
];

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function list() {
  return renderErp(
    <ServerList<Customer>
      resource="customers"
      path="/customers"
      schema={schema}
      caption="Clientes"
      columns={columns}
      filters={[{ name: "search", label: "Buscar", type: "text" }]}
      defaultSort="name"
      pageSize={2}
      rowKey={(c) => c.id}
    />,
  );
}

test("paginação, ordenação e filtro acontecem no servidor", async () => {
  const mock = mockFetch((call) => {
    const q = new URL(`https://x${call.url}`).searchParams;
    const current = Number(q.get("page"));
    return {
      body: page([row(`${current}a`, `Cliente ${current}A`)], {
        page: current, pageSize: 2, totalItems: 5, totalPages: 3, sort: q.get("sort") ?? "name", order: q.get("order") ?? "asc",
      }),
    };
  });
  list();
  expect(await screen.findByText("Cliente 1A")).toBeInTheDocument();
  const first = new URL(`https://x${mock.calls[0].url}`).searchParams;
  expect(first.get("page")).toBe("1");
  expect(first.get("page_size")).toBe("2");
  expect(first.get("sort")).toBe("name");
  expect(screen.getByText(/Página 1 de 3 · 5 registros/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(await screen.findByText("Cliente 2A")).toBeInTheDocument();
  expect(new URL(`https://x${mock.calls.at(-1)?.url}`).searchParams.get("page")).toBe("2");

  await userEvent.click(screen.getByRole("button", { name: /Cliente/ }));
  await waitFor(() => {
    const q = new URL(`https://x${mock.calls.at(-1)?.url}`).searchParams;
    expect(q.get("order")).toBe("desc");
    expect(q.get("page")).toBe("1"); // ordenar volta para a página 1
  });

  await userEvent.type(screen.getByLabelText("Buscar"), "ana");
  await waitFor(() => {
    const q = new URL(`https://x${mock.calls.at(-1)?.url}`).searchParams;
    expect(q.get("search")).toBe("ana");
    expect(q.get("page")).toBe("1");
  });
});

test("estado vazio, erro com nova tentativa e proibido", async () => {
  mockFetch(() => ({ body: page([]) }));
  const first = list();
  expect(await screen.findByText("Nenhum registro encontrado com os filtros atuais.")).toBeInTheDocument();
  first.unmount();

  mockFetch(() => ({ status: 503, body: { detail: { code: "x", message: "Consulta excedeu o tempo" } } }));
  const second = list();
  expect(await screen.findByText("Consulta excedeu o tempo")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Tentar novamente" })).toBeInTheDocument();
  second.unmount();

  mockFetch(() => ({ status: 403, body: { detail: { code: "forbidden", message: "Sem permissão" } } }));
  list();
  expect(await screen.findByText("Seu perfil não tem acesso a esta lista.")).toBeInTheDocument();
});

test("contrato inválido da API é rejeitado em vez de renderizar dados quebrados", async () => {
  mockFetch(() => ({ body: { items: [{ id: 1 }], page: "x" } }));
  list();
  expect(await screen.findByText(/Contrato inválido da API ERP/)).toBeInTheDocument();
});
