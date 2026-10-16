import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/client";
import { MetadataStatus, QueryState } from "../components/feedback/QueryState";
import type { AnalyticsFilters, CartMetric, CartStage } from "../types/analytics";
import "./b2b-carts.css";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
export const CART_LABELS: Record<CartStage, string> = {
  open: "Em aberto recente / sem data", possible_abandonment: "Possível abandono",
  converted: "Convertido em pedido", completed_quote: "B2B concluído como orçamento",
  cancelled: "Cancelado", other: "Situação a verificar",
};

function Metric({ label, metric, hint }: { label: string; metric: CartMetric; hint: string }) {
  return <article className="metric-card"><span>{label}</span>
    <strong>{number.format(metric.count)}</strong><small>{money.format(metric.value)}</small><p>{hint}</p></article>;
}

export function B2bCartsPage({ filters }: { filters: AnalyticsFilters }) {
  const [hours, setHours] = useState(24);
  const [stage, setStage] = useState<CartStage | "all">("all");
  const [pagination, setPagination] = useState({ key: "", page: 1 });
  const cohortKey = JSON.stringify([filters, hours, stage]);
  const page = pagination.key === cohortKey ? pagination.page : 1;
  const query = useQuery({ queryKey: ["analytics", "b2b-carts", filters, hours, page, stage],
    queryFn: () => analyticsApi.b2bCarts(filters, hours, page, stage) });
  const data = query.data;
  const date = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Não informada";

  return <div className="page-stack b2b-carts">
    <section className="module-card">
      <div className="module-heading"><div><h2>Carrinhos e conversão B2B</h2>
        <p>Registros identificados no Mercos, agrupados pela data de criação. Valores e situações atuais.</p></div>
        <button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Atualizar</button></div>
      <div className="cart-controls">
        <label>Possível abandono após<select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
          <option value={6}>6 horas sem alteração</option><option value={24}>24 horas sem alteração</option>
          <option value={48}>48 horas sem alteração</option><option value={168}>7 dias sem alteração</option>
        </select></label>
        <label>Situação da listagem<select value={stage} onChange={(e) => setStage(e.target.value as CartStage | "all")}>
          <option value="all">Todas</option>{Object.entries(CART_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
      </div>
    </section>
    <QueryState loading={query.isLoading} error={query.error as Error | null} onRetry={() => void query.refetch()} />
    {data && <>
      <MetadataStatus metadata={data.metadata} />
      <section className="metric-grid">
        <Metric label="Carrinhos B2B identificados" metric={data.summary.identified} hint="Registros recebidos pela API; cobertura de todas as adições ainda não validada." />
        <Metric label="Convertidos em pedidos" metric={data.summary.converted} hint="B2B concluído e status de pedido válido. Não confirma pagamento." />
        <Metric label="Em aberto (total)" metric={data.summary.openTotal} hint="Inclui os possíveis abandonos abaixo." />
        <Metric label="Possíveis abandonos" metric={data.summary.possible_abandonment} hint={`Orçamentos em aberto sem alteração há ${hours} horas ou mais.`} />
        <article className="metric-card"><span>Taxa de conversão dos identificados</span><strong>{data.summary.conversionRate === null ? "Sem base" : `${number.format(data.summary.conversionRate)}%`}</strong>
          <p>Pedidos convertidos ÷ todos os registros B2B identificados no período, incluindo cancelados.</p></article>
      </section>
      <section className="module-card">
        <div className="module-heading"><div><h2>Valores em comparação</h2><p>Diferença entre grupos; não representa receita perdida nem mudança do valor de um mesmo carrinho.</p></div></div>
        <div className="cart-value-grid">
          <div><span>Possíveis abandonos</span><strong>{money.format(data.summary.possible_abandonment.value)}</strong></div>
          <div><span>Convertidos em pedidos</span><strong>{money.format(data.summary.converted.value)}</strong></div>
          <div><span>Abandonos possíveis − convertidos</span><strong>{money.format(data.summary.abandonedMinusConvertedValue)}</strong></div>
        </div>
        <p>B2B concluído como orçamento: {number.format(data.summary.completed_quote.count)} · {money.format(data.summary.completed_quote.value)}.
          {" "}Cancelados: {number.format(data.summary.cancelled.count)} · {money.format(data.summary.cancelled.value)}.
          {" "}Situação a verificar: {number.format(data.summary.other.count)} · {money.format(data.summary.other.value)}.</p>
      </section>
      <section className="module-card">
        <div className="module-heading"><div><h2>Detalhamento dos carrinhos</h2><p>{number.format(data.totalItems)} registros na situação selecionada. Filtros de produto selecionam o carrinho inteiro.</p></div></div>
        {data.items.length === 0 ? <p role="status">Nenhum registro B2B encontrado nesta seleção. Isso não comprova ausência de carrinhos no Mercos.</p> :
          <div className="cart-table-scroll"><table><thead><tr><th>Registro</th><th>Cliente</th><th>Vendedor</th><th>Situação</th><th>Criação</th><th>Última alteração</th><th>Valor atual</th></tr></thead>
            <tbody>{data.items.map((item) => <tr key={item.id}>
              <td>{item.number}</td>
              <td>{item.customerName || "Não identificado"}</td><td>{item.sellerName || "Não identificado"}</td>
              <td>{CART_LABELS[item.stage]}</td><td>{date(item.createdAt)}</td><td>{date(item.updatedAt)}</td><td>{money.format(item.total)}</td>
            </tr>)}</tbody></table></div>}
        <div className="cart-pagination"><button type="button" disabled={page <= 1 || query.isFetching} onClick={() => setPagination({ key: cohortKey, page: page - 1 })}>Anterior</button>
          <span>Página {page} de {Math.max(1, data.totalPages)}</span>
          <button type="button" disabled={page >= data.totalPages || query.isFetching} onClick={() => setPagination({ key: cohortKey, page: page + 1 })}>Próxima</button></div>
      </section>
    </>}
  </div>;
}
