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
              Entra na conta só o SKU que já tinha preço pago nos 60 dias
              anteriores ao período atual e baixou agora. Itens novos do Club,
              preço de tabela e o restante do pedido ficam de fora do desconto e
              da porcentagem. Preço antigo: {periodText}.
            </p>
          </div>
        </div>
        <section className="metric-grid">
          <article className="metric-card">
            <span>Desconto nos itens que baixaram</span>
            <strong>{money.format(summary.matchedSavings)}</strong>
            <small className="positive">
              {summary.matchedPairCount.toLocaleString("pt-BR")} pedidos com esses
              SKUs
            </small>
            <p>
              Soma de (preço antigo − preço atual) × quantidade, só nos itens que
              já existiam nos 60 dias anteriores e ficaram mais baratos.
            </p>
          </article>
          <article className="metric-card">
            <span>Desconto médio</span>
            <strong>{formatPct(summary.matchedSavingsPct)}</strong>
            <small className="positive">sobre o preço anterior desses itens</small>
            <p>
              Economia ÷ o que esses mesmos itens teriam custado no preço pago dos
              60 dias anteriores. O mix novo do Club não entra.
            </p>
          </article>
          <article className="metric-card">
            <span>Esses itens no preço antigo</span>
            <strong>
              {money.format(summary.previousDroppedTotal ?? summary.matchedSavings)}
            </strong>
            <small className="positive">
              agora {money.format(summary.currentDroppedTotal ?? 0)}
            </small>
            <p>
              Se os SKUs que baixaram fossem cobrados pelo preço médio pago em{" "}
              {periodText}, este seria o valor. A porcentagem do Club é economia ÷
              este valor.
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
              Todos os SKUs do período atual cujo preço pago caiu frente aos 60
              dias anteriores. A lista abaixo traz o conjunto completo.
            </p>
          </article>
        </section>
      </article>

      <article className="module-card table-module">
        <div className="module-heading">
          <div>
            <h2>Produtos que baixaram de preço</h2>
            <p>
              Preço médio unitário pago nos 60 dias anteriores versus o preço
              atual só das linhas que baixaram.{" "}
              {summary.droppedProductCount > products.length
                ? `Exibindo os ${products.length} de ${summary.droppedProductCount.toLocaleString("pt-BR")} com maior economia.`
                : `Lista completa: ${products.length.toLocaleString("pt-BR")} SKUs.`}
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
            <h2>Pedidos com itens que baixaram</h2>
            <p>
              Antes e depois consideram só os SKUs do pedido que já tinham preço
              pago nos 60 dias anteriores e caíram. O restante do pedido não entra
              na porcentagem.
              {summary.matchedPairCount > matchedOrders.length
                ? ` Exibindo os ${matchedOrders.length} de ${summary.matchedPairCount.toLocaleString("pt-BR")} com maior desconto.`
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
                  <th>Itens que baixaram</th>
                  <th>Antes</th>
                  <th>Agora</th>
                  <th>Desconto</th>
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
              Soma do desconto só nos itens que tinham preço anterior e baixaram.
              Pedidos só com mix novo do Club não entram.
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
                  <th>Antes</th>
                  <th>Agora</th>
                  <th>Desconto</th>
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
