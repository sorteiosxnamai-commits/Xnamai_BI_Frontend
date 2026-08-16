import { Suspense } from "react";
import { render, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { lazyPage } from "./lazyPage";

test("reloads once when a previous deploy's chunk is missing", async () => {
  sessionStorage.clear();
  const reload = vi.fn();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { reload },
  });
  const Page = lazyPage(async () => {
    throw new TypeError(
      "Failed to fetch dynamically imported module: https://xnamai-bi-frontend.vercel.app/assets/CustomersPage-Bid6_u4O.js",
    );
  });

  render(
    <Suspense fallback={null}>
      <Page />
    </Suspense>
  );

  await waitFor(() => expect(reload).toHaveBeenCalledOnce());
  expect(sessionStorage.getItem("bi-chunk-reload")).toBe("1");
});
