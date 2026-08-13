import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { ServerEntityTable, type EntityColumn } from "./ServerEntityTable";

type Row = { id: string; name: string; revenue: number };

const metadata = {
  generatedAt: "2026-08-12T12:00:00Z",
  dataThrough: "2026-08-12T12:00:00Z",
  isPartial: false,
  warnings: [],
  quality: {},
};

const columns: EntityColumn<Row>[] = [
  { id: "name", label: "Nome", render: (row) => row.name },
  { id: "revenue", label: "Receita", render: (row) => row.revenue },
];

test("opens row drilldown and persists selected columns", async () => {
  localStorage.clear();
  const onRowClick = vi.fn();
  const fetchPage = vi.fn().mockResolvedValue({
    items: [{ id: "1", name: "Cliente A", revenue: 100 }],
    page: 1,
    pageSize: 50,
    totalItems: 1,
    totalPages: 1,
    sort: "revenue",
    order: "desc",
    appliedFilters: {},
    metadata,
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={client}>
      <ServerEntityTable
        title="Entidades"
        description="Teste"
        queryKey={["entities"]}
        columns={columns}
        defaultSort="revenue"
        preferenceKey="entities-test"
        fetchPage={fetchPage}
        onRowClick={onRowClick}
        rowLabel={(row) => `Abrir ${row.name}`}
      />
    </QueryClientProvider>
  );

  fireEvent.click(await screen.findByRole("button", { name: "Abrir Cliente A" }));
  expect(onRowClick).toHaveBeenCalledWith(
    expect.objectContaining({ id: "1", name: "Cliente A" })
  );

  fireEvent.click(screen.getByText("Colunas"));
  fireEvent.click(screen.getByRole("checkbox", { name: "Receita" }));
  expect(localStorage.getItem("bi-columns-entities-test")).toContain(
    '"revenue":false'
  );
});
