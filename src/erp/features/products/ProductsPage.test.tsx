import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { erpContext, mockFetch, page, renderErp } from "../../test/utils";
import { ProductsPage } from "./ProductsPage";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const product = {
  id: "20",
  code: "CAN",
  name: "Caneca",
  unit: "UN",
  categoryId: null,
  kind: "simple",
  sellable: true,
  listPrice: "12.50",
  minimumPrice: null,
  externalStock: "8",
  active: true,
  imageUrl: "https://cdn.example/caneca.jpg",
  onMercos: true,
  localOnly: false,
  version: 1,
  sourceUpdatedAt: null,
  sourceDeleted: false,
  capturedAt: null,
};

const queued = {
  operationId: "op-1",
  kind: "publish_product",
  status: "queued",
  targetResource: "products",
  targetId: "20",
  externalId: null,
  operator: "admin@xnamai.com",
  attempts: 0,
  errorCode: null,
  error: null,
  nextAttemptAt: null,
  completedAt: null,
  mirrorConfirmedAt: null,
  createdAt: "2026-11-24T12:00:00+00:00",
  statusUrl: "/integration/operations/op-1",
  synchronized: false,
  stockPublish: null,
};

test("lista produtos com foto, checkbox Mercos e botão Subir", async () => {
  const fetch = mockFetch((call) => {
    if (call.url.startsWith("/products") && call.method === "GET") return { body: page([product]) };
    if (call.url === "/products/20/publish") return { status: 202, body: queued };
    if (call.url.startsWith("/integration/operations/")) {
      return { body: { ...queued, idempotencyKey: "k", canReconcile: false, canRetry: false } };
    }
    return undefined;
  });
  renderErp(<ProductsPage />, { context: erpContext(["*"]) });
  expect(await screen.findByRole("link", { name: /Caneca/ })).toHaveAttribute("href", "/erp/produtos/20");
  expect(document.querySelector("img")).toHaveAttribute("src", "https://cdn.example/caneca.jpg");
  expect(screen.getByRole("checkbox", { name: "Mercos Caneca" })).toBeChecked();
  await userEvent.click(screen.getByRole("button", { name: "Subir Caneca" }));
  expect(fetch.calls.some((call) => call.method === "POST" && call.url === "/products/20/publish")).toBe(true);
  expect(await screen.findByText(/Envio pendente|Acompanhando operação/)).toBeInTheDocument();
});

test("sem permissão de escrita não mostra Novo produto nem Subir", async () => {
  mockFetch(() => ({ body: page([product]) }));
  renderErp(<ProductsPage />, { context: erpContext(["read"]) });
  expect(await screen.findByRole("link", { name: /Caneca/ })).toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Novo produto" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Subir Caneca" })).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Mercos Caneca" })).toBeDisabled();
});
