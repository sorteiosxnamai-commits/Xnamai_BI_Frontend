import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/client";
import { MetadataStatus, QueryState } from "../components/feedback/QueryState";
import type {
  ComparisonPeriod,
  PriceSavingsCustomer,
  PriceSavingsTier,
} from "../types/analytics";

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
    return "os 45 dias anteriores ao Club";
  }
  return `${formatBrDate(comparison.previousFrom)} a ${formatBrDate(comparison.previousTo)}`;
}

function formatPct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${number.format(value)}%`;
}

function CustomerTable({ rows }: { rows: PriceSavingsCustomer[] }) {
  if (rows.length === 0) {
    return <QueryState loading={false} error={null} empty />;
  }
  return (
    <div className="data-table-wrap">
      <table className="data-table order-history">
        <thead>
          <tr>
            <th>#</th>
            <th>Cliente</th>
            <th>Pedidos</th>
            <th>Antes</th>
            <th>Agora</th>
            <th>Desconto</th>
            <th>%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((customer, index) => (
            <tr key={customer.id || `${customer.name}-${index}`}>
              <td>{customer.rank ?? index + 1}</td>
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
  );
}

function TierCards({
  tiers,
  openKey,
  onToggle,
}: {
  tiers: PriceSavingsTier[];
  openKey: string | null;
  onToggle: (key: string) => void;
}) {
  return (
    <section className="metric-grid cohorts" aria-label="Faixas de clientes com desconto">
      {tiers.map((tier) => {
        const expanded = openKey === tier.key;
        return (
          <article key={tier.key} className={tier.key === "rest" ? "rest" : undefined}>
            <button
              type="button"
              className="cohort-toggle"
              aria-expanded={expanded}
              onClick={() => onToggle(tier.key)}
            >
              <span>
                {tier.label}
                <em>
                  {tier.count.toLocaleString("pt-BR")} cliente
                  {tier.count === 1 ? "" : "s"}
                  {tier.count
                    ? ` · ${tier.rankFrom}º ao ${tier.rankTo}º`
                    : ""}
                </em>
              </span>
              <strong>{formatPct(tier.savingsPct)}</strong>
              <b className="cohort-total">{money.format(tier.savings)}</b>
              <dl>
                <div>
                  <dt>Fatia da economia</dt>
                  <dd>{formatPct(tier.savingsSharePct)}</dd>
                </div>
                <div>
                  <dt>Queda média da faixa</dt>
                  <dd>{formatPct(tier.avgDropPct)}</dd>
                </div>
                <div>
                  <dt>Antes → agora</dt>
                  <dd>
                    {money.format(tier.previousTotal)} → {money.format(tier.currentTotal)}
                  </dd>
                </div>
                <div>
                  <dt>Pedidos</dt>
                  <dd>{tier.orderCount.toLocaleString("pt-BR")}</dd>
                </div>
              </dl>
              <small>{expanded ? "Recolher lista" : "Ver clientes da faixa"}</small>
            </button>
          </article>
        );
      })}
    </section>
  );
}

export function CustomViewsPage() {
  const [openTier, setOpenTier] = useState<string>("top10");
  const query = useQuery({
    queryKey: ["analytics", "price-savings", "club"],
    queryFn: () => analyticsApi.priceSavings(),
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

  const {
    summary,
    products,
    matchedOrders,
    customers,
    customerTiers = [],
    productTiers = [],
    dropBuckets = [],
    weekly = [],
    comparison,
    metadata,
  } = query.data;
  const periodText = comparisonLabel(comparison);
  const currentDays = summary.currentWindowDays ?? 45;
  const previousDays = summary.previousWindowDays ?? 45;
  const currentPeriod =
    comparison?.currentFrom && comparison?.currentTo
      ? `${formatBrDate(comparison.currentFrom)} a ${formatBrDate(comparison.currentTo)}`
      : `últimos ${currentDays} dias`;
  const selectedTier = customerTiers.find((tier) => tier.key === openTier) ?? customerTiers[0];
  const headlineDrop =
    summary.qtyWeightedDropPct ?? summary.simpleAvgDropPct ?? summary.matchedSavingsPct;
  const valueDrop = summary.valueWeightedDropPct ?? summary.matchedSavingsPct;

  return (
    <div className="page-stack">
      <MetadataStatus metadata={metadata} />
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Comparativo de economia do Club</h2>
            <p>
              Janela fixa dos últimos {currentDays} dias — quando os preços
              passaram a cair de verdade — contra o preço médio pago nos{" "}
              {previousDays} dias anteriores. Entra só SKU que já era vendido
              antes e baixou agora. Mix novo, preço de tabela e o restante do
              pedido ficam fora da porcentagem. Preço antigo: {periodText}.
              Pedidos atuais: {currentPeriod}.
            </p>
          </div>
        </div>
        <section className="metric-grid">
          <article className="metric-card">
            <span>Queda média dos preços</span>
            <strong>{formatPct(headlineDrop)}</strong>
            <small className="positive">ponderada pelas unidades vendidas</small>
            <p>
              Média da queda unitária de cada SKU, pesada pela quantidade
              vendida no Club. É o “os preços caíram X%”, sem inflar com item
              caro nem com SKU de 1 peça.
            </p>
          </article>
          <article className="metric-card">
            <span>Mediana da queda</span>
            <strong>{formatPct(summary.medianDropPct)}</strong>
            <small>metade dos SKUs caiu pelo menos isso</small>
            <p>
              Menos sensível a poucos produtos extremos. Se a média e a mediana
              se afastam, a queda está concentrada em parte do mix.
            </p>
          </article>
          <article className="metric-card">
            <span>Média simples por SKU</span>
            <strong>{formatPct(summary.simpleAvgDropPct)}</strong>
            <small>cada produto vale 1, sem peso de volume</small>
            <p>
              Útil para ver o desconto típico do catálogo. Diferente da média
              ponderada quando o volume está nos SKUs que caíram menos.
            </p>
          </article>
          <article className="metric-card">
            <span>Impacto no faturamento</span>
            <strong>{formatPct(summary.billImpactPct)}</strong>
            <small className="positive">
              economia {money.format(summary.matchedSavings)}
            </small>
            <p>
              Quanto o Club tirou da conta inteira dos últimos {currentDays}{" "}
              dias, incluindo itens que não baixaram e mix novo.
            </p>
          </article>
          <article className="metric-card">
            <span>Desconto só nos itens que baixaram</span>
            <strong>{formatPct(valueDrop)}</strong>
            <small>
              {money.format(summary.previousDroppedTotal ?? 0)} →{" "}
              {money.format(summary.currentDroppedTotal ?? 0)}
            </small>
            <p>
              Economia ÷ o que esses mesmos itens teriam custado no preço antigo.
              Não é a queda média dos preços: SKUs caros puxam mais.
            </p>
          </article>
        </section>
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Como o mix se comporta no Club</h2>
            <p>
              {summary.currentOrderCount?.toLocaleString("pt-BR") ?? "—"} pedidos
              no período atual, {money.format(summary.currentRevenue ?? 0)} de
              faturamento. A porcentagem de queda só vale para a fatia que já
              existia e barateou.
            </p>
          </div>
        </div>
        <section className="metric-grid compact">
          <article className="metric-card">
            <span>Itens que baixaram</span>
            <strong>{money.format(summary.droppedSkuRevenue ?? 0)}</strong>
            <p>
              {formatPct(summary.droppedSkuRevenueSharePct)} do faturamento
              atual · {summary.droppedProductCount.toLocaleString("pt-BR")} SKUs
              · {summary.currentOrdersWithDroppedProducts.toLocaleString("pt-BR")}{" "}
              pedidos
            </p>
          </article>
          <article className="metric-card">
            <span>Itens que não caíram</span>
            <strong>{money.format(summary.unchangedSkuRevenue ?? 0)}</strong>
            <p>SKU com histórico anterior, mas preço pago estável ou maior.</p>
          </article>
          <article className="metric-card">
            <span>Mix novo do Club</span>
            <strong>{money.format(summary.newSkuRevenue ?? 0)}</strong>
            <p>Sem preço pago antes da queda. Não entra na % de desconto.</p>
          </article>
          <article className="metric-card">
            <span>Queda média por cliente</span>
            <strong>{formatPct(summary.customerAvgDropPct)}</strong>
            <p>
              Mediana {formatPct(summary.customerMedianDropPct)} ·{" "}
              {summary.customersWithSavings.toLocaleString("pt-BR")} clientes com
              item descontado
            </p>
          </article>
        </section>
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Clientes: Top 10, 20, 50 e restantes</h2>
            <p>
              Faixas exclusivas pela economia nos itens que baixaram. Top 10
              concentra {formatPct(summary.top10CustomerSavingsSharePct)}; Top 20
              acumula {formatPct(summary.top20CustomerSavingsSharePct)}; Top 50
              acumula {formatPct(summary.top50CustomerSavingsSharePct)}. A % de
              cada faixa é economia ÷ preço antigo só desses clientes.
            </p>
          </div>
        </div>
        {customerTiers.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
          <>
            <TierCards
              tiers={customerTiers}
              openKey={openTier}
              onToggle={(key) => setOpenTier((current) => (current === key ? "" : key))}
            />
            {selectedTier && openTier ? (
              <section className="cohort-members-panel" aria-label={`Clientes ${selectedTier.label}`}>
                <h3>
                  {selectedTier.label}: {selectedTier.count.toLocaleString("pt-BR")}{" "}
                  cliente{selectedTier.count === 1 ? "" : "s"}
                  {selectedTier.truncated
                    ? ` · mostrando ${selectedTier.members.length}`
                    : ""}
                </h3>
                <CustomerTable rows={selectedTier.members} />
              </section>
            ) : null}
          </>
        )}
      </article>

      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Concentração da economia nos SKUs</h2>
            <p>
              Top 10 produtos geram {formatPct(summary.top10ProductSavingsSharePct)}{" "}
              da economia; Top 20 {formatPct(summary.top20ProductSavingsSharePct)};
              Top 50 {formatPct(summary.top50ProductSavingsSharePct)}.
            </p>
          </div>
        </div>
        <section className="metric-grid compact">
          {productTiers.map((tier) => (
            <article key={tier.key} className="metric-card">
              <span>{tier.label}</span>
              <strong>{formatPct(tier.savingsSharePct)}</strong>
              <small className="positive">{money.format(tier.savings)}</small>
              <p>
                {tier.count.toLocaleString("pt-BR")} SKUs · queda média{" "}
                {formatPct(tier.avgDropPct)} · {formatPct(tier.savingsPct)} no
                valor
              </p>
            </article>
          ))}
        </section>
      </article>

      <article className="module-card table-module">
        <div className="module-heading">
          <div>
            <h2>Queda semana a semana</h2>
            <p>
              Mesma regra de SKU com histórico, fatiada por semana do pedido
              atual. Serve para ver se o desconto está acelerando depois que os
              preços começaram a cair.
            </p>
          </div>
        </div>
        {weekly.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table order-history">
              <thead>
                <tr>
                  <th>Semana</th>
                  <th>Pedidos</th>
                  <th>SKUs</th>
                  <th>Antes</th>
                  <th>Agora</th>
                  <th>Economia</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((row) => (
                  <tr key={row.week}>
                    <td>
                      {formatBrDate(row.from)} a {formatBrDate(row.to)}
                    </td>
                    <td>{row.orders.toLocaleString("pt-BR")}</td>
                    <td>{row.skuCount.toLocaleString("pt-BR")}</td>
                    <td>{money.format(row.previousTotal)}</td>
                    <td>{money.format(row.currentTotal)}</td>
                    <td>{money.format(row.savings)}</td>
                    <td>{formatPct(row.dropPct)}</td>
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
            <h2>Distribuição da queda por SKU</h2>
            <p>
              Quantos produtos caíram em cada faixa de %. A média macro esconde
              se a maior parte do mix caiu 8% ou 30%.
            </p>
          </div>
        </div>
        {dropBuckets.length === 0 ? (
          <QueryState loading={false} error={null} empty />
        ) : (
          <div className="data-table-wrap">
            <table className="data-table order-history">
              <thead>
                <tr>
                  <th>Faixa de queda</th>
                  <th>SKUs</th>
                  <th>Quantidade</th>
                  <th>Economia</th>
                  <th>% média da faixa</th>
                  <th>Fatia da economia</th>
                </tr>
              </thead>
              <tbody>
                {dropBuckets.map((row) => (
                  <tr key={row.bucket}>
                    <td>{row.bucket}</td>
                    <td>{row.skuCount.toLocaleString("pt-BR")}</td>
                    <td>{number.format(row.quantity)}</td>
                    <td>{money.format(row.savings)}</td>
                    <td>{formatPct(row.dropPct)}</td>
                    <td>{formatPct(row.savingsSharePct)}</td>
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
            <h2>Produtos que baixaram de preço</h2>
            <p>
              Preço médio unitário pago nos {previousDays} dias anteriores versus
              o preço atual só das linhas que baixaram.{" "}
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
              pago nos {previousDays} dias anteriores e caíram.
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

      {customers.length > 0 && customerTiers.length === 0 ? (
        <article className="module-card table-module">
          <div className="module-heading">
            <div>
              <h2>Clientes que mais economizaram</h2>
            </div>
          </div>
          <CustomerTable rows={customers} />
        </article>
      ) : null}
    </div>
  );
}
