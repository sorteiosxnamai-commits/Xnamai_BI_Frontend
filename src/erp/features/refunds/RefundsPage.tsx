import { useState } from "react";
import { Link } from "react-router-dom";
import type { ZodType } from "zod";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import { type Page, pageOf, type Refund, refundSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { Icon } from "../../components/icons";
import { OrderPicker } from "../../components/OrderPicker";
import { Pill, type PillTone } from "../../components/Pill";
import { type Column, ServerList } from "../../components/ServerList";
import { StatePanel } from "../../components/StatePanel";
import { CommandError } from "../../components/ui";
import { formatInstant, formatMoney } from "../../format";

const schema = pageOf(refundSchema) as unknown as ZodType<Page<Refund>>;

const STATUS: Record<string, { tone: PillTone; label: string }> = {
  requested: { tone: "info", label: "Solicitado" },
  approved: { tone: "warn", label: "Aprovado · devolução pendente" },
  rejected: { tone: "bad", label: "Rejeitado" },
  cancelled: { tone: "neutral", label: "Cancelado" },
  external_confirmed: { tone: "ok", label: "Devolução confirmada (manual)" },
  reversed_local: { tone: "ok", label: "Estorno local aplicado" },
};

export function RefundStatus({ status }: { status: string }) {
  const spec = STATUS[status] ?? { tone: "neutral" as PillTone, label: status };
  return <Pill tone={spec.tone}>{spec.label}</Pill>;
}

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const { can, me } = useErp();
  const invalidate = useInvalidateErp();
  const query = useErpQuery(["refund", id], `/refund-requests/${id}`, refundSchema);
  const command = useCommand<Record<string, unknown>, Refund>(refundSchema);
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [confirmReversal, setConfirmReversal] = useState(false);

  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const r = query.data;
  if (!r) return null;

  async function act(action: string, body: Record<string, unknown>) {
    setLocal(null);
    try {
      await command.mutateAsync({ path: `/refund-requests/${id}/${action}`, idempotent: true, body: { expectedVersion: r?.version, ...body } });
      setConfirmReversal(false);
      setNote("");
      setReference("");
      void invalidate("refund", id);
      void invalidate("refunds");
      void invalidate("order-finance");
    } catch {
      /* erro em CommandError */
    }
  }
  function needText(value: string, label: string): boolean {
    if (value.trim().length >= 3) return true;
    setLocal(`${label} (mínimo 3 caracteres).`);
    return false;
  }

  const canDecide = can("refunds:approve");
  const owner = r.requestedBy === me.username;
  return (
    <section className="erp-card" aria-label={`Solicitação ${r.id}`}>
      <header className="erp-split-head">
        <h3>
          Solicitação #{r.id} · pedido {r.orderId} <RefundStatus status={r.status} />
        </h3>
        <button type="button" className="erp-btn" onClick={onClose}>Fechar</button>
      </header>
      <dl className="erp-strip-grid">
        <div><dt>Valor</dt><dd>{formatMoney(r.amount)}</dd></div>
        <div><dt>Baixa de origem</dt><dd>#{r.settlementId}</dd></div>
        <div><dt>Solicitado por</dt><dd>{r.requestedBy}</dd></div>
        <div><dt>Em</dt><dd>{formatInstant(r.requestedAt)}</dd></div>
        <div><dt>Decidido por</dt><dd>{r.decidedBy ?? "—"}</dd></div>
        <div><dt>Referência externa</dt><dd>{r.externalReference ?? "—"}</dd></div>
      </dl>
      <p><strong>Motivo:</strong> {r.reason}</p>
      <div className="erp-notice" role="status">
        <strong>O que este estado significa</strong>
        <span>{r.statement}</span>
      </div>
      <h4>Histórico</h4>
      <ol className="erp-timeline">
        {(r.events ?? []).map((e) => (
          <li key={`${e.at}-${e.action}`}>
            <strong>{e.action}</strong>
            <span>{formatInstant(e.at)} · por {e.operator}{e.reason ? ` · ${e.reason}` : ""}</span>
          </li>
        ))}
      </ol>
      <CommandError error={command.error} local={local} />
      {r.status === "requested" && (
        <div className="erp-form">
          <label className="erp-field erp-wide">
            <span>Observação / motivo da decisão</span>
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="erp-form-actions erp-wide">
            {canDecide && (
              <button type="button" className="erp-btn erp-btn-primary" disabled={command.isPending} onClick={() => void act("approve", { note: note.trim() || undefined })}>
                Aprovar solicitação
              </button>
            )}
            {canDecide && (
              <button type="button" className="erp-btn" disabled={command.isPending} onClick={() => needText(note, "Informe o motivo da rejeição") && void act("reject", { reason: note.trim() })}>
                Rejeitar
              </button>
            )}
            {(owner || canDecide) && can("refunds:request") && (
              <button type="button" className="erp-btn" disabled={command.isPending} onClick={() => needText(note, "Informe o motivo do cancelamento") && void act("cancel", { reason: note.trim() })}>
                Cancelar solicitação
              </button>
            )}
          </div>
        </div>
      )}
      {r.status === "approved" && canDecide && (
        <div className="erp-form">
          <label className="erp-field">
            <span>Referência da devolução feita fora do sistema</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ex.: comprovante, TED, id no PSP" />
          </label>
          <div className="erp-form-actions erp-wide">
            <button type="button" className="erp-btn erp-btn-primary" disabled={command.isPending} onClick={() => needText(reference, "Informe a referência da devolução") && void act("confirm-external", { reference: reference.trim() })}>
              Confirmar devolução externa (manual)
            </button>
            {can("finance:settle") &&
              (confirmReversal ? (
                <>
                  <span className="erp-negative">Isto estorna a baixa inteira no financeiro local.</span>
                  <button type="button" className="erp-btn erp-btn-primary" disabled={command.isPending} onClick={() => void act("apply-local-reversal", {})}>
                    Confirmar estorno local
                  </button>
                  <button type="button" className="erp-btn" onClick={() => setConfirmReversal(false)}>Voltar</button>
                </>
              ) : (
                <button type="button" className="erp-btn" onClick={() => setConfirmReversal(true)}>Aplicar estorno local…</button>
              ))}
            {(owner || canDecide) && can("refunds:request") && (
              <button type="button" className="erp-btn" disabled={command.isPending} onClick={() => needText(note || reference, "Informe o motivo do cancelamento") && void act("cancel", { reason: (note || reference).trim() })}>
                Cancelar solicitação
              </button>
            )}
          </div>
          <p className="erp-muted erp-wide">
            O estorno local é integral e só vale para reembolso do valor total da baixa; reembolso parcial segue pela
            confirmação da devolução externa. Nenhuma destas ações devolve dinheiro por conta própria.
          </p>
        </div>
      )}
    </section>
  );
}

export function RefundsPage() {
  const { can } = useErp();
  const [status, setStatus] = useState("");
  const [orderId, setOrderId] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const columns: Column<Refund>[] = [
    { key: "id", header: "ID", sortKey: "requestedAt", render: (r) => <strong>#SR-{String(r.id).padStart(4, "0")}</strong> },
    { key: "order", header: "Pedido", render: (r) => <Link to={`/erp/pedidos/${encodeURIComponent(r.orderId)}`} onClick={(e) => e.stopPropagation()}>#{r.orderId}</Link> },
    { key: "amount", header: "Valor", sortKey: "amount", render: (r) => formatMoney(r.amount) },
    { key: "status", header: "Situação", render: (r) => <RefundStatus status={r.status} /> },
    { key: "by", header: "Solicitado por", render: (r) => r.requestedBy },
    { key: "at", header: "Data", render: (r) => formatInstant(r.requestedAt) },
    { key: "reason", header: "Motivo", render: (r) => r.reason },
  ];
  return (
    <>
      <div className="erp-pagehead">
        <div>
          <h1>Reembolsos</h1>
          <p>
            Solicitações internas de reembolso. Solicitar ou aprovar não devolve dinheiro: a devolução externa depende
            de banco, PSP ou Mercos Pay e é confirmada manualmente.
          </p>
        </div>
        <div className="erp-pagehead-actions">
          {can("refunds:request") && (
            <button type="button" className="erp-btn erp-btn-primary" onClick={() => setPicking(true)}>
              <Icon name="plus" /> Nova solicitação
            </button>
          )}
        </div>
      </div>
      <section className="erp-filterbar" aria-label="Filtros de reembolsos">
        <label className="erp-select-field">
          Situação
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(STATUS).map(([value, spec]) => (
              <option key={value} value={value}>{spec.label}</option>
            ))}
          </select>
        </label>
        <label className="erp-search-field">
          <Icon name="search" />
          <input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ID do pedido" aria-label="Filtrar por ID do pedido" />
        </label>
      </section>
      {selected !== null && <Detail id={selected} onClose={() => setSelected(null)} />}
      <ServerList<Refund>
        resource="refunds"
        path="/refund-requests"
        schema={schema}
        caption="Solicitações de reembolso"
        columns={columns}
        fixedParams={{ status: status || undefined, orderId: orderId.trim() || undefined }}
        defaultSort="requestedAt"
        defaultOrder="desc"
        rowKey={(r) => r.id}
        onRowOpen={(r) => setSelected(r.id)}
        emptyMessage="Nenhuma solicitação de reembolso com os filtros atuais."
      />
      {picking && (
        <OrderPicker
          title="Nova solicitação de reembolso"
          target={(order) => `/erp/financeiro/pedidos/${encodeURIComponent(order.id)}`}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
