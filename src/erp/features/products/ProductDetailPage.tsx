import { Link, useLocation, useParams } from "react-router-dom";
import { useErpQuery } from "../../api/hooks";
import { productDetailSchema, productHistorySchema, productPricesSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { OperationTracker } from "../../components/OperationTracker";
import { StatePanel } from "../../components/StatePanel";
import { Badge, CapabilityNotice, Dl, PageHeader } from "../../components/ui";
import { formatDay, formatInstant, formatMoney, formatQuantity } from "../../format";
import { ProductEditor, ProductPhoto } from "./ProductForm";

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const { can, capability } = useErp();
  const location = useLocation();
  const seeded = (location.state as { operationId?: string } | null)?.operationId ?? null;
  const query = useErpQuery(["product", id], `/products/${encodeURIComponent(id)}`, productDetailSchema);
  const prices = useErpQuery(["product", id, "prices"], `/products/${encodeURIComponent(id)}/prices`, productPricesSchema);
  const history = useErpQuery(["product", id, "history"], `/products/${encodeURIComponent(id)}/history`, productHistorySchema);

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
        <div>
          <ProductPhoto name={product.name} url={product.imageUrl || product.photos?.[0]} />
          {(product.photos ?? []).length > 1 && (
            <div className="erp-product-thumbs">
              {product.photos?.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer">
                  <img src={url} alt="" />
                </a>
              ))}
            </div>
          )}
        </div>
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
                ["Quantidade", product.packKind === "box" ? "Caixa" : product.packKind === "unit" ? "Unitário" : "—"],
                ["Preço de compra", formatMoney(product.cost)],
                ["Código do fornecedor", product.supplierCode],
                ["Código de barras", product.barcode],
                ["Lote", product.lot],
                ["Data de entrada", formatDay(product.receivedAt)],
                ["Local no estoque", product.stockLocation],
                ["NCM", product.ncm],
                ["Descrição", product.description],
                ["Mercos", product.onMercos ? "Marcado" : "Não marcado"],
                ["Situação", product.active === false ? <Badge value="cancelled" label="Inativo" /> : <Badge value="active" label="Ativo" />],
              ]}
            />
          </section>
        )}
      </div>
      <section className="erp-card">
        <h3>Logística</h3>
        <p className="erp-muted">
          Peso e dimensões vêm do espelho do Mercos. Este ERP não consulta a Tray.
          O cadastro do Mercos não traz geolocalização; o local no estoque é o campo informado aqui.
        </p>
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
        <h3>Histórico do produto</h3>
        <p className="erp-muted">Pedidos em que o produto entrou e movimentos da gestão de estoque.</p>
        {history.isLoading && <StatePanel kind="loading" />}
        {history.error && <StatePanel kind="error" message={(history.error as Error).message} onRetry={() => void history.refetch()} />}
        {history.data && (
          <>
            <h4>Pedidos</h4>
            {history.data.orders.length === 0 ? (
              <StatePanel kind="empty" message="Nenhum pedido com este produto." />
            ) : (
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead><tr><th>Pedido</th><th>Data</th><th>Situação</th><th className="num">Quantidade</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {history.data.orders.map((order) => (
                      <tr key={`${order.orderId}-${order.issuedAt ?? ""}`}>
                        <td><Link to={`/erp/pedidos/${encodeURIComponent(order.orderId)}`}>{order.number ?? order.orderId}</Link></td>
                        <td>{formatDay(order.issuedAt)}</td>
                        <td>{order.status ?? "—"}</td>
                        <td className="num">{formatQuantity(order.quantity)}</td>
                        <td className="num">{formatMoney(order.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <h4>Gestão de estoque</h4>
            {history.data.movements.length === 0 ? (
              <StatePanel kind="empty" message="Nenhum movimento de estoque para este produto." />
            ) : (
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead><tr><th>Quando</th><th>Tipo</th><th className="num">Quantidade</th><th>Motivo</th></tr></thead>
                  <tbody>
                    {history.data.movements.map((movement) => (
                      <tr key={movement.id}>
                        <td>{formatInstant(movement.occurredAt)}</td>
                        <td>{movement.kind}</td>
                        <td className="num">{formatQuantity(movement.quantityDelta)}</td>
                        <td>{movement.reason ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
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
