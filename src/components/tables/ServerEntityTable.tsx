import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
  type SortingState,
} from "@tanstack/react-table";
import { MetadataStatus, QueryState } from "../feedback/QueryState";
import type { PageResponse, SortOrder } from "../../types/analytics";

export type EntityColumn<T> = {
  id: string;
  label: string;
  sortable?: boolean;
  render: (row: T) => ReactNode;
};

type Props<T extends object> = {
  title: string;
  description: string;
  queryKey: readonly unknown[];
  columns: EntityColumn<T>[];
  defaultSort: string;
  fetchPage: (options: {
    page: number;
    pageSize: number;
    search: string;
    sort: string;
    order: SortOrder;
  }) => Promise<PageResponse<T>>;
  actions?: ReactNode;
  preferenceKey: string;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  renderSummary?: (summary: Record<string, unknown>) => ReactNode;
  pinnedAction?: {
    header: string;
    render: (row: T) => ReactNode;
  };
  onExcludeVisible?: (rows: T[]) => void;
};

export function ServerEntityTable<T extends object>({
  title,
  description,
  queryKey,
  columns: definitions,
  defaultSort,
  fetchPage,
  actions,
  preferenceKey,
  onRowClick,
  rowLabel,
  renderSummary,
  pinnedAction,
  onExcludeVisible,
}: Props<T>) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([
    { id: defaultSort, desc: true },
  ]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      return JSON.parse(localStorage.getItem(`bi-columns-${preferenceKey}`) || "{}");
    } catch {
      return {};
    }
  });
  useEffect(() => {
    localStorage.setItem(
      `bi-columns-${preferenceKey}`,
      JSON.stringify(columnVisibility)
    );
  }, [columnVisibility, preferenceKey]);
  const activeSort = sorting[0] || { id: defaultSort, desc: true };
  const query = useQuery({
    queryKey: [...queryKey, pageIndex, pageSize, search, activeSort],
    queryFn: () =>
      fetchPage({
        page: pageIndex + 1,
        pageSize,
        search,
        sort: activeSort.id,
        order: activeSort.desc ? "desc" : "asc",
      }),
  });
  const tableColumns = useMemo<ColumnDef<T, unknown>[]>(
    () =>
      definitions.map((definition) => ({
        id: definition.id,
        header: definition.label,
        accessorFn: (row: T) => row,
        cell: (context) => definition.render(context.row.original),
        enableSorting: definition.sortable !== false,
      })),
    [definitions]
  );
  const table = useReactTable({
    data: query.data?.items || [],
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    pageCount: query.data?.totalPages || 0,
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

  return (
    <div className="page-stack">
      {query.data && <MetadataStatus metadata={query.data.metadata} />}
      {query.data?.summary && renderSummary?.(query.data.summary)}
      <article className="module-card table-module">
        <div className="module-heading">
          <div>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <div className="table-actions">
            <input
              type="search"
              value={search}
              placeholder="Buscar…"
              aria-label="Buscar na tabela"
              onChange={(event) => {
                setSearch(event.target.value);
                setPageIndex(0);
              }}
            />
            {onExcludeVisible && search.trim() && !!query.data?.items.length && (
              <button
                type="button"
                className="row-action-solid"
                onClick={() => onExcludeVisible(query.data.items)}
              >
                {query.data.items.length === 1
                  ? "Tirar este cliente da conta"
                  : `Tirar estes ${query.data.items.length} da conta`}
              </button>
            )}
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
            {actions}
          </div>
        </div>
        <QueryState
          loading={query.isLoading}
          error={query.error as Error | null}
          empty={query.data?.totalItems === 0}
          onRetry={() => void query.refetch()}
        />
        {!query.isError && !!query.data?.totalItems && (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  {table.getHeaderGroups().map((group) => (
                    <tr key={group.id}>
                      {pinnedAction && (
                        <th className="pinned-action" scope="col">
                          {pinnedAction.header}
                        </th>
                      )}
                      {group.headers.map((header) => {
                        const sorted = header.column.getIsSorted();
                        return (
                          <th
                            key={header.id}
                            aria-sort={
                              sorted === "asc"
                                ? "ascending"
                                : sorted === "desc"
                                  ? "descending"
                                  : "none"
                            }
                          >
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              disabled={!header.column.getCanSort()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {sorted === "asc" ? " ↑" : sorted === "desc" ? " ↓" : ""}
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
                      className={onRowClick ? "clickable-row" : undefined}
                      role={onRowClick ? "button" : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-label={
                        onRowClick
                          ? rowLabel?.(row.original) || "Abrir detalhes"
                          : undefined
                      }
                      onClick={(event) => {
                        if (
                          (event.target as HTMLElement).closest("button, a, input")
                        ) {
                          return;
                        }
                        onRowClick?.(row.original);
                      }}
                      onKeyDown={(event) => {
                        if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      }}
                    >
                      {pinnedAction && (
                        <td className="pinned-action">
                          {pinnedAction.render(row.original)}
                        </td>
                      )}
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
              <span>
                {query.data.totalItems.toLocaleString("pt-BR")} registros
              </span>
              <select
                aria-label="Registros por página"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPageIndex(0);
                }}
              >
                {[25, 50, 100].map((size) => (
                  <option key={size}>{size}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={pageIndex === 0}
                onClick={() => setPageIndex((x) => x - 1)}
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={pageIndex + 1 >= query.data.totalPages}
                onClick={() => setPageIndex((x) => x + 1)}
              >
                Próxima
              </button>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
