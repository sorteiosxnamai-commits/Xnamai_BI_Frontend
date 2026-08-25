import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { expect, test } from "vitest";
import { AppearanceProvider } from "../theme/AppearanceProvider";
import { HomeGate } from "./HomeGate";

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

test("portal inicial separa CRM aberto e BI restrito", () => {
  render(
    <AppearanceProvider>
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>
    </AppearanceProvider>,
  );
  expect(screen.getByRole("link", { name: "Abrir CRM" })).toHaveAttribute("href", "/crm");
  expect(screen.getByRole("link", { name: "Entrar no BI" })).toHaveAttribute("href", "/overview");
});
