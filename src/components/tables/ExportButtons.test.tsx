import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { DEFAULT_FILTERS } from "../../hooks/useAnalyticsFilters";

const { exportReport } = vi.hoisted(() => ({ exportReport: vi.fn() }));

vi.mock("../../api/client", () => ({
  analyticsApi: { exportReport },
}));
vi.mock("../../auth/AuthProvider", () => ({
  useAuth: () => ({ user: { username: "admin", role: "admin" } }),
}));

import { ExportButtons } from "./ExportButtons";

test("requests a complete filtered export from the backend", async () => {
  exportReport.mockResolvedValue({
    filename: "orders.csv",
    blob: new Blob(["id,total\n1,100"]),
  });
  const createObjectURL = vi.fn(() => "blob:orders");
  const revokeObjectURL = vi.fn();
  Object.defineProperty(URL, "createObjectURL", { value: createObjectURL });
  Object.defineProperty(URL, "revokeObjectURL", { value: revokeObjectURL });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

  render(<ExportButtons report="orders" filters={DEFAULT_FILTERS} />);
  fireEvent.click(screen.getByRole("button", { name: "CSV" }));

  await waitFor(() =>
    expect(exportReport).toHaveBeenCalledWith("orders", "csv", DEFAULT_FILTERS)
  );
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:orders");
});
