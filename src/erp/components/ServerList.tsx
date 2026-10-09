import { type ReactNode, useEffect, useState } from "react";
import type { z } from "zod";
import { buildQuery, ErpApiError } from "../api/client";
import { useErpQuery } from "../api/hooks";
import type { Page } from "../api/schemas";
import { StatePanel } from "./StatePanel";

export type Column<T> = {
  key: string;
  header: string;
  sortKey?: string;
  render: (row: T) => ReactNode;
};

export type FilterDef = {
  name: string;
  label: string;
  type: "text" | "select";
  options?: { value: string; label: string }[];
  placeholder?: string;
};

type Props<T> = {
  /** Identificador do recurso para a query key. */
  resource: string;
  path: string;
  schema: z.ZodType<Page<T>>;
  columns: Column<T>[];
  filters?: FilterDef[];
  fixedParams?: Record<string, string | number | boolean | undefined>;
  defaultSort: string;
  defaultOrder?: "asc" | "desc";
  pageSize?: number;
  rowKey: (row: T) => string | number;
  onRowOpen?: (row: T) => void;
  emptyMessage?: string;
  toolbar?: ReactNode;
  caption: string;
};

/**
 * Lista paginada, filtrada e ordenada NO SERVIDOR. A ordenação só envia chaves
 * que o backend publica (allowlist); mudar filtro volta para a página 1.
 */
export function ServerList<T>({
  resource,
  path,
  schema,
  columns,
  filters = [],
  fixedParams,
  defaultSort,
  defaultOrder = "asc",
  pageSize = 25,
  rowKey,
  onRowOpen,
  emptyMessage = "Nenhum registro encontrado com os filtros atuais.",
  toolbar,
  caption,
}: Props<T>) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(defaultSort);
  const [order, setOrder] = useState<"asc" | "desc">(defaultOrder);
  const [applied, setApplied] = useState<Record<string, string>>({});

  // Texto digitado é aplicado após uma pausa; mudar filtro volta para a página 1.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setApplied(values);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [values]);

  // Busca, período e filtros externos (fixedParams) mudaram: volta para a página 1.
  const fixedKey = JSON.stringify(fixedParams ?? {});
  // biome-ignore lint/correctness/useExhaustiveDependencies: fixedKey só dispara o retorno à página 1
  useEffect(() => {
    setPage(1);
  }, [fixedKey]);

  const params = { ...fixedParams, ...applied, page, page_size: pageSize, sort, order };
  const query = useErpQuery<Page<T>>(
    [resource, params],
    `${path}${buildQuery(params)}`,
    schema,
    { keepPrevious: true },
  );

  function toggleSort(key: string) {
    if (sort === key) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(key);
      setOrder("asc");
    }
    setPage(1);
  }

  const data = query.data;
  const forbidden = query.error instanceof ErpApiError && query.error.status === 403;

  return (
    <section className="erp-card" aria-label={caption}>
      {(filters.length > 0 || toolbar) && (
        <div className="erp-toolbar">
          <div className="erp-filters">
            {filters.map((filter) =>
              filter.type === "select" ? (
                <label key={filter.name} className="erp-field">
                  <span>{filter.label}</span>
                  <select
                    value={values[filter.name] ?? ""}
                    onChange={(event) => setValues({ ...values, [filter.name]: event.target.value })}
                  >
                    <option value="">Todos</option>
                    {filter.options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label key={filter.name} className="erp-field">
                  <span>{filter.label}</span>
                  <input
                    type="search"
                    placeholder={filter.placeholder}
                    value={values[filter.name] ?? ""}
                    onChange={(event) => setValues({ ...values, [filter.name]: event.target.value })}
                  />
                </label>
              ),
            )}
          </div>
          {toolbar && <div className="erp-toolbar-actions">{toolbar}</div>}
        </div>
      )}
      {query.isLoading && <StatePanel kind="loading" />}
      {forbidden && <StatePanel kind="forbidden" message="Seu perfil não tem acesso a esta lista." />}
      {query.error && !forbidden && (
        <StatePanel
          kind="error"
          message={(query.error as Error).message}
          onRetry={() => void query.refetch()}
        />
      )}
      {data && data.items.length === 0 && <StatePanel kind="empty" message={emptyMessage} />}
      {data && data.items.length > 0 && (
        <div className="erp-table-wrap">
          <table className="erp-table">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      column.sortKey && sort === column.sortKey
                        ? order === "asc"
                          ? "ascending"
                          : "descending"
                        : undefined
                    }
                  >
                    {column.sortKey ? (
                      <button type="button" onClick={() => toggleSort(column.sortKey as string)}>
                        {column.header}
                        {sort === column.sortKey ? (order === "asc" ? " ▲" : " ▼") : ""}
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={onRowOpen ? "erp-row-link" : undefined}
                  tabIndex={onRowOpen ? 0 : undefined}
                  onClick={onRowOpen ? () => onRowOpen(row) : undefined}
                  onKeyDown={
                    onRowOpen
                      ? (event) => {
                          if (event.key === "Enter") onRowOpen(row);
                        }
                      : undefined
                  }
                >
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && data.totalItems > 0 && (
        <nav className="erp-pager" aria-label="Paginação">
          <span>
            Página {data.page} de {Math.max(data.totalPages, 1)} · {data.totalItems} registros
            {query.isFetching ? " · atualizando…" : ""}
          </span>
          <button
            type="button"
            className="erp-btn"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Anterior
          </button>
          <button
            type="button"
            className="erp-btn"
            disabled={page >= data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </nav>
      )}
    </section>
  );
}
