import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppearanceProvider } from "../theme/AppearanceProvider";
import { HomeGate } from "./HomeGate";

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
});

afterEach(() => vi.unstubAllEnvs());

function renderGate() {
  return render(
    <AppearanceProvider>
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>
    </AppearanceProvider>,
  );
}

test("com a flag ligada o portal mostra quatro cartões e preserva os três atuais", () => {
  vi.stubEnv("VITE_ERP_ENABLED", "true");
  const { container } = renderGate();
  expect(container.querySelectorAll(".home-gate-grid > article")).toHaveLength(4);
  expect(screen.getByRole("link", { name: "Abrir CRM" })).toHaveAttribute("href", "/crm");
  expect(screen.getByRole("link", { name: "Abrir Analise Varejo" })).toHaveAttribute("href", "/analise-varejo");
  expect(screen.getByRole("link", { name: "Entrar no BI" })).toHaveAttribute("href", "/overview");
  expect(screen.getByRole("link", { name: "Entrar no ERP" })).toHaveAttribute("href", "/erp");
  expect(screen.getByRole("heading", { name: "ERP Xnamai" })).toBeInTheDocument();
  expect(screen.getByText("Gestão operacional")).toBeInTheDocument();
});

test("com a flag desligada o cartão ERP e a entrada somem", () => {
  const { container } = renderGate();
  expect(container.querySelectorAll(".home-gate-grid > article")).toHaveLength(3);
  expect(screen.queryByRole("link", { name: "Entrar no ERP" })).not.toBeInTheDocument();
  expect(container.querySelector(".home-gate-grid.has-erp")).toBeNull();
});
