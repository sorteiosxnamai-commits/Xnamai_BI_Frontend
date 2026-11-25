import { useEffect, useId, useState } from "react";
import { Link } from "react-router-dom";
import type { ZodType } from "zod";
import { buildQuery } from "../../api/client";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import { type Page, type Product, pageOf, productSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { StatePanel } from "../../components/StatePanel";
import { Badge, CapabilityNotice, CommandError, PageHeader } from "../../components/ui";
import { formatMoney, formatQuantity } from "../../format";
import { ProductEditor, ProductPhoto } from "./ProductForm";

function ProductCreateModal({ onClose }: { onClose: () => void }) {
  const { capability } = useErp();
  const titleId = useId();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    document.querySelector<HTMLElement>(".erp-modal-wide input")?.focus();
  }, []);

  return (
    <div
      className="erp-modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="erp-modal erp-modal-wide" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div>
            <h3 id={titleId}>Novo produto</h3>
            <p className="erp-muted">O cadastro fica neste ERP. Marque Mercos e use Subir para enviar o produto e o estoque.</p>
          </div>
          <button type="button" className="erp-btn" onClick={onClose}>
            Fechar
          </button>
        </header>
        <CapabilityNotice capability={capability("write.products")} />
        <ProductEditor onClose={onClose} />
      </div>
    </div>
  );
}

const schema = pageOf(productSchema) as unknown as ZodType<Page<Product>>;

export function ProductsPage() {
  const { can } = useErp();
  const writable = can("products:write");
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const patch = useCommand<Record<string, unknown>, Product>(productSchema);
  const invalidate = useInvalidateErp();
  const query = useErpQuery(
    ["products", { search, active, page }],
    `/products${buildQuery({ search, active: active || undefined, page, page_size: 24, sort: "name" })}`,
    schema,
    { keepPrevious: true },
  );

  async function toggleMercos(product: Product, onMercos: boolean) {
    setError(null);
    setPendingId(product.id);
    const result = await patch
      .mutateAsync({
        path: `/products/${encodeURIComponent(product.id)}`,
        method: "PATCH",
        body: { expectedVersion: product.version, onMercos },
      })
      .catch((reason: Error) => {
        setError(reason);
        return null;
      });
    setPendingId(null);
    if (result) void invalidate("products");
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Produtos do Mercos, com a foto do catálogo, preço e estoque. A carga para o Mercos fica no detalhe do produto."
        actions={writable ? (
          <button type="button" className="erp-btn erp-btn-primary" onClick={() => setCreating(true)}>
            Novo produto
          </button>
        ) : undefined}
      />
      {creating && <ProductCreateModal onClose={() => setCreating(false)} />}
      <form className="erp-toolbar" onSubmit={(event) => event.preventDefault()} aria-label="Consultar produtos">
        <label className="erp-field">
          <span>Buscar</span>
          <input
            type="search"
            value={search}
            placeholder="Nome ou código"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="erp-field">
          <span>Situação</span>
          <select
            value={active}
            onChange={(event) => {
              setActive(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos</option>
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
          </select>
        </label>
      </form>
      <CommandError error={error} />
      {query.isLoading && <StatePanel kind="loading" />}
      {query.error && (
        <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />
      )}
      {query.data && query.data.items.length === 0 && (
        <StatePanel kind="empty" message="Nenhum produto na base com esses filtros." />
      )}
      {query.data && query.data.items.length > 0 && (
        <ul className="erp-product-grid">
          {query.data.items.map((product) => (
            <li key={product.id} className="erp-product-card">
              <Link className="erp-product-open" to={`/erp/produtos/${encodeURIComponent(product.id)}`}>
                <ProductPhoto name={product.name} url={product.imageUrl} />
                <strong>{product.name}</strong>
                <span>{product.code || "Sem código"}{product.unit ? ` · ${product.unit}` : ""}</span>
                <span>{formatMoney(product.listPrice)}</span>
                <span>Estoque {formatQuantity(product.externalStock)}</span>
                {product.active === false && <Badge value="cancelled" label="Inativo" />}
                {product.localOnly && <Badge value="partial" label="Só neste ERP" />}
              </Link>
              <div className="erp-product-actions">
                <label className="erp-check">
                  <input
                    type="checkbox"
                    checked={product.onMercos === true}
                    disabled={!writable || pendingId === product.id}
                    aria-label={`Mercos ${product.name}`}
                    onChange={(event) => void toggleMercos(product, event.target.checked)}
                  />
                  Mercos
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}
      {query.data && query.data.totalPages > 1 && (
        <div className="erp-form-actions">
          <button type="button" className="erp-btn" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </button>
          <span className="erp-muted">Página {query.data.page} de {query.data.totalPages}</span>
          <button
            type="button"
            className="erp-btn"
            disabled={page >= query.data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </button>
        </div>
      )}
    </>
  );
}
