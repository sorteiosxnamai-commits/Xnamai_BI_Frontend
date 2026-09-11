import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/client";
import { MetadataStatus, QueryState } from "../components/feedback/QueryState";
import type { AnalyticsFilters, ComparisonPeriod } from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function formatBrDate(iso: string) {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function comparisonLabel(comparison?: ComparisonPeriod | null) {
  if (!comparison?.previousFrom || !comparison.previousTo) {
    return "mesmo recorte do mês anterior";
  }
  return `${formatBrDate(comparison.previousFrom)} a ${formatBrDate(comparison.previousTo)}`;
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${number.format(value)}%`;
}

export function CustomViewsPage({ filters }: { filters: AnalyticsFilters }) {
  const query = useQuery({
    queryKey: ["analytics", "price-savings", filters],
    queryFn: () => analyticsApi.priceSavings(filters),
  });

  if (query.isError || !query.data) {
    return (
      <QueryState
        loading={query.isLoading}
        error={query.error as Error | null}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { summary, products, matchedOrders, customers, comparison, metadata } = query.data;
  const periodText = comparisonLabel(comparison);

  return (
    <div className="page-stack">
      <MetadataStatus metadata={metadata} />
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Comparativo de economia do Club</h2>
            <p>
              Mostra o que o cliente pagaria antes do Club e o que pagou depois,
              só com preços Mercos realizados. Preço de tabela placeholder (R$
              1.000) e quedas irreais não entram na conta. A queda de SKU usa o
              recorte {periodText}.
            </p>
          </div>
        </div>
        <section className="metric-grid">
          <article className="metric-card">
            <span>Economia nos pedidos com desconto</span>
            <strong>{money.format(summary.matchedSavings)}</strong>
            <small className="positive">
              {summary.matchedPairCount.toLocaleString("pt-BR")} pedidos com itens
              descontados
            </small>
            <p>
              Diferença entre o valor Mercos antes do Club e o total pago no
              período atual, sem usar preço de tabela fictício.
            </p>
          </article>
          <article className="metric-card">
            <span>Economia média do Club</span>
            <strong>{formatPct(summary.matchedSavingsPct)}</strong>
            <small className="positive">vs. o valor antes do Club</small>
            <p>
              Percentual economizado sobre o valor que esses pedidos teriam
              custado antes do Club.
            </p>
          </article>
          <article className="metric-card">
            <span>Economia nas compras atuais</span>
            <strong>{money.format(summary.productSavings)}</strong>
            <small className="positive">
              {formatPct(summary.productSavingsPct)} vs. preço anterior
            </small>
            <p>
              Se os SKUs que baixaram fossem cobrados pelo preço médio de{" "}
              {periodText}, este é o valor que os clientes deixaram de pagar agora.
            </p>
          </article>
          <article className="metric-card">
            <span>Produtos com queda de preço</span>
            <strong>{summary.droppedProductCount.toLocaleString("pt-BR")}</strong>
            <small>
              {summary.currentOrdersWithDroppedProducts.toLocaleString("pt-BR")} pedidos
              atuais com esses SKUs
            </small>
            <p>
              SKUs cujo preço médio unitário Mercos caiu em relação a {periodText}.
            </p>
          </article>
        </section>
      </article>

      <article className="module-card table-module">
        <div className="module-heading">
          <div>
            <h2>Produtos que baixaram de preço</h2>
            <p>
              Preço médio unitário realizado (valor do item ÷ quantidade) no
              período atual versus {periodText}.
            </p>
          </div>
        </div>
        {products.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table order-history">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Preço anterior</th>
                  <th>Preço atual</th>
                  <th>Queda</th>
                  <th>%</th>
                  <th>Qtd. atual</th>
                  <th>Economia</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {product.code ? `${product.code} · ` : ""}
                      {product.name}
                    </td>
                    <td>{money.format(product.previousAverageUnit)}</td>
                    <td>{money.format(product.currentAverageUnit)}</td>
                    <td>{money.format(product.unitDrop)}</td>
                    <td>{formatPct(product.dropPct)}</td>
                    <td>{number.format(product.quantitySold)}</td>
                    <td>{money.format(product.savings)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="module-card table-module">
        <div className="module-heading">
          <div>
            <h2>Pedidos antes e depois do Club</h2>
            <p>
              Pedidos do período atual em que o SKU ficou mais barato no Mercos.
              Antes do Club é o preço médio pago no recorte anterior; depois do
              Club é o total Mercos pago. Tabela de R$ 1.000 e descontos acima de
              40% são ignorados.
              {summary.matchedPairCount > matchedOrders.length
                ? ` Exibindo os ${matchedOrders.length} de ${summary.matchedPairCount.toLocaleString("pt-BR")} com maior economia.`
                : ""}
            </p>
          </div>
        </div>
        {matchedOrders.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table order-history">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pedido</th>
                  <th>Itens com desconto</th>
                  <th>Antes do Club</th>
                  <th>Depois do Club</th>
                  <th>Economia</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {matchedOrders.map((row) => (
                  <tr key={row.currentOrderId}>
                    <td>{row.customerName}</td>
                    <td>
                      {row.currentNumber}
                      <br />
                      <small>{formatDateTime(row.currentIssuedAt)}</small>
                    </td>
                    <td>{row.skuCount.toLocaleString("pt-BR")}</td>
                    <td>{money.format(row.previousTotal)}</td>
                    <td>{money.format(row.currentTotal)}</td>
                    <td>{money.format(row.savings)}</td>
                    <td>{formatPct(row.savingsPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="module-card table-module">
        <div className="module-heading">
          <div>
            <h2>Clientes que mais economizaram</h2>
            <p>
              Soma da economia Club nos pedidos do período, mesmo quando o mix de
              itens não se repetiu.
            </p>
          </div>
        </div>
        {customers.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table order-history">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Pedidos</th>
                  <th>Antes do Club</th>
                  <th>Depois do Club</th>
                  <th>Economia</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.name}</td>
                    <td>{customer.matchedOrders.toLocaleString("pt-BR")}</td>
                    <td>{money.format(customer.previousTotal)}</td>
                    <td>{money.format(customer.currentTotal)}</td>
                    <td>{money.format(customer.savings)}</td>
                    <td>{formatPct(customer.savingsPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </div>
  );
}
