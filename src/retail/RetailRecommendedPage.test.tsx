import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { expect, test, vi } from "vitest";
import { AppearanceProvider } from "../theme/AppearanceProvider";
import { RetailRecommendedPage } from "./RetailRecommendedPage";

vi.mock("./retailApi", () => ({
  retailApi: {
    configured: true,
    recommended: async () => ({
      items: [
        {
          id: "p1",
          rank: 1,
          name: "Kit Varejo Teste",
          code: "K1",
          listPrice: 100,
          analyzed: true,
          recomendacaoScore: 88.5,
          apelo: "alto",
          melhorPlataforma: "shopee",
          melhorPlataformaLabel: "Shopee",
          melhorEnvioLabel: "Shopee Entrega",
          margemLiquidaPct: 24.5,
          motivoCurto: "Alta demanda na Shopee com margem saudavel",
        },
      ],
      poolSize: 250,
      analyzedCount: 1,
      pendingCount: 249,
      top: 100,
      dashboard: {
        platformDistribution: [{ platform: "shopee", label: "Shopee", count: 1 }],
        appealDistribution: { alto: 1, medio: 0, baixo: 0 },
        avgMarginPct: 24.5,
        avgRecommendationScore: 88.5,
      },
      economics: {},
      disclaimer: "Precos via busca publica/IA.",
    }),
    analysis: async () => ({}),
    analyzeBatch: async () => ({
      processed: [],
      processedCount: 0,
      errors: [],
      pendingCount: 249,
      poolSize: 250,
      analyzedCount: 1,
    }),
  },
}));

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

test("mostra top recomendado com plataforma e porque", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <AppearanceProvider>
        <MemoryRouter>
          <RetailRecommendedPage />
        </MemoryRouter>
      </AppearanceProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText("Top 100 mais indicados para varejo")).toBeTruthy();
  expect(await screen.findByText("Kit Varejo Teste")).toBeTruthy();
  expect(screen.getAllByText("Shopee").length).toBeGreaterThan(0);
  expect(screen.getByText(/Alta demanda na Shopee/)).toBeTruthy();
});
