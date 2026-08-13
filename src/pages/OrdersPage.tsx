import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { analyticsApi } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { MetadataStatus, QueryState } from "../components/feedback/QueryState";
import type { AnalyticsFilters, OrderAnalyticsRow } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const columnHelper = createColumnHelper<OrderAnalyticsRow>();
const columns = [
  columnHelper.accessor("number", { header: "Número" }),
  columnHelper.accessor("issuedAt", {
    header: "Data",
    cell: ({ getValue }) =>
      getValue() ? new Date(getValue() as string).toLocaleString("pt-BR") : "—",
  }),
  columnHelper.accessor("customerName", { header: "Cliente" }),
  columnHelper.accessor("sellerName", { header: "Vendedor" }),
  columnHelper.accessor("status", { header: "Status" }),
  columnHelper.accessor("itemCount", { header: "Itens" }),
  columnHelper.accessor("skuCount", { header: "SKUs" }),
  columnHelper.accessor("discount", {
    header: "Desconto",
    cell: ({ getValue }) => money.format(Number(getValue() || 0)),
  }),
  columnHelper.accessor("total", {
    header: "Total",
    cell: ({ getValue }) => money.format(Number(getValue() || 0)),
  }),
];

const SORT_MAP: Record<string, string> = {
  number: "number",
  issuedAt: "issued_at",
  customerName: "customer_name",
  sellerName: "seller_name",
  status: "status",
  total: "total",
  discount: "discount",
};

export function OrdersPage({ filters }: { filters: AnalyticsFilters }) {
  const { user } = useAuth();
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: "issuedAt", desc: true },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      return JSON.parse(localStorage.getItem("bi-columns-orders") || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem("bi-columns-orders", JSON.stringify(columnVisibility));
  }, [columnVisibility]);
  const activeSort = sorting[0] || { id: "issuedAt", desc: true };
  const orders = useQuery({
    queryKey: [
      "analytics",
      "orders",
      filters,
      pageIndex,
      pageSize,
      search,
      activeSort,
    ],
    queryFn: () =>
      analyticsApi.orders(filters, {
        page: pageIndex + 1,
        pageSize,
        search,
        sort: SORT_MAP[activeSort.id] || "issued_at",
        order: activeSort.desc ? "desc" : "asc",
      }),
  });
  const detail = useQuery({
    queryKey: ["analytics", "order-detail", selectedId, filters],
    queryFn: () => analyticsApi.orderDetail(selectedId as string, filters),
    enabled: Boolean(selectedId),
  });

  const table = useReactTable({
    data: orders.data?.items || [],
    columns,
    defaultColumn: {
      cell: ({ getValue }) => String(getValue() ?? "—"),
    },
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: orders.data?.totalPages || 0,
    state: {
      sorting,
      columnVisibility,
      pagination: { pageIndex, pageSize },
    },
    onColumnVisibilityChange: setColumnVisibility,
    onSortingChange: (updater) => {
      setSorting((previous) =>
        typeof updater === "function" ? updater(previous) : updater
      );
      setPageIndex(0);
    },
  });

  const range = useMemo(() => {
    if (!orders.data?.totalItems) return "0 registros";
    const start = pageIndex * pageSize + 1;
    const end = Math.min(start + pageSize - 1, orders.data.totalItems);
    return `${start}–${end} de ${orders.data.totalItems.toLocaleString("pt-BR")}`;
  }, [orders.data, pageIndex, pageSize]);

  async function exportOrders(format: "csv" | "xlsx") {
    setExporting(true);
    setExportError("");
    try {
      const file = await analyticsApi.exportReport("orders", format, filters);
      const url = URL.createObjectURL(file.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setExportError(cause instanceof Error ? cause.message : "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="page-stack">
      {orders.data && <MetadataStatus metadata={orders.data.metadata} />}
      <article className="module-card table-module">
        <div className="module-heading">
          <div>
            <h2>Pedidos</h2>
            <p>Paginação, busca e ordenação processadas em toda a base.</p>
          </div>
          <div className="table-actions">
            <input
              type="search"
              placeholder="Buscar número, cliente, vendedor…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPageIndex(0);
              }}
            />
            <details className="column-selector">
              <summary>Colunas</summary>
              <div>
                {table.getAllLeafColumns().map((column) => (
                  <label key={column.id}>
                    <input
                      type="checkbox"
                      checked={column.getIsVisible()}
                      onChange={column.getToggleVisibilityHandler()}
                    />
                    {String(column.columnDef.header)}
                  </label>
                ))}
              </div>
            </details>
            {user?.role === "admin" && (
              <>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void exportOrders("csv")}
                >
                  CSV
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => void exportOrders("xlsx")}
                >
                  XLSX
                </button>
              </>
            )}
          </div>
        </div>
        {exportError && <div className="state-panel error">{exportError}</div>}
        <QueryState
          loading={orders.isLoading}
          error={orders.error as Error | null}
          empty={orders.data?.totalItems === 0}
          onRetry={() => void orders.refetch()}
        />
        {!orders.isError && !!orders.data?.totalItems && (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {group.headers.map((header) => {
                        const sortable = Boolean(SORT_MAP[header.column.id]);
                        const direction = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            aria-sort={
                              direction === "asc"
                                ? "ascending"
                                : direction === "desc"
                                  ? "descending"
                                  : "none"
                            }
                          >
                            <button
                              type="button"
                              disabled={!sortable}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {direction === "asc" ? " ↑" : direction === "desc" ? " ↓" : ""}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      aria-label={`Abrir pedido ${row.original.number}`}
                      onClick={() => setSelectedId(row.original.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedId(row.original.id);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <span>{range}</span>
              <label>
                Por página
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPageIndex(0);
                  }}
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((x) => x - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={!orders.data || pageIndex + 1 >= orders.data.totalPages}
                onClick={() => setPageIndex((x) => x + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </article>

      {selectedId && (
        <div className="drawer-backdrop">
          <aside
            className="detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Detalhe do pedido"
          >
            <button
              type="button"
              className="drawer-close"
              onClick={() => setSelectedId(null)}
            >
              Fechar
            </button>
            <QueryState
              loading={detail.isLoading}
              error={detail.error as Error | null}
              onRetry={() => void detail.refetch()}
            />
            {detail.data && (
              <>
                <h2>Pedido {detail.data.order.number}</h2>
                <p>
                  {detail.data.order.customerName || "Cliente não identificado"} ·{" "}
                  {money.format(detail.data.order.total)}
                </p>
                <p className="table-note">
                  O total do pedido e o faturamento usam o preço de tabela
                  atual. O valor unitário do pedido fica só como histórico.
                  Preços sentinela de R$ 1.000,00 aparecem como indisponíveis
                  e não entram nos totais.
                </p>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th>Valor unitário do pedido</th>
                        <th>Preço de tabela atual</th>
                        <th>Total a preço de tabela</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.items.map((item) => (
                        <tr key={item.id || item.position}>
                          <td>{item.name}</td>
                          <td>{item.quantity.toLocaleString("pt-BR")}</td>
                          <td>{money.format(item.sourceUnitPrice)}</td>
                          <td>
                            {item.unitPrice == null
                              ? "Indisponível"
                              : money.format(item.unitPrice)}
                          </td>
                          <td>
                            {item.total == null
                              ? "Indisponível"
                              : money.format(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
