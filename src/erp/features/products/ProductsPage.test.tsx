import { screen, within } from "@testing-library/react";
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

test("lista produtos com foto, preço e estoque, sem o botão Subir", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/products") && call.method === "GET") return { body: page([product]) };
    return undefined;
  });
  renderErp(<ProductsPage />, { context: erpContext(["*"]) });
  expect(await screen.findByRole("link", { name: /Caneca/ })).toHaveAttribute("href", "/erp/produtos/20");
  expect(document.querySelector("img")).toHaveAttribute("src", "https://cdn.example/caneca.jpg");
  expect(screen.getByText(/Estoque/)).toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Mercos Caneca" })).toBeChecked();
  expect(screen.queryByRole("button", { name: "Subir Caneca" })).not.toBeInTheDocument();
});

test("Novo produto abre o cadastro em uma modal", async () => {
  mockFetch((call) => {
    if (call.url.startsWith("/products") && call.method === "GET") return { body: page([product]) };
    if (call.url === "/categories") return { body: { items: [] } };
    return undefined;
  });
  renderErp(<ProductsPage />, { context: erpContext(["*"]) });
  await userEvent.click(await screen.findByRole("button", { name: "Novo produto" }));
  const dialog = await screen.findByRole("dialog", { name: "Novo produto" });
  expect(dialog).toBeInTheDocument();
  expect(within(dialog).getByRole("form", { name: "Novo produto" })).toBeInTheDocument();
  await userEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
  expect(screen.queryByRole("dialog", { name: "Novo produto" })).not.toBeInTheDocument();
});

test("sem permissão de escrita não mostra Novo produto nem Subir", async () => {
  mockFetch(() => ({ body: page([product]) }));
  renderErp(<ProductsPage />, { context: erpContext(["read"]) });
  expect(await screen.findByRole("link", { name: /Caneca/ })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Novo produto" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Subir Caneca" })).not.toBeInTheDocument();
  expect(screen.getByRole("checkbox", { name: "Mercos Caneca" })).toBeDisabled();
});
