import { useEffect, useState } from "react";
import type { ZodType } from "zod";
import { buildQuery } from "../api/client";
import { useErpQuery } from "../api/hooks";
import {
  type CatalogEntry,
  type Customer,
  catalogEntrySchema,
  customerSchema,
  type Page,
  type Product,
  pageOf,
  productSchema,
} from "../api/schemas";

function useDebounced<V>(value: V, ms = 300): V {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const customerPage = pageOf(customerSchema) as unknown as ZodType<Page<Customer>>;
const productPage = pageOf(productSchema) as unknown as ZodType<Page<Product>>;
const catalogPage = pageOf(catalogEntrySchema) as unknown as ZodType<Page<CatalogEntry>>;

type PickerProps<T> = {
  label: string;
  placeholder?: string;
  selected: T | null;
  onSelect: (value: T | null) => void;
  describe: (value: T) => string;
  invalid?: boolean;
};

function SearchPicker<T extends { id: string }>({
  label,
  placeholder,
  selected,
  onSelect,
  describe,
  invalid,
  useResults,
}: PickerProps<T> & { useResults: (term: string) => { items: T[]; loading: boolean; error?: Error | null } }) {
  const [term, setTerm] = useState("");
  const debounced = useDebounced(term);
  const { items, loading, error } = useResults(debounced);
  if (selected) {
    return (
      <div className="erp-field">
        <span>{label}</span>
        <div>
          <strong>{describe(selected)}</strong>{" "}
          <button type="button" className="erp-btn" onClick={() => onSelect(null)}>
            Trocar
          </button>
        </div>
      </div>
    );
  }
  return (
    <label className="erp-field">
      <span>{label}</span>
      <input
        type="search"
        placeholder={placeholder ?? "Digite ao menos 2 letras"}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        aria-invalid={invalid}
        autoComplete="off"
      />
      {loading && <small className="erp-muted">Buscando…</small>}
      {error && <small className="erp-field-error">{error.message}</small>}
      {debounced.length >= 2 && !loading && items.length === 0 && !error && (
        <small className="erp-muted">Nenhum resultado.</small>
      )}
      {items.length > 0 && (
        <div className="erp-suggestions">
          {items.map((item) => (
            <button key={item.id} type="button" className="erp-suggestion" onClick={() => onSelect(item)}>
              {describe(item)}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

function useCustomerSearch(term: string) {
  const query = useErpQuery(
    ["picker", "customers", term],
    `/customers${buildQuery({ search: term, page_size: 8 })}`,
    customerPage,
    { enabled: term.length >= 2 },
  );
  return {
    items: term.length >= 2 ? (query.data?.items ?? []) : [],
    loading: query.isFetching,
    error: query.error as Error | null,
  };
}

function useProductSearch(term: string) {
  const query = useErpQuery(
    ["picker", "products", term],
    `/products${buildQuery({ search: term, page_size: 8, kind: "simple" })}`,
    productPage,
    { enabled: term.length >= 2 },
  );
  return {
    items: term.length >= 2 ? (query.data?.items ?? []) : [],
    loading: query.isFetching,
    error: query.error as Error | null,
  };
}

export function CustomerPicker(props: Omit<PickerProps<Customer>, "describe">) {
  return (
    <SearchPicker<Customer>
      {...props}
      describe={(c) => `${c.name}${c.city ? ` — ${c.city}/${c.state ?? ""}` : ""}`}
      useResults={useCustomerSearch}
    />
  );
}

export function ProductPicker(props: Omit<PickerProps<Product>, "describe">) {
  return (
    <SearchPicker<Product>
      {...props}
      describe={(p) => `${p.code ? `${p.code} · ` : ""}${p.name}`}
      useResults={useProductSearch}
    />
  );
}

/** Opções de um cadastro auxiliar (ativos), para selects de pedido. */
export function useCatalogOptions(resource: string) {
  const query = useErpQuery(
    ["catalog-options", resource],
    `/catalogs/${resource}${buildQuery({ page_size: 100, active: "true" })}`,
    catalogPage,
    { staleTime: 5 * 60_000 },
  );
  return {
    options: (query.data?.items ?? []).map((item) => ({ value: item.id, label: item.name })),
    loading: query.isLoading,
    error: query.error as Error | null,
  };
}
