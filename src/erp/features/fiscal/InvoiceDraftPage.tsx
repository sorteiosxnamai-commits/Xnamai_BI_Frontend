import { type FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import {
  type InvoiceDraft,
  invoiceDraftSchema,
  invoiceListSchema,
  orderDetailSchema,
  orderHistorySchema,
} from "../../api/schemas";
import { useErp } from "../../auth/context";
import { Pill } from "../../components/Pill";
import { StatePanel } from "../../components/StatePanel";
import { CommandError } from "../../components/ui";
import { formatDay, formatInstant, formatMoney, formatQuantity } from "../../format";
import { invoiceSpec, paymentSpec, StatePill } from "../orders/orderUi";

const KIND_LABEL: Record<string, string> = {
  removed: "Removido do pedido",
  quantity_changed: "Quantidade alterada",
  price_changed: "Valor alterado",
  added: "Item novo",
};

function parseQuantity(text: string): string | null {
  const raw = text.trim().replace(",", ".");
  if (!/^[0-9]+([.][0-9]{1,4})?$/.test(raw)) return null;
  return raw;
}

function CreateDraft({ orderId, onCreated }: { orderId: string; onCreated: () => void }) {
  const { can } = useErp();
  const command = useCommand<Record<string, unknown>, InvoiceDraft>(invoiceDraftSchema);
  const [percent, setPercent] = useState("");
  const [organize, setOrganize] = useState(true);
  const [local, setLocal] = useState<string | null>(null);
  if (!can("invoices:write")) {
    return <p className="erp-muted">Seu perfil só consulta rascunhos fiscais; criar exige permissão fiscal.</p>;
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal(null);
    const value = percent.trim().replace(",", ".");
    if (!/^[0-9]+([.][0-9]{1,4})?$/.test(value) || Number(value) <= 0 || Number(value) > 100) {
      return setLocal("Informe um percentual maior que 0 e até 100.");
    }
    try {
      await command.mutateAsync({
        path: `/sales-orders/${encodeURIComponent(orderId)}/invoice-drafts`,
        idempotent: true,
        body: { percent: value, organize },
      });
      onCreated();
    } catch {
      /* erro em CommandError */
    }
  }
  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label="Novo rascunho de nota fiscal">
      <h3 className="erp-wide">Criar montagem da nota</h3>
      <label className="erp-field">
        <span>Percentual da nota (%)</span>
        <input inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} />
      </label>
      <label className="erp-field">
        <span>
          <input type="checkbox" checked={organize} onChange={(e) => setOrganize(e.target.checked)} /> Organizar itens
          automaticamente
        </span>
      </label>
      <CommandError error={command.error} local={local} />
      <div className="erp-form-actions erp-wide">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>
          Criar rascunho
        </button>
      </div>
    </form>
  );
}

function Editor({ draft, onChanged }: { draft: InvoiceDraft; onChanged: () => void }) {
  const { can } = useErp();
  const save = useCommand<Record<string, unknown>, InvoiceDraft>(invoiceDraftSchema);
  const organize = useCommand<Record<string, unknown>, InvoiceDraft>(invoiceDraftSchema);
  const cancel = useCommand<Record<string, unknown>, InvoiceDraft>(invoiceDraftSchema);
  const [percent, setPercent] = useState(draft.percent);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [manual, setManual] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const writable = can("invoices:write") && draft.status === "draft";


  const dirtyItems = useMemo(
    () => draft.items.filter((i) => quantities[i.sourceKey] !== undefined && quantities[i.sourceKey] !== i.quantity),
    [draft.items, quantities],
  );

  async function saveAssembly(acknowledgeReview = false) {
    setLocal(null);
    const items = [];
    for (const item of dirtyItems) {
      const parsed = parseQuantity(quantities[item.sourceKey]);
      if (parsed === null) return setLocal(`Quantidade inválida em "${item.name ?? item.sourceKey}".`);
      if (Number(parsed) > Number(item.available)) {
        return setLocal(`"${item.name ?? item.sourceKey}": máximo disponível ${formatQuantity(item.available)}.`);
      }
      items.push({ sourceKey: item.sourceKey, quantity: parsed });
    }
    const percentValue = percent.trim().replace(",", ".");
    if (!/^[0-9]+([.][0-9]{1,4})?$/.test(percentValue) || Number(percentValue) <= 0 || Number(percentValue) > 100) {
      return setLocal("Percentual inválido: use um valor maior que 0 e até 100.");
    }
    try {
      await save.mutateAsync({
        path: `/invoice-drafts/${draft.id}`,
        method: "PATCH",
        idempotent: true,
        body: {
          expectedVersion: draft.version,
          percent: percentValue !== draft.percent ? percentValue : undefined,
          items: items.length ? items : undefined,
          acknowledgeReview,
        },
      });
      onChanged();
    } catch {
      /* erro em CommandError */
    }
  }

  async function organizeNow() {
    setLocal(null);
    try {
      await organize.mutateAsync({
        path: `/invoice-drafts/${draft.id}/organize`,
        idempotent: true,
        body: { expectedVersion: draft.version },
      });
      onChanged();
    } catch {
      /* erro em CommandError */
    }
  }

  async function cancelDraft() {
    setLocal(null);
    if (reason.trim().length < 3) return setLocal("Informe o motivo do cancelamento (mínimo 3 caracteres).");
    try {
      await cancel.mutateAsync({
        path: `/invoice-drafts/${draft.id}/cancel`,
        idempotent: true,
        body: { expectedVersion: draft.version, reason: reason.trim() },
      });
      onChanged();
    } catch {
      /* erro em CommandError */
    }
  }

  const achieved = Number(draft.effective.achievedOfTarget ?? 0);
  const diff = Number(draft.difference.value ?? 0);
  const readOnly = !writable || draft.review.required;
  return (
    <>
      <section className="erp-card erp-form" aria-label="Configuração da nota">
        <h3 className="erp-wide">Configuração da nota</h3>
        <label className="erp-field">
          <span>Percentual da nota (%)</span>
          <input inputMode="decimal" value={percent} disabled={readOnly} onChange={(e) => setPercent(e.target.value)} />
          <small className="erp-muted">Define o alvo de planejamento; o valor efetivo vem dos itens.</small>
        </label>
        <div className="erp-figure">
          <span className="erp-muted">Valor total do pedido</span>
          <strong>{formatMoney(draft.orderTotal)}</strong>
        </div>
        <div className="erp-figure">
          <span className="erp-muted">Valor alvo da nota ({draft.target.percent}%)</span>
          <strong>{formatMoney(draft.target.value)}</strong>
        </div>
        {writable && (
          <div className="erp-form-actions erp-wide">
            <button type="button" className="erp-btn erp-btn-primary" disabled={readOnly || organize.isPending} onClick={() => void organizeNow()}>
              Organizar itens automaticamente
            </button>
            <button type="button" className="erp-btn" aria-pressed={manual} disabled={draft.review.required} onClick={() => setManual((v) => !v)}>
              Ajustar manualmente
            </button>
          </div>
        )}
        <p className="erp-muted erp-wide">{draft.organizeNote}</p>
      </section>

      <section className="erp-card" aria-label="Itens do pedido">
        <h3>Itens do pedido</h3>
        <div className="erp-ops-grid">
          <div>
            <span className="erp-muted">Itens na nota</span>
            <strong>
              {draft.counts.included} de {draft.counts.total}
            </strong>
          </div>
          <div>
            <span className="erp-muted">Valor já alocado</span>
            <strong>{formatMoney(draft.effective.value)}</strong>
          </div>
          <div>
            <span className="erp-muted">Diferença para a meta</span>
            <strong className={diff < 0 ? "erp-negative" : undefined}>
              {diff > 0 ? "+" : ""}
              {formatMoney(draft.difference.value)}
            </strong>
            <small className="erp-muted">
              {draft.effective.percentOfOrder ? `${draft.effective.percentOfOrder.replace(".", ",")}% do pedido` : "—"}
            </small>
          </div>
          <div>
            <span className="erp-muted">Atingido da meta</span>
            <strong>{draft.effective.achievedOfTarget ? `${draft.effective.achievedOfTarget.replace(".", ",")}%` : "—"}</strong>
            <progress max={100} value={Math.min(achieved, 100)} aria-label="Percentual da meta atingido" />
          </div>
        </div>
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th scope="col">Produto</th>
                <th scope="col">SKU</th>
                <th scope="col" className="num">Qtd. total</th>
                <th scope="col" className="num">Disponível</th>
                <th scope="col" className="num">Valor unitário</th>
                <th scope="col" className="num">Valor total</th>
                <th scope="col" className="num">Qtd. na nota</th>
                <th scope="col" className="num">Valor na nota</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {draft.items.map((item) => {
                const edited = quantities[item.sourceKey];
                return (
                  <tr key={item.sourceKey}>
                    <td>{item.name ?? "—"}</td>
                    <td>{item.code ?? "—"}</td>
                    <td className="num">{formatQuantity(item.sourceQuantity)}</td>
                    <td className="num">{formatQuantity(item.available)}</td>
                    <td className="num">{formatMoney(item.unitValue)}</td>
                    <td className="num">{formatMoney(item.sourceLineTotal)}</td>
                    <td className="num">
                      {manual && writable && !draft.review.required ? (
                        <input
                          className="erp-qty-input"
                          inputMode="decimal"
                          aria-label={`Quantidade na nota de ${item.name ?? item.sourceKey}`}
                          value={edited ?? item.quantity}
                          onChange={(e) => setQuantities((c) => ({ ...c, [item.sourceKey]: e.target.value }))}
                        />
                      ) : (
                        formatQuantity(item.quantity)
                      )}
                    </td>
                    <td className="num">{formatMoney(item.lineValue)}</td>
                    <td>
                      {item.status === "removed_at_source" ? (
                        <Pill tone="bad">Removido na origem</Pill>
                      ) : item.included ? (
                        <Pill tone="ok">Incluído na nota</Pill>
                      ) : (
                        <Pill tone="neutral">Fora desta nota</Pill>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <CommandError error={save.error ?? organize.error ?? cancel.error} local={local} />
        {writable && (
          <div className="erp-form-actions">
            <button type="button" className="erp-btn erp-btn-primary" disabled={save.isPending || draft.review.required} onClick={() => void saveAssembly()}>
              Salvar montagem da nota
            </button>
            <button type="button" className="erp-btn" disabled aria-describedby="issue-why">
              Emitir nota fiscal
            </button>
            <small id="issue-why" className="erp-muted">
              Indisponível: {draft.issuance.reason}
            </small>
          </div>
        )}
        <p className="erp-muted">{draft.statement}</p>
      </section>

      {draft.review.required && (
        <section className="erp-card erp-alert" role="alert" aria-label="Revisão necessária">
          <h3>Revisão necessária: o pedido mudou na origem</h3>
          <p>{draft.review.note}</p>
          {draft.review.changes.length === 0 ? (
            <p className="erp-muted">O pedido foi atualizado, mas nenhum item mudou. Confirme para alinhar o rascunho.</p>
          ) : (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th scope="col">Produto</th>
                    <th scope="col">O que mudou</th>
                    <th scope="col">Antes</th>
                    <th scope="col">Depois</th>
                    <th scope="col" className="num">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {draft.review.changes.map((change) => (
                    <tr key={`${change.sourceKey}-${change.kind}`}>
                      <td>{change.name ?? change.sourceKey}</td>
                      <td>{KIND_LABEL[change.kind] ?? change.kind}</td>
                      <td>{change.before ? Object.values(change.before).filter(Boolean).join(" · ") : "—"}</td>
                      <td>{change.after ? Object.values(change.after).filter(Boolean).join(" · ") : "—"}</td>
                      <td className="num">{change.valueDifference ? formatMoney(change.valueDifference) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {writable && (
            <button type="button" className="erp-btn erp-btn-primary" disabled={save.isPending} onClick={() => void saveAssembly(true)}>
              Aplicar revisão e alinhar ao pedido
            </button>
          )}
        </section>
      )}

      {writable && (
        <section className="erp-card erp-form" aria-label="Cancelar rascunho">
          <h3 className="erp-wide">Cancelar este rascunho</h3>
          <label className="erp-field erp-wide">
            <span>Motivo</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="erp-form-actions erp-wide">
            <button type="button" className="erp-btn" disabled={cancel.isPending} onClick={() => void cancelDraft()}>
              Cancelar rascunho e liberar itens
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export function InvoiceDraftPage() {
  const { id = "" } = useParams();
  const enc = encodeURIComponent(id);
  const invalidate = useInvalidateErp();
  const order = useErpQuery(["order", id], `/sales-orders/${enc}`, orderDetailSchema);
  const drafts = useErpQuery(["invoice-drafts", id], `/sales-orders/${enc}/invoice-drafts`, invoiceListSchema);
  const history = useErpQuery(["order-history", id], `/sales-orders/${enc}/history`, orderHistorySchema);
  const [selected, setSelected] = useState<number | null>(null);

  function refresh() {
    void invalidate("invoice-drafts", id);
    void invalidate("order", id);
    void invalidate("order-history", id);
    void invalidate("orders");
  }

  if (order.isLoading || drafts.isLoading) return <StatePanel kind="loading" />;
  const error = order.error ?? drafts.error;
  if (error) {
    return <StatePanel kind="error" message={(error as Error).message} onRetry={() => { void order.refetch(); void drafts.refetch(); }} />;
  }
  const o = order.data;
  const list = drafts.data;
  if (!o || !list) return null;
  const active = list.items.filter((d) => d.status === "draft");
  const current = active.find((d) => d.id === selected) ?? active[0] ?? list.items[0];
  const events = (history.data?.items ?? []).filter((e) => e.action.startsWith("invoice."));

  return (
    <>
      <nav className="erp-crumb" aria-label="Você está em">
        <Link to="/erp/notas-fiscais">Nota Fiscal</Link>
        <span aria-hidden="true"> › </span>Montagem da Nota
      </nav>
      <div className="erp-pagehead">
        <div>
          <h1>Montagem da Nota Fiscal</h1>
          <p>Defina o percentual e organize os itens do pedido. Salvar a montagem não emite nota fiscal.</p>
        </div>
        <div className="erp-pagehead-actions">
          <Link className="erp-btn" to={`/erp/pedidos/${enc}`}>← Voltar para o pedido</Link>
        </div>
      </div>
      <section className="erp-card erp-order-strip" aria-label="Pedido">
        <h2>
          Pedido #{o.number ?? o.id} <StatePill spec={invoiceSpec(o.operational?.invoice)} />
        </h2>
        <dl className="erp-strip-grid">
          <div><dt>Cliente</dt><dd>{o.customerName ?? o.customerId ?? "—"}</dd></div>
          <div><dt>Data do pedido</dt><dd>{formatDay(o.issueDate)}</dd></div>
          <div><dt>Total de itens</dt><dd>{o.itemCount ?? "—"}</dd></div>
          <div><dt>Valor total do pedido</dt><dd>{formatMoney(o.netTotal)}</dd></div>
          <div><dt>Status de pagamento</dt><dd><StatePill spec={paymentSpec(o.operational?.payment)} /></dd></div>
          <div><dt>Status da nota fiscal</dt><dd><Pill tone="neutral">Não emitida</Pill></dd></div>
        </dl>
      </section>
      <div className="erp-notice" role="status">
        <strong>Emissão fiscal indisponível</strong>
        <span>{list.issuance.reason}</span>
      </div>
      {active.length > 1 && (
        <label className="erp-select-field">
          Rascunho
          <select value={current?.id ?? ""} onChange={(e) => setSelected(Number(e.target.value))}>
            {active.map((d) => (
              <option key={d.id} value={d.id}>
                Rascunho #{d.id} · {d.target.percent}%
              </option>
            ))}
          </select>
        </label>
      )}
      {current && current.status === "draft" ? (
        <Editor key={`${current.id}-${current.version}`} draft={current} onChanged={refresh} />
      ) : (
        <>
          {current && (
            <StatePanel kind="unavailable" title="Rascunho cancelado" message={`${current.cancelReason ?? ""}`.trim() || undefined} />
          )}
          <CreateDraft orderId={id} onCreated={refresh} />
        </>
      )}
      {current && current.status === "draft" && (
        <details className="erp-card">
          <summary>Criar outro documento para este pedido</summary>
          <CreateDraft orderId={id} onCreated={refresh} />
        </details>
      )}
      <section className="erp-card" aria-label="Resumo da atualização">
        <h3>Histórico fiscal do pedido</h3>
        {events.length === 0 ? (
          <p className="erp-muted">Nenhuma ação fiscal registrada.</p>
        ) : (
          <ol className="erp-timeline">
            {events.map((e) => (
              <li key={`${e.at}-${e.action}`}>
                <strong>{e.action.replace("invoice.", "")}</strong>
                <span>
                  {formatInstant(e.at)} · por {e.operator}
                  {e.reason ? ` · ${e.reason}` : ""}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}
