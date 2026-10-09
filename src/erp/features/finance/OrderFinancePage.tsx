import { type FormEvent, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import {
  accountSchema,
  type OrderFinance,
  orderFinanceSchema,
  orderHistorySchema,
  type Refund,
  refundSchema,
  simpleListSchema,
} from "../../api/schemas";
import { useErp } from "../../auth/context";
import { Pill } from "../../components/Pill";
import { StatePanel } from "../../components/StatePanel";
import { CommandError } from "../../components/ui";
import { formatDay, formatInstant, formatMoney, parseMoneyInput } from "../../format";
import { SettleForm } from "./FinancePage";
import { FINANCE_STATE } from "./financeUi";

const accounts = simpleListSchema(accountSchema);

function CreateReceivable({ orderId, total, onDone }: { orderId: string; total: string | null | undefined; onDone: () => void }) {
  const command = useCommand<Record<string, unknown>, OrderFinance>(orderFinanceSchema);
  const [due, setDue] = useState("");
  const [installments, setInstallments] = useState("1");
  const [amount, setAmount] = useState("");
  const [acknowledge, setAcknowledge] = useState(false);
  const [local, setLocal] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return setLocal("Informe a data do primeiro vencimento.");
    const parcels = Number(installments);
    if (!Number.isInteger(parcels) || parcels < 1 || parcels > 60) return setLocal("Parcelas: de 1 a 60.");
    let value: string | undefined;
    if (amount.trim()) {
      const parsed = parseMoneyInput(amount);
      if (parsed === null || Number(parsed) <= 0) return setLocal("Valor do título inválido.");
      value = parsed;
    }
    try {
      await command.mutateAsync({
        path: `/sales-orders/${encodeURIComponent(orderId)}/receivable`,
        idempotent: true,
        body: { firstDueDate: due, installments: parcels, amount: value, acknowledgeExternalTitle: acknowledge },
      });
      onDone();
    } catch {
      /* o erro aparece em CommandError (inclui a confirmação do título Mercos) */
    }
  }
  const externalConflict = command.error && /título no Mercos/i.test(command.error.message);
  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label="Criar título a receber do pedido">
      <h3 className="erp-wide">Criar título a receber deste pedido</h3>
      <label className="erp-field"><span>Primeiro vencimento</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <label className="erp-field"><span>Parcelas</span><input inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} /></label>
      <label className="erp-field">
        <span>Valor (R$)</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Padrão: valor do pedido (${formatMoney(total)})`} />
      </label>
      {externalConflict && (
        <label className="erp-field erp-wide">
          <span>
            <input type="checkbox" checked={acknowledge} onChange={(e) => setAcknowledge(e.target.checked)} /> Sei que o
            Mercos já tem título deste pedido e quero criar o local mesmo assim (o relatório contará só o local)
          </span>
        </label>
      )}
      <CommandError error={command.error} local={local} />
      <div className="erp-form-actions erp-wide">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>Criar título</button>
      </div>
    </form>
  );
}

function RefundForm({ orderId, payment, onDone }: { orderId: string; payment: OrderFinance["payments"][number]; onDone: () => void }) {
  const command = useCommand<Record<string, unknown>, Refund>(refundSchema);
  const [amount, setAmount] = useState(payment.refundable ?? "");
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal(null);
    const parsed = parseMoneyInput(amount);
    if (parsed === null || Number(parsed) <= 0) return setLocal("Informe um valor de reembolso válido.");
    if (Number(parsed) > Number(payment.refundable)) return setLocal(`Acima do reembolsável (${formatMoney(payment.refundable)}).`);
    if (reason.trim().length < 3) return setLocal("Informe o motivo (mínimo 3 caracteres).");
    try {
      await command.mutateAsync({
        path: "/refund-requests",
        idempotent: true,
        body: { orderId, settlementId: payment.settlementId, amount: parsed, reason: reason.trim() },
      });
      onDone();
    } catch {
      /* erro em CommandError */
    }
  }
  return (
    <form className="erp-form" onSubmit={submit} aria-label={`Solicitar reembolso da baixa ${payment.settlementId}`}>
      <label className="erp-field"><span>Valor a reembolsar (R$)</span><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      <label className="erp-field erp-wide"><span>Motivo</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      <p className="erp-muted erp-wide">
        Solicitar não altera a baixa e não devolve dinheiro: a solicitação segue para aprovação.
      </p>
      <CommandError error={command.error} local={local} />
      <div className="erp-form-actions erp-wide">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>Enviar solicitação</button>
        <button type="button" className="erp-btn" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

export function OrderFinancePage() {
  const { id = "" } = useParams();
  const enc = encodeURIComponent(id);
  const { can } = useErp();
  const invalidate = useInvalidateErp();
  const finance = useErpQuery(["order-finance", id], `/sales-orders/${enc}/finance`, orderFinanceSchema);
  const accountList = useErpQuery(["fin-accounts"], "/finance/accounts", accounts, { enabled: can("finance:settle") });
  const history = useErpQuery(["order-history", id], `/sales-orders/${enc}/history`, orderHistorySchema);
  const [settling, setSettling] = useState<number | null>(null);
  const [refunding, setRefunding] = useState<number | null>(null);

  function refresh() {
    setSettling(null);
    setRefunding(null);
    void invalidate("order-finance", id);
    void invalidate("order-history", id);
    void invalidate("orders");
    void invalidate("finance-summary");
  }

  if (finance.isLoading) return <StatePanel kind="loading" />;
  if (finance.error) {
    return <StatePanel kind="error" message={(finance.error as Error).message} onRetry={() => void finance.refetch()} />;
  }
  const f = finance.data;
  if (!f) return null;
  const state = FINANCE_STATE[f.state] ?? FINANCE_STATE.unavailable;
  const events = (history.data?.items ?? []).filter((e) => e.action.startsWith("finance.") || e.action.startsWith("refund."));

  return (
    <>
      <nav className="erp-crumb" aria-label="Você está em">
        <Link to="/erp/financeiro">Financeiro</Link>
        <span aria-hidden="true"> › </span>Pedido {id}
      </nav>
      <div className="erp-pagehead">
        <div>
          <h1>Financeiro do pedido #{id}</h1>
          <p>Obrigação, parcelas e baixas ligadas a este pedido. O financeiro local é separado do pagamento espelhado do Mercos.</p>
        </div>
        <div className="erp-pagehead-actions">
          <Link className="erp-btn" to={`/erp/pedidos/${enc}`}>← Voltar para o pedido</Link>
        </div>
      </div>
      <section className="erp-kpis" aria-label="Resumo financeiro do pedido">
        <div className="erp-kpi erp-kpi-info"><span className="erp-kpi-title">Valor do pedido</span><strong>{formatMoney(f.orderTotal)}</strong></div>
        <div className="erp-kpi erp-kpi-warn"><span className="erp-kpi-title">Obrigação local</span><strong>{formatMoney(f.obligation)}</strong></div>
        <div className="erp-kpi erp-kpi-ok"><span className="erp-kpi-title">Recebido</span><strong>{formatMoney(f.paid)}</strong></div>
        <div className="erp-kpi">
          <span className="erp-kpi-title">Situação</span>
          <strong><Pill tone={state.tone}>{state.label}</Pill></strong>
          {f.overdue && <small className="erp-negative">Há parcela vencida</small>}
        </div>
      </section>
      {f.externalTitles.length > 0 && (
        <div className="erp-notice" role="status">
          <strong>Título do Mercos neste pedido</strong>
          <span>
            {f.externalTitles.map((t) => `${t.id} (${formatMoney(t.amount)})`).join(", ")}. {f.externalNote}
          </span>
        </div>
      )}
      {f.titles.length === 0 && can("finance:write") && <CreateReceivable orderId={id} total={f.orderTotal} onDone={refresh} />}
      {f.titles.length === 0 && !can("finance:write") && <StatePanel kind="empty" title="Sem título local" message="Este pedido ainda não tem título a receber no ERP." />}
      {f.titles.map((title) => (
        <section className="erp-card" key={title.id} aria-label={`Título ${title.id}`}>
          <h3>
            Título #{title.id} · {formatMoney(title.total)} <Pill tone={title.status === "cancelled" ? "bad" : "neutral"}>{title.status}</Pill>
          </h3>
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr><th scope="col">Parcela</th><th scope="col">Vencimento</th><th scope="col" className="num">Valor</th><th scope="col" className="num">Baixado</th><th scope="col">Situação</th><th scope="col"><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody>
                {title.installments.map((i) => {
                  const open = String(Number(i.amount) - Number(i.settledAmount));
                  return (
                    <tr key={i.id}>
                      <td>{i.number}</td>
                      <td>{formatDay(i.dueDate)} {i.overdue && <Pill tone="bad">Vencida</Pill>}</td>
                      <td className="num">{formatMoney(i.amount)}</td>
                      <td className="num">{formatMoney(i.settledAmount)}</td>
                      <td>{i.status}</td>
                      <td>
                        {can("finance:settle") && title.status !== "cancelled" && Number(open) > 0 && (
                          <button type="button" className="erp-btn" onClick={() => setSettling(settling === i.id ? null : i.id)}>
                            Registrar pagamento
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {settling !== null && title.installments.some((i) => i.id === settling) && (
            <SettleForm
              installmentId={settling}
              open={String(
                Number(title.installments.find((i) => i.id === settling)?.amount ?? 0) -
                  Number(title.installments.find((i) => i.id === settling)?.settledAmount ?? 0),
              )}
              accountsList={accountList.data?.items ?? []}
              onDone={refresh}
            />
          )}
        </section>
      ))}
      <section className="erp-card" aria-label="Pagamentos do pedido">
        <h3>Pagamentos registrados (baixas locais)</h3>
        {f.payments.length === 0 ? (
          <p className="erp-muted">Nenhuma baixa registrada. Pix e pagamentos do Mercos não aparecem aqui: {f.pix.reason}</p>
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr><th scope="col">Baixa</th><th scope="col">Data</th><th scope="col" className="num">Valor</th><th scope="col">Operador</th><th scope="col" className="num">Reembolsável</th><th scope="col"><span className="sr-only">Ações</span></th></tr>
              </thead>
              <tbody>
                {f.payments.map((p) => (
                  <tr key={p.settlementId}>
                    <td>#{p.settlementId} {p.reversed && <Pill tone="bad">Estornada</Pill>}</td>
                    <td>{formatInstant(p.settledAt)}</td>
                    <td className="num">{formatMoney(p.amount)}</td>
                    <td>{p.operator}</td>
                    <td className="num">{formatMoney(p.refundable)}</td>
                    <td>
                      {can("refunds:request") && Number(p.refundable) > 0 && (
                        <button type="button" className="erp-btn" onClick={() => setRefunding(refunding === p.settlementId ? null : p.settlementId)}>
                          Solicitar reembolso
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {refunding !== null && f.payments.find((p) => p.settlementId === refunding) && (
          <RefundForm orderId={id} payment={f.payments.find((p) => p.settlementId === refunding) as OrderFinance["payments"][number]} onDone={refresh} />
        )}
      </section>
      <section className="erp-card" aria-label="Histórico financeiro do pedido">
        <h3>Histórico financeiro</h3>
        {events.length === 0 ? (
          <p className="erp-muted">Nenhuma ação financeira registrada neste pedido.</p>
        ) : (
          <ol className="erp-timeline">
            {events.map((e) => (
              <li key={`${e.at}-${e.action}`}>
                <strong>{e.action}</strong>
                <span>{formatInstant(e.at)} · por {e.operator}{e.reason ? ` · ${e.reason}` : ""}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
