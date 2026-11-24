import { useState } from "react";
import { Link } from "react-router-dom";
import type { ZodType } from "zod";
import { z } from "zod";
import { buildQuery } from "../../api/client";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import { type Page, type Product, operationSchema, pageOf, productSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { OperationTracker } from "../../components/OperationTracker";
import { StatePanel } from "../../components/StatePanel";
import { Badge, CapabilityNotice, CommandError, PageHeader } from "../../components/ui";
import { formatMoney, formatQuantity } from "../../format";
import { ProductPhoto } from "./ProductForm";

const schema = pageOf(productSchema) as unknown as ZodType<Page<Product>>;
const publishSchema = operationSchema.extend({
  stockPublish: z.string().nullable().optional(),
});

export function ProductsPage() {
  const { can, capability } = useErp();
  const writable = can("products:write");
  const mercos = capability("write.products");
  const mercosBlocked = Boolean(mercos && !mercos.enabled);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [page, setPage] = useState(1);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [operations, setOperations] = useState<Record<string, string>>({});
  const [error, setError] = useState<Error | null>(null);
  const patch = useCommand<Record<string, unknown>, Product>(productSchema);
  const publish = useCommand<undefined, z.infer<typeof publishSchema>>(publishSchema);
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

  async function subir(product: Product) {
    setError(null);
    setPendingId(product.id);
    const result = await publish
      .mutateAsync({
        path: `/products/${encodeURIComponent(product.id)}/publish`,
        method: "POST",
        idempotent: true,
      })
      .catch((reason: Error) => {
        setError(reason);
        return null;
      });
    setPendingId(null);
    if (result) setOperations((current) => ({ ...current, [product.id]: result.operationId }));
  }

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Todos os produtos da base, com foto, estoque e carga para o Mercos. Marque Mercos e use Subir para enviar."
        actions={writable ? <Link className="erp-btn erp-btn-primary" to="/erp/produtos/novo">Novo produto</Link> : undefined}
      />
      <CapabilityNotice capability={mercos} />
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
                <span>{product.code || "Sem código"}</span>
                <span>{formatMoney(product.listPrice)} · estoque {formatQuantity(product.externalStock)}</span>
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
                {writable && (
                  <button
                    type="button"
                    className="erp-btn"
                    aria-label={`Subir ${product.name}`}
                    disabled={pendingId === product.id || product.onMercos !== true || mercosBlocked}
                    title={mercosBlocked ? mercos?.reason ?? "Carga do Mercos indisponível" : "Enviar este produto ao Mercos"}
                    onClick={() => void subir(product)}
                  >
                    Subir
                  </button>
                )}
              </div>
              {operations[product.id] && <OperationTracker operationId={operations[product.id]} />}
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
