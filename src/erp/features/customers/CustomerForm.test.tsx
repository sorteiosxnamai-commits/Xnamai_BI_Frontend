import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { CustomerDetail } from "../../api/schemas";
import { CustomerForm, validateCustomer } from "./CustomerForm";
import { mockFetch, renderErp } from "../../test/utils";

const customer: CustomerDetail = {
  id: "10",
  name: "Cliente Original",
  tradeName: null,
  personType: "J",
  document: "12.345.678/0001-90",
  city: "São Paulo",
  state: "SP",
  email: "c@x.com",
  phone: null,
  segmentId: null,
  sellerId: null,
  blocked: false,
  active: true,
  piiRestricted: false,
  version: 3,
  sourceUpdatedAt: null,
  sourceDeleted: false,
  capturedAt: null,
  stateRegistration: null,
  suframa: null,
  street: null,
  number: null,
  complement: null,
  district: null,
  zipCode: null,
  mobile: null,
  blockReason: null,
  creditLimit: null,
  notes: null,
  sourceCreatedAt: null,
  contacts: [],
  addresses: [],
};

const op = (status: string, extra: Record<string, unknown> = {}) => ({
  operationId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  kind: "update_customer",
  status,
  targetResource: "customers",
  targetId: "10",
  externalId: null,
  operator: "admin@xnamai.com",
  attempts: 0,
  errorCode: null,
  error: null,
  nextAttemptAt: null,
  completedAt: null,
  mirrorConfirmedAt: null,
  createdAt: null,
  statusUrl: "/x",
  synchronized: false,
  canReconcile: false,
  canRetry: false,
  ...extra,
});

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

test("validação: nome obrigatório, documento alfanumérico válido, e-mail e UF", () => {
  const empty = { name: "", tradeName: "", personType: "" as const, document: "", stateRegistration: "", street: "", number: "", complement: "", district: "", zipCode: "", city: "", state: "", email: "", phone: "", mobile: "", notes: "" };
  expect(validateCustomer(empty).name).toBeTruthy();
  expect(validateCustomer({ ...empty, name: "A", document: "AB12CD34000199" }).document).toBeUndefined();
  expect(validateCustomer({ ...empty, name: "A", document: "12$%34" }).document).toBeTruthy();
  expect(validateCustomer({ ...empty, name: "A", email: "sem-arroba" }).email).toBeTruthy();
  expect(validateCustomer({ ...empty, name: "A", state: "SPX" }).state).toBeTruthy();
});

test("envia só os campos alterados + expectedVersion, com Idempotency-Key, e mostra 'Envio pendente'", async () => {
  const mock = mockFetch((call) => {
    if (call.method === "PATCH") return { status: 202, body: op("queued") };
    if (call.url.startsWith("/integration/operations/")) return { body: op("queued") };
  });
  renderErp(<CustomerForm customer={customer} />);
  const city = screen.getByLabelText("Cidade");
  await userEvent.clear(city);
  await userEvent.type(city, "Rio de Janeiro");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText("Envio pendente")).toBeInTheDocument();
  const patch = mock.calls.find((c) => c.method === "PATCH");
  expect(patch?.url).toBe("/customers/10");
  expect(patch?.body).toEqual({ city: "Rio de Janeiro", expectedVersion: 3 });
  expect(patch?.headers.get("Idempotency-Key")).toBeTruthy();
});

test("falha preserva o formulário e o reenvio idêntico reutiliza a mesma chave", async () => {
  let attempt = 0;
  const mock = mockFetch((call) => {
    if (call.method === "PATCH") {
      attempt += 1;
      return attempt === 1
        ? { status: 503, body: { detail: { code: "x", message: "Servidor indisponível" } } }
        : { status: 202, body: op("queued") };
    }
    if (call.url.startsWith("/integration/operations/")) return { body: op("queued") };
  });
  renderErp(<CustomerForm customer={customer} />);
  const city = screen.getByLabelText("Cidade");
  await userEvent.clear(city);
  await userEvent.type(city, "Niterói");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText("Servidor indisponível")).toBeInTheDocument();
  expect(screen.getByLabelText("Cidade")).toHaveValue("Niterói"); // formulário preservado
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText("Envio pendente")).toBeInTheDocument();
  const keys = mock.calls.filter((c) => c.method === "PATCH").map((c) => c.headers.get("Idempotency-Key"));
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("nova edição após concluir recebe nova chave", async () => {
  const mock = mockFetch((call) => {
    if (call.method === "PATCH") return { status: 202, body: op("queued") };
    if (call.url.startsWith("/integration/operations/")) return { body: op("queued") };
  });
  renderErp(<CustomerForm customer={customer} />);
  const city = screen.getByLabelText("Cidade");
  await userEvent.clear(city);
  await userEvent.type(city, "Campinas");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  await screen.findByText("Envio pendente");
  await userEvent.clear(city);
  await userEvent.type(city, "Santos");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  await waitFor(() => expect(mock.calls.filter((c) => c.method === "PATCH")).toHaveLength(2));
  const keys = mock.calls.filter((c) => c.method === "PATCH").map((c) => c.headers.get("Idempotency-Key"));
  expect(keys[0]).not.toBe(keys[1]);
});

test("sem alteração não envia nada; erro de validação bloqueia o envio", async () => {
  const mock = mockFetch(() => undefined);
  renderErp(<CustomerForm customer={customer} />);
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText("Nenhum campo foi alterado.")).toBeInTheDocument();
  const doc = screen.getByLabelText(/Documento/);
  fireEvent.change(doc, { target: { value: "12$%34" } });
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText(/Documento inválido/)).toBeInTheDocument();
  expect(mock.calls).toHaveLength(0);
});

test("cadastro novo envia só preenchidos e preserva documento alfanumérico", async () => {
  const mock = mockFetch((call) => {
    if (call.method === "POST") return { status: 202, body: op("queued", { kind: "create_customer", targetId: null }) };
    if (call.url.startsWith("/integration/operations/")) return { body: op("queued") };
  });
  renderErp(<CustomerForm />);
  await userEvent.type(screen.getByLabelText(/Nome \/ razão social/), "Novo Cliente");
  await userEvent.type(screen.getByLabelText(/Documento/), "AB12CD34000199");
  await userEvent.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
  await screen.findByText("Envio pendente");
  const post = mock.calls.find((c) => c.method === "POST");
  expect(post?.body).toEqual({ name: "Novo Cliente", document: "AB12CD34000199" });
});

test("perfil sem dados pessoais não edita documento nem contatos", () => {
  renderErp(<CustomerForm customer={{ ...customer, piiRestricted: true, document: "••••••90" }} />);
  expect(screen.getByLabelText(/Documento/)).toBeDisabled();
  expect(screen.getByLabelText("E-mail")).toBeDisabled();
  expect(screen.getByText("Dados pessoais protegidos")).toBeInTheDocument();
});

test("queda de rede no envio é 'Resultado em verificação' (não 'falhou'), preserva dados e reaproveita a chave", async () => {
  const keys: (string | null)[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      keys.push(new Headers(init?.headers).get("Idempotency-Key"));
      throw new TypeError("Failed to fetch");
    }),
  );
  renderErp(<CustomerForm customer={customer} />);
  const city = screen.getByLabelText("Cidade");
  await userEvent.clear(city);
  await userEvent.type(city, "Curitiba");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  expect(await screen.findByText("Resultado em verificação")).toBeInTheDocument();
  expect(screen.getByText(/não sabemos se o servidor recebeu/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Cidade")).toHaveValue("Curitiba");
  await userEvent.click(screen.getByRole("button", { name: "Enviar alterações" }));
  await waitFor(() => expect(keys).toHaveLength(2));
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
});

test("após validar, o foco vai para o primeiro campo com erro", async () => {
  mockFetch(() => undefined);
  renderErp(<CustomerForm />);
  await userEvent.click(screen.getByRole("button", { name: "Cadastrar cliente" }));
  await waitFor(() => expect(screen.getByLabelText(/Nome \/ razão social/)).toHaveFocus());
  expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome");
});
