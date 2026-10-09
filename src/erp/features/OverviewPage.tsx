import { Link } from "react-router-dom";
import { buildQuery } from "../api/client";
import { useErpQuery } from "../api/hooks";
import { operationalSummarySchema, overviewSchema } from "../api/schemas";
import { StatePanel } from "../components/StatePanel";
import { Badge, PageHeader } from "../components/ui";
import { formatInstant, formatMoney } from "../format";
import { periodLabel, useScope } from "../scope";

const OPERATION_LABELS: [string, string][] = [
  ["queued", "Na fila"],
  ["processing", "Processando"],
  ["waiting_rate_limit", "Aguardando limite"],
  ["unknown", "Resultado em verificação"],
  ["conflict", "Em conflito"],
  ["failed", "Falharam"],
  ["succeeded", "Aceitas"],
];

/**
 * Visão operacional: dado indisponível nunca vira zero. Os números abaixo são
 * do espelho ERP e das filas, não KPIs do BI e não são saldo financeiro.
 */
function OrdersSummary() {
  const { from, to } = useScope();
  const params = { dateFrom: from, dateTo: to };
  const summary = useErpQuery(
    ["overview-orders", params],
    `/operational-summary${buildQuery(params)}`,
    operationalSummarySchema,
    { keepPrevious: true },
  );
  const s = summary.data;
  if (summary.isLoading) return <StatePanel kind="loading" />;
  if (summary.error || !s) {
    return (
      <StatePanel
        kind="error"
        title="Resumo de pedidos indisponível"
        message={(summary.error as Error | null)?.message}
        onRetry={() => void summary.refetch()}
      />
    );
  }
  return (
    <section aria-label="Resumo de pedidos">
      <div className="erp-kpis">
        <div className="erp-kpi erp-kpi-ok">
          <span className="erp-kpi-title">Pedidos · {periodLabel(from, to)}</span>
          <strong>{s.orders.count}</strong>
          <small>
            {s.variation.available
              ? `${s.variation.percent?.replace(".", ",")}% vs. período anterior`
              : `Variação indisponível: ${s.variation.reason ?? "sem base de comparação"}`}
          </small>
        </div>
        <div className="erp-kpi erp-kpi-info">
          <span className="erp-kpi-title">Valor vendido (líquido)</span>
          <strong>{formatMoney(s.values.net)}</strong>
          <small>{s.values.note}</small>
        </div>
        <div className="erp-kpi erp-kpi-purple">
          <span className="erp-kpi-title">Atualizações pendentes</span>
          <strong>{s.pendencies.any}</strong>
          <small>
            {s.pendencies.itemsIncomplete} sem itens · {s.pendencies.customerMissing} sem cliente
          </small>
        </div>
        <div className="erp-kpi">
          <span className="erp-kpi-title">Cobertura da importação</span>
          <strong className={s.coverage.complete ? undefined : "erp-kpi-unavailable"}>
            {s.coverage.complete ? "Completa" : "Parcial"}
          </strong>
          <small>{s.coverage.note ?? "Pedidos e clientes sincronizados."}</small>
        </div>
      </div>
    </section>
  );
}

export function OverviewPage() {
  const query = useErpQuery(["overview"], "/overview", overviewSchema, {
    refetchInterval: 30_000,
  });
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;
  const attention = (data.operations.unknown ?? 0) + (data.operations.failed ?? 0) + data.openConflicts;
  const neverSynced = data.resources.filter((r) => r.status === "never").length;

  return (
    <>
      <PageHeader
        title="Visão Geral"
        subtitle="Pedidos no período, estado do espelho Mercos, das operações de escrita e das pendências que pedem decisão."
      />
      <OrdersSummary />
      <div className="erp-card">
        <p className="erp-muted">
          Fonte: {data.source} · gerado em {formatInstant(data.generatedAt)} ·{" "}
          {data.dataThrough
            ? `dados completos até ${formatInstant(data.dataThrough)}`
            : "ainda não há sincronização completa dos 12 recursos (data de corte indisponível)"}
        </p>
      </div>
      <div className="erp-grid">
        <div className="erp-metric">
          <span>Recursos sincronizados</span>
          <strong>
            {data.resources.length - neverSynced} / {data.resources.length}
          </strong>
          <small>{neverSynced ? `${neverSynced} nunca sincronizado(s)` : "todos já sincronizaram ao menos uma vez"}</small>
        </div>
        <div className="erp-metric">
          <span>Pendências que pedem atenção</span>
          <strong>{attention}</strong>
          <small>
            {data.operations.unknown ?? 0} em verificação · {data.operations.failed ?? 0} falhas ·{" "}
            {data.openConflicts} conflitos
          </small>
        </div>
        <div className="erp-metric">
          <span>Referências pendentes</span>
          <strong>{data.pendingReferences.reduce((sum, item) => sum + item.pending, 0)}</strong>
          <small>IDs recebidos cujo alvo ainda não chegou (nada é fabricado)</small>
        </div>
      </div>
      {attention > 0 && (
        <div className="erp-notice">
          <strong>Há operações aguardando decisão</strong>
          <span>
            Resultados em verificação e conflitos nunca são reenviados automaticamente.{" "}
            <Link to="/erp/integracoes?aba=operacoes">Abrir Integrações</Link>
          </span>
        </div>
      )}
      <section className="erp-card" aria-label="Recursos do Mercos">
        <h3>Sincronização por recurso</h3>
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th scope="col">Recurso</th>
                <th scope="col">Situação</th>
                <th scope="col" className="num">Registros locais</th>
                <th scope="col">Dados até</th>
                <th scope="col">Último sucesso</th>
                <th scope="col" className="num">Pendentes</th>
              </tr>
            </thead>
            <tbody>
              {data.resources.map((resource) => (
                <tr key={resource.resource}>
                  <td>
                    {resource.label}
                    {resource.error && <div className="erp-muted">{resource.error}</div>}
                  </td>
                  <td>
                    <Badge value={resource.status} />
                  </td>
                  <td className="num">{resource.records === null ? "indisponível" : resource.records}</td>
                  <td>{formatInstant(resource.dataThrough)}</td>
                  <td>{formatInstant(resource.lastSuccessAt)}</td>
                  <td className="num">{resource.unresolved ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="erp-card" aria-label="Operações de escrita">
        <h3>Operações de escrita no Mercos</h3>
        <div className="erp-grid">
          {OPERATION_LABELS.map(([key, label]) => (
            <div className="erp-metric" key={key}>
              <span>{label}</span>
              <strong>{data.operations[key] ?? 0}</strong>
            </div>
          ))}
        </div>
      </section>
      {data.pendingReferences.length > 0 && (
        <section className="erp-card" aria-label="Referências pendentes">
          <h3>Referências pendentes</h3>
          <ul>
            {data.pendingReferences.map((item) => (
              <li key={`${item.resource}.${item.field}`}>
                {item.pending} em <code>{item.resource}.{item.field}</code> aguardando <code>{item.target}</code>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
