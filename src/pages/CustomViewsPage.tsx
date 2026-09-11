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
            <h2>Comparativo de economia</h2>
            <p>
              Destaca produtos que baixaram de preço e pedidos do mesmo cliente com o
              mesmo mix de itens, comparando o período atual com {periodText}. Os
              valores usam totais Mercos (pedido e item), não preço de tabela.
            </p>
          </div>
        </div>
        <section className="metric-grid">
          <article className="metric-card">
            <span>Economia nos mesmos pedidos</span>
            <strong>{money.format(summary.matchedSavings)}</strong>
            <small className="positive">
              {summary.matchedPairCount.toLocaleString("pt-BR")} pares com o mesmo mix
            </small>
            <p>
              Diferença entre o total Mercos anterior e o atual quando o cliente
              repetiu exatamente os mesmos itens e quantidades.
            </p>
          </article>
          <article className="metric-card">
            <span>Economia média nos mesmos pedidos</span>
            <strong>{formatPct(summary.matchedSavingsPct)}</strong>
            <small className="positive">vs. o valor pago antes</small>
            <p>
              Percentual economizado sobre o total dos pedidos anteriores
              pareados.
            </p>
          </article>
          <article className="metric-card">
            <span>Economia nas compras atuais</span>
            <strong>{money.format(summary.productSavings)}</strong>
            <small className="positive">{formatPct(summary.productSavingsPct)} vs. preço anterior</small>
            <p>
              Se os SKUs que baixaram fossem cobrados pelo preço médio do período
              anterior, este é o valor que os clientes deixaram de pagar agora.
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
              período atual versus o recorte anterior.
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
            <h2>Pedidos com os mesmos itens</h2>
            <p>
              Um pedido atual pareado com o pedido anterior do mesmo cliente
              quando o mix (SKU + quantidade) é idêntico e o total agora ficou
              menor.
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
                  <th>Pedido anterior</th>
                  <th>Total anterior</th>
                  <th>Pedido atual</th>
                  <th>Total atual</th>
                  <th>Economia</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {matchedOrders.map((row) => (
                  <tr key={`${row.previousOrderId}-${row.currentOrderId}`}>
                    <td>{row.customerName}</td>
                    <td>
                      {row.previousNumber}
                      <br />
                      <small>{formatDateTime(row.previousIssuedAt)}</small>
                    </td>
                    <td>{money.format(row.previousTotal)}</td>
                    <td>
                      {row.currentNumber}
                      <br />
                      <small>{formatDateTime(row.currentIssuedAt)}</small>
                    </td>
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
            <p>Soma da economia nos pares de pedidos com o mesmo mix de itens.</p>
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
                  <th>Pares</th>
                  <th>Total anterior</th>
                  <th>Total atual</th>
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
