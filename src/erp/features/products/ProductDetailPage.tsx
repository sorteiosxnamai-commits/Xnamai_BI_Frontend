import { Link, useLocation, useParams } from "react-router-dom";
import { useErpQuery } from "../../api/hooks";
import { productDetailSchema, productPricesSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { OperationTracker } from "../../components/OperationTracker";
import { StatePanel } from "../../components/StatePanel";
import { Badge, CapabilityNotice, Dl, PageHeader } from "../../components/ui";
import { formatInstant, formatMoney, formatQuantity } from "../../format";
import { ProductEditor, ProductPhoto } from "./ProductForm";

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const { can, capability } = useErp();
  const location = useLocation();
  const seeded = (location.state as { operationId?: string } | null)?.operationId ?? null;
  const query = useErpQuery(["product", id], `/products/${encodeURIComponent(id)}`, productDetailSchema);
  const prices = useErpQuery(["product", id, "prices"], `/products/${encodeURIComponent(id)}/prices`, productPricesSchema);

  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const product = query.data;
  if (!product) return null;
  const writable = can("products:write") && !product.sourceDeleted;

  return (
    <>
      <PageHeader
        title={product.name}
        subtitle={`Produto ${product.id}${product.code ? ` · código ${product.code}` : ""} · origem atualizada em ${formatInstant(product.sourceUpdatedAt)}`}
        actions={<Link className="erp-btn" to="/erp/produtos">Voltar à lista</Link>}
      />
      <CapabilityNotice capability={capability("write.products")} />
      {product.sourceDeleted && (
        <div className="erp-notice">
          <strong>Produto excluído</strong>
          <span>Ele saiu da lista. Se ainda existir no Mercos, uma sincronização pode trazê-lo de volta.</span>
        </div>
      )}
      {seeded && <OperationTracker operationId={seeded} />}
      <div className="erp-product-layout">
        <ProductPhoto name={product.name} url={product.imageUrl} />
        {writable ? (
          <ProductEditor product={product} onSaved={() => void query.refetch()} />
        ) : (
          <section className="erp-card">
            <h3>Dados do produto</h3>
            <Dl
              items={[
                ["Código", product.code],
                ["Unidade", product.unit],
                ["Preço de tabela", formatMoney(product.listPrice)],
                ["Preço mínimo", formatMoney(product.minimumPrice)],
                ["Estoque", formatQuantity(product.externalStock)],
                ["NCM", product.ncm],
                ["Mercos", product.onMercos ? "Marcado" : "Não marcado"],
                ["Situação", product.active === false ? <Badge value="cancelled" label="Inativo" /> : <Badge value="active" label="Ativo" />],
              ]}
            />
          </section>
        )}
      </div>
      <section className="erp-card">
        <h3>Logística</h3>
        <Dl
          items={[
            ["Peso bruto", formatQuantity(product.grossWeight)],
            ["Largura", formatQuantity(product.width)],
            ["Altura", formatQuantity(product.height)],
            ["Comprimento", formatQuantity(product.length)],
            ["Múltiplo", formatQuantity(product.multiple)],
            ["Comissão (%)", formatQuantity(product.commissionPercent)],
            ["IPI (%)", formatQuantity(product.ipiPercent)],
          ]}
        />
      </section>
      <section className="erp-card">
        <h3>Preços por tabela</h3>
        {prices.isLoading && <StatePanel kind="loading" />}
        {prices.error && <StatePanel kind="error" message={(prices.error as Error).message} onRetry={() => void prices.refetch()} />}
        {prices.data && prices.data.items.length === 0 && (
          <StatePanel kind="empty" message="Nenhum preço por tabela recebido para este produto." />
        )}
        {prices.data && prices.data.items.length > 0 && (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead><tr><th>Tabela</th><th className="num">Preço</th></tr></thead>
              <tbody>
                {prices.data.items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.priceTableName ?? `Tabela ${row.priceTableId}`}</td>
                    <td className="num">{formatMoney(row.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="erp-card">
        <h3>Variantes</h3>
        {product.variants.length === 0 ? (
          <StatePanel kind="empty" message="Sem variantes recebidas da origem." />
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead><tr><th>Código</th><th>Nome</th><th className="num">Saldo externo</th><th className="num">Preço</th></tr></thead>
              <tbody>
                {product.variants.map((variant, index) => (
                  <tr key={variant.id ?? index}>
                    <td>{variant.code ?? "—"}</td>
                    <td>{variant.name ?? "—"}</td>
                    <td className="num">{formatQuantity(variant.externalStock)}</td>
                    <td className="num">{formatMoney(variant.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
