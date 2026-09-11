import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { MetadataStatus, QueryState } from "./QueryState";

test("renders loading, empty and retryable error states explicitly", () => {
  const { rerender } = render(<QueryState loading error={null} />);
  expect(screen.getByText("Carregando dados…")).toBeInTheDocument();

  rerender(<QueryState loading={false} error={null} empty />);
  expect(screen.getByText("Sem dados no período selecionado.")).toBeInTheDocument();

  const retry = vi.fn();
  rerender(
    <QueryState
      loading={false}
      error={new Error("API indisponível")}
      onRetry={retry}
    />
  );
  expect(screen.getByText("API indisponível")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(retry).toHaveBeenCalledOnce();
});

test("shows last successful sync time instead of last emission date wording", () => {
  render(
    <MetadataStatus
      metadata={{
        generatedAt: "2026-09-11T17:00:00.000Z",
        dataThrough: "2026-09-11T17:00:00.000Z",
        isPartial: false,
        warnings: [],
        quality: { ordersWithItemsPct: 100 },
      }}
    />
  );
  expect(screen.getByText(/sincronizado até/)).toBeInTheDocument();
});
