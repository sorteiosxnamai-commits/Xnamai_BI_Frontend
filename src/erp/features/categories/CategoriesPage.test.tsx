import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { erpContext, mockFetch, renderErp } from "../../test/utils";
import { CategoriesPage } from "./CategoriesPage";

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const meta = { version: 1, sourceUpdatedAt: null, sourceDeleted: false, capturedAt: null };

const items = [
  { id: "10", name: "Bebidas", parentId: null, active: true, localOnly: false, ...meta },
  { id: "local-cat-1", name: "Cafés", parentId: "10", active: true, localOnly: true, ...meta },
];

test("lista categorias cadastradas e cria subcategoria", async () => {
  const fetch = mockFetch((call) => {
    if (call.method === "GET" && call.url === "/categories") return { body: { items } };
    if (call.method === "POST" && call.url === "/categories") {
      return { status: 201, body: { id: "local-cat-2", name: "Chás", parentId: "10", active: true, localOnly: true, ...meta } };
    }
    return undefined;
  });
  renderErp(<CategoriesPage />, { context: erpContext(["*"]) });
  const cafes = await screen.findByRole("row", { name: /Cafés/ });
  expect(cafes.textContent).toContain("Bebidas");
  expect(screen.getAllByRole("row").some((row) => row.textContent?.includes("Bebidas") && row.textContent?.includes("Mercos"))).toBe(true);
  await userEvent.type(screen.getByRole("searchbox", { name: "Buscar" }), "Caf");
  const filtered = screen.getAllByRole("row").filter((row) => row.querySelector("td"));
  expect(filtered).toHaveLength(1);
  expect(filtered[0]?.textContent).toContain("Cafés");
  await userEvent.clear(screen.getByRole("searchbox", { name: "Buscar" }));
  await userEvent.type(screen.getByRole("textbox", { name: "Nome *" }), "Chás");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: "Categoria pai" }), "10");
  await userEvent.click(screen.getByRole("button", { name: "Criar categoria" }));
  expect(fetch.calls.some((call) => {
    const body = call.body as { parentId?: string; name?: string };
    return call.method === "POST" && call.url === "/categories" && body.parentId === "10" && body.name === "Chás";
  })).toBe(true);
});
