import { useParams } from "react-router-dom";
import { useErp } from "../../auth/context";
import { useErpQuery } from "../../api/hooks";
import { productDetailSchema, productPricesSchema } from "../../api/schemas";
import { StatePanel } from "../../components/StatePanel";
import { Badge, CapabilityNotice, Dl, PageHeader } from "../../components/ui";
import { formatInstant, formatMoney, formatQuantity } from "../../format";

export function ProductDetailPage() {
  const { id = "" } = useParams();
  const { capability } = useErp();
  const query = useErpQuery(["product", id], `/products/${encodeURIComponent(id)}`, productDetailSchema);
  const prices = useErpQuery(["product", id, "prices"], `/products/${encodeURIComponent(id)}/prices`, productPricesSchema);

  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const p = query.data;
  if (!p) return null;

  const activeBadge =
    p.active === false ? <Badge value="cancelled" label="Inativo" /> : <Badge value="active" label="Ativo" />;

  return (
    <>
      <PageHeader
        title={p.name}
        subtitle={`Produto ${p.id}${p.code ? ` · código ${p.code}` : ""} · origem atualizada em ${formatInstant(p.sourceUpdatedAt)}`}
      />
      <CapabilityNotice capability={capability("write.products")} />
      {p.kind === "aggregator" && (
        <div className="erp-notice">
          <strong>Agregador de grade</strong>
          <span>Este item agrupa variações e não é um SKU vendável por si só (classificação a validar com payload real da conta).</span>
        </div>
      )}
      <section className="erp-card">
        <h3>Dados comerciais</h3>
        <Dl
          items={[
            ["Unidade", p.unit],
            ["Categoria", p.categoryId],
            ["Tipo", p.kind === "aggregator" ? "Agregador" : "SKU vendável"],
            ["Preço de tabela", formatMoney(p.listPrice)],
            ["Preço mínimo", formatMoney(p.minimumPrice)],
            ["Saldo externo (Mercos)", formatQuantity(p.externalStock)],
            ["Comissão (%)", formatQuantity(p.commissionPercent)],
            ["IPI (%)", formatQuantity(p.ipiPercent)],
            ["NCM", p.ncm],
            ["Múltiplo", formatQuantity(p.multiple)],
            ["Custo", "desconhecido — não é inferido do preço de tabela"],
            ["Situação", activeBadge],
          ]}
        />
      </section>
      <section className="erp-card">
        <h3>Logística</h3>
        <Dl
          items={[
            ["Peso bruto", formatQuantity(p.grossWeight)],
            ["Largura", formatQuantity(p.width)],
            ["Altura", formatQuantity(p.height)],
            ["Comprimento", formatQuantity(p.length)],
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
        {p.variants.length === 0 ? (
          <StatePanel kind="empty" message="Sem variantes recebidas da origem." />
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead><tr><th>Código</th><th>Nome</th><th className="num">Saldo externo</th><th className="num">Preço</th></tr></thead>
              <tbody>
                {p.variants.map((v, index) => (
                  <tr key={v.id ?? index}>
                    <td>{v.code ?? "—"}</td>
                    <td>{v.name ?? "—"}</td>
                    <td className="num">{formatQuantity(v.externalStock)}</td>
                    <td className="num">{formatMoney(v.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="erp-card">
        <h3>Imagens</h3>
        {p.imageHashes && p.imageHashes.length > 0 ? (
          <>
            <p className="erp-muted">
              A origem devolve apenas hashes SHA-512, não links. Nenhuma URL é fabricada a partir do hash;
              a exibição depende de uma fonte de imagem autorizada.
            </p>
            <ul>{p.imageHashes.map((hash) => <li key={hash}><code>{hash.slice(0, 24)}…</code></li>)}</ul>
          </>
        ) : (
          <StatePanel kind="unavailable" message="Imagens indisponíveis: a capacidade read.product_images depende de extensão do Adaptor." />
        )}
      </section>
      {p.notes && (
        <section className="erp-card">
          <h3>Observações</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{p.notes}</p>
        </section>
      )}
    </>
  );
}
