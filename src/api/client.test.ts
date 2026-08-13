import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../hooks/useAnalyticsFilters";

test("rejects an invalid backend contract instead of keeping stale data", async () => {
  vi.stubEnv("VITE_BI_API_URL", "https://bi.example.test");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ kpis: "invalid" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
  );
  vi.resetModules();
  const { analyticsApi } = await import("./client");

  await expect(analyticsApi.overview(DEFAULT_FILTERS)).rejects.toThrow(
    "Contrato inválido"
  );
});
