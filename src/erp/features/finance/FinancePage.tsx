import { useMemo, useState, type FormEvent } from "react";
import { z, type ZodType } from "zod";
import { useErp } from "../../auth/context";
import { buildQuery } from "../../api/client";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import {
  accountSchema,
  cashFlowSchema,
  finTitleSchema,
  pageOf,
  simpleListSchema,
  supplierSchema,
  type Customer,
  type FinTitle,
  type Page,
  type Supplier,
} from "../../api/schemas";
import { CustomerPicker } from "../../components/pickers";
import { ServerList, type Column } from "../../components/ServerList";
import { StatePanel } from "../../components/StatePanel";
import { Badge, FieldError, PageHeader, Tabs, CommandError, useFocusInvalid } from "../../components/ui";
import { formatDay, formatInstant, formatMoney, parseMoneyInput } from "../../format";

const titlePage = pageOf(finTitleSchema) as unknown as ZodType<Page<FinTitle>>;
const supplierPage = pageOf(supplierSchema) as unknown as ZodType<Page<Supplier>>;
const accounts = simpleListSchema(accountSchema);
const simpleRows = simpleListSchema(z.looseObject({ id: z.number(), code: z.string(), name: z.string(), kind: z.string().optional() }));

function Summary({ lines }: { lines: [string, string][] }) {
  return (
    <div className="erp-notice" role="alert">
      <strong>Confirme os valores e os efeitos</strong>
      {lines.map(([k, v]) => <span key={k}>{k}: <b>{v}</b></span>)}
    </div>
  );
}

function SettleForm({ installmentId, open, accountsList, onDone }: { installmentId: number; open: string; accountsList: { id: number; name: string }[]; onDone: () => void }) {
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(open);
  const [reference, setReference] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  const parsed = parseMoneyInput(amount);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!accountId) return setMessage("Escolha a conta financeira.");
    if (parsed === null || Number(parsed) <= 0) return setMessage("Valor inválido (use 1234,56).");
    if (Number(parsed) > Number(open)) return setMessage(`Baixa acima do valor em aberto (${formatMoney(open)}).`);
    setMessage("");
    if (!confirm) return setConfirm(true);
    void command
      .mutateAsync({ path: `/finance/installments/${installmentId}/settlements`, body: { accountId: Number(accountId), amount: parsed, reference: reference.trim() || null }, idempotent: true })
      .then(() => { void invalidate("fin-title"); void invalidate("fin-titles"); void invalidate("fin-accounts"); onDone(); })
      .catch(() => null);
  }
  return (
    <form className="erp-form" onSubmit={submit} aria-label="Baixar parcela">
      <label className="erp-field"><span>Conta</span>
        <select value={accountId} onChange={(e) => { setAccountId(e.target.value); setConfirm(false); }}>
          <option value="">Selecione</option>
          {accountsList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select></label>
      <label className="erp-field"><span>Valor</span><input inputMode="decimal" value={amount} onChange={(e) => { setAmount(e.target.value); setConfirm(false); }} /></label>
      <label className="erp-field"><span>Referência</span><input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
      {confirm && parsed && (
        <div className="erp-wide">
          <Summary lines={[["Valor da baixa", formatMoney(parsed)], ["Em aberto após a baixa", formatMoney(String(Number(open) - Number(parsed)))], ["Efeito", "reduz o saldo em aberto da parcela e movimenta a conta escolhida"]]} />
        </div>
      )}
      <CommandError error={command.error} local={message} />
      <div className="erp-form-actions">
        <button className="erp-btn erp-btn-primary" type="submit" disabled={command.isPending}>{confirm ? "Confirmar baixa" : "Baixar"}</button>
        <button className="erp-btn" type="button" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

function ReverseForm({ settlementId, amount, onDone }: { settlementId: number; amount: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  return (
    <form
      className="erp-form"
      aria-label="Estornar baixa"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length < 3) return;
        if (!confirm) return setConfirm(true);
        void command
          .mutateAsync({ path: `/finance/settlements/${settlementId}/reversals`, body: { reason: reason.trim() }, idempotent: true })
          .then(() => { void invalidate("fin-title"); void invalidate("fin-titles"); void invalidate("fin-accounts"); onDone(); })
          .catch(() => null);
      }}
    >
      <label className="erp-field erp-wide"><span>Motivo do estorno</span><input value={reason} onChange={(e) => { setReason(e.target.value); setConfirm(false); }} /></label>
      {confirm && <div className="erp-wide"><Summary lines={[["Valor estornado", formatMoney(amount)], ["Efeito", "reabre o valor na parcela; o histórico da baixa original é mantido"]]} /></div>}
      <CommandError error={command.error} />
      <div className="erp-form-actions">
        <button className="erp-btn erp-btn-danger" type="submit" disabled={reason.trim().length < 3 || command.isPending}>{confirm ? "Confirmar estorno" : "Estornar"}</button>
        <button className="erp-btn" type="button" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

function TitleDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { can } = useErp();
  const query = useErpQuery(["fin-title", id], `/finance/titles/${id}`, finTitleSchema);
  const accountList = useErpQuery(["fin-accounts"], "/finance/accounts", accounts);
  const [settling, setSettling] = useState<number | null>(null);
  const [reversing, setReversing] = useState<number | null>(null);
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  const title = query.data;
  if (!title) return null;
  const reversedIds = new Set((title.settlements ?? []).filter((s) => s.kind === "reversal").map((s) => s.reversalOfId));
  return (
    <section className="erp-card">
      <div className="erp-page-head">
        <div><h3>{title.description}</h3><p className="erp-muted">{title.kind === "payable" ? "A pagar" : "A receber"} · total {formatMoney(title.total)} · {title.scope}</p></div>
        <div className="erp-page-actions"><Badge value={title.status} /><button type="button" className="erp-btn" onClick={onClose}>Fechar</button></div>
      </div>
      <div className="erp-table-wrap">
        <table className="erp-table">
          <thead><tr><th>Parcela</th><th>Vencimento</th><th className="num">Valor</th><th className="num">Baixado</th><th className="num">Em aberto</th><th>Situação</th><th /></tr></thead>
          <tbody>
            {title.installments?.map((i) => (
              <tr key={i.id}>
                <td>{i.number}</td><td>{formatDay(i.dueDate)}{i.overdue && <> <Badge value="failed" label="Vencida" /></>}</td>
                <td className="num">{formatMoney(i.amount)}</td><td className="num">{formatMoney(i.settledAmount)}</td><td className="num">{formatMoney(i.openAmount)}</td>
                <td><Badge value={i.status} /></td>
                <td>
                  {can("finance:settle") && Number(i.openAmount) > 0 && title.status !== "cancelled" && (
                    <button type="button" className="erp-btn" onClick={() => setSettling(settling === i.id ? null : i.id)}>Baixar</button>
                  )}
                  {settling === i.id && (
                    <SettleForm installmentId={i.id} open={i.openAmount} accountsList={accountList.data?.items ?? []} onDone={() => setSettling(null)} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 style={{ marginTop: 16 }}>Baixas e estornos</h3>
      {(title.settlements ?? []).length === 0 ? <StatePanel kind="empty" message="Sem baixas." /> : (
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead><tr><th>#</th><th>Tipo</th><th className="num">Valor</th><th>Quando</th><th>Referência/motivo</th><th /></tr></thead>
            <tbody>
              {title.settlements?.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td><td>{s.kind === "payment" ? "Baixa" : `Estorno de #${s.reversalOfId}`}</td>
                  <td className="num">{formatMoney(s.amount)}</td><td>{formatInstant(s.settledAt)}</td><td>{s.reason ?? s.reference ?? "—"}</td>
                  <td>
                    {s.kind === "payment" && !reversedIds.has(s.id) && can("finance:settle") && (
                      <button type="button" className="erp-btn" onClick={() => setReversing(reversing === s.id ? null : s.id)}>Estornar</button>
                    )}
                    {reversing === s.id && <ReverseForm settlementId={s.id} amount={s.amount} onDone={() => setReversing(null)} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TitleForm({ onDone }: { onDone: () => void }) {
  const suppliers = useErpQuery(["suppliers", "options"], `/suppliers${buildQuery({ page_size: 100 })}`, supplierPage);
  const categories = useErpQuery(["fin-categories"], "/finance/categories", simpleRows);
  const centers = useErpQuery(["fin-cost-centers"], "/finance/cost-centers", simpleRows);
  const [kind, setKind] = useState<"payable" | "receivable">("payable");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [due, setDue] = useState("");
  const [installments, setInstallments] = useState("1");
  const [supplierId, setSupplierId] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [categoryId, setCategoryId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [touched, setTouched] = useState(false);
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  const parsed = parseMoneyInput(total);
  const errors = useMemo(() => ({
    description: description.trim() ? "" : "Descreva o título.",
    total: parsed && Number(parsed) > 0 ? "" : "Valor inválido (use 1234,56).",
    due: due ? "" : "Informe o 1º vencimento.",
    installments: Number.isInteger(Number(installments)) && Number(installments) >= 1 && Number(installments) <= 60 ? "" : "Parcelas entre 1 e 60.",
    party: kind === "payable" ? (supplierId ? "" : "Escolha o fornecedor.") : (customer ? "" : "Escolha o cliente."),
  }), [description, parsed, due, installments, kind, supplierId, customer]);
  const invalid = Object.values(errors).some(Boolean);
  const invalidFocus = useFocusInvalid();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (invalid) {
      invalidFocus.focus();
      return;
    }
    const body: Record<string, unknown> = {
      kind, description: description.trim(), total: parsed, firstDueDate: due, installments: Number(installments),
      ...(kind === "payable" ? { supplierId: Number(supplierId) } : { customerId: customer?.id }),
    };
    if (categoryId) body.categoryId = Number(categoryId);
    if (costCenterId) body.costCenterId = Number(costCenterId);
    const ok = await command.mutateAsync({ path: "/finance/titles", body, idempotent: true }).then(() => true).catch(() => false);
    if (ok) { void invalidate("fin-titles"); onDone(); }
  }
  const show = (k: keyof typeof errors) => (touched ? errors[k] : null);
  return (
    <form ref={invalidFocus.ref} className="erp-card erp-form" onSubmit={submit} noValidate aria-label="Novo título">
      <h3 className="erp-wide">Novo título local</h3>
      <label className="erp-field"><span>Tipo</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as "payable" | "receivable")}>
          <option value="payable">A pagar (fornecedor)</option><option value="receivable">A receber (cliente)</option></select></label>
      <label className="erp-field erp-wide"><span>Descrição *</span><input value={description} onChange={(e) => setDescription(e.target.value)} aria-invalid={Boolean(show("description"))} /><FieldError message={show("description")} /></label>
      <label className="erp-field"><span>Valor total *</span><input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} aria-invalid={Boolean(show("total"))} /><FieldError message={show("total")} /></label>
      <label className="erp-field"><span>1º vencimento *</span><input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-invalid={Boolean(show("due"))} /><FieldError message={show("due")} /></label>
      <label className="erp-field"><span>Parcelas</span><input inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} /><FieldError message={show("installments")} /></label>
      {kind === "payable" ? (
        <label className="erp-field"><span>Fornecedor *</span>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Selecione</option>{suppliers.data?.items.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select>
          <FieldError message={show("party")} /></label>
      ) : (
        <div className="erp-wide"><CustomerPicker label="Cliente *" selected={customer} onSelect={setCustomer} /><FieldError message={show("party")} /></div>
      )}
      <label className="erp-field"><span>Categoria</span>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">—</option>{categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="erp-field"><span>Centro de custo</span>
        <select value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}><option value="">—</option>{centers.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <CommandError error={command.error} />
      <div className="erp-form-actions">
        <button className="erp-btn erp-btn-primary" type="submit" disabled={command.isPending}>{command.isPending ? "Criando…" : "Criar título"}</button>
        <button className="erp-btn" type="button" onClick={onDone}>Fechar</button>
      </div>
    </form>
  );
}

function SimpleCreate({ path, title, resource, withKind }: { path: string; title: string; resource: string; withKind?: boolean }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("expense");
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  return (
    <form
      className="erp-toolbar"
      aria-label={title}
      onSubmit={(e) => {
        e.preventDefault();
        if (!code.trim() || !name.trim()) return;
        void command.mutateAsync({ path, body: { code: code.trim(), name: name.trim(), ...(withKind ? { kind } : {}) } })
          .then(() => { setCode(""); setName(""); void invalidate(resource); }).catch(() => null);
      }}
    >
      <label className="erp-field"><span>Código</span><input value={code} onChange={(e) => setCode(e.target.value)} /></label>
      <label className="erp-field"><span>Nome</span><input value={name} onChange={(e) => setName(e.target.value)} /></label>
      {withKind && (
        <label className="erp-field"><span>Natureza</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)}><option value="expense">Despesa</option><option value="income">Receita</option></select></label>
      )}
      <button className="erp-btn erp-btn-primary" type="submit" disabled={command.isPending}>{title}</button>
      <CommandError error={command.error} />
    </form>
  );
}

export function FinancePage() {
  const { can } = useErp();
  const [tab, setTab] = useState<"titles" | "accounts" | "setup" | "cash">("titles");
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));
  const accountList = useErpQuery(["fin-accounts"], "/finance/accounts", accounts, { enabled: tab === "accounts" });
  const categories = useErpQuery(["fin-categories"], "/finance/categories", simpleRows, { enabled: tab === "setup" });
  const centers = useErpQuery(["fin-cost-centers"], "/finance/cost-centers", simpleRows, { enabled: tab === "setup" });
  const flow = useErpQuery(["cash-flow", from, to], `/finance/cash-flow${buildQuery({ dateFrom: from, dateTo: to })}`, cashFlowSchema, { enabled: tab === "cash" && Boolean(from && to) });

  const columns: Column<FinTitle>[] = [
    { key: "kind", header: "Tipo", render: (t) => (t.kind === "payable" ? "A pagar" : "A receber") },
    { key: "desc", header: "Descrição", render: (t) => <strong>{t.description}</strong> },
    { key: "total", header: "Total", sortKey: "total", render: (t) => formatMoney(t.total) },
    { key: "status", header: "Situação", render: (t) => <Badge value={t.status} /> },
    { key: "origin", header: "Origem", render: (t) => t.originType ?? "manual" },
    { key: "by", header: "Criado por", render: (t) => t.createdBy },
  ];

  return (
    <>
      <PageHeader
        title="Financeiro local"
        subtitle="Contas a pagar e a receber próprias do ERP. Não confundem título Mercos do cliente com passivo de fornecedores; faturamento não é caixa."
        actions={can("finance:write") && tab === "titles" ? <button type="button" className="erp-btn erp-btn-primary" onClick={() => setCreating((v) => !v)}>Novo título</button> : null}
      />
      <Tabs tabs={[{ id: "titles", label: "Títulos e parcelas" }, { id: "accounts", label: "Contas" }, { id: "setup", label: "Categorias e centros de custo" }, { id: "cash", label: "Fluxo de caixa" }]} value={tab} onChange={setTab} />
      {tab === "titles" && (
        <>
          {creating && <TitleForm onDone={() => setCreating(false)} />}
          {selected !== null && <TitleDetail id={selected} onClose={() => setSelected(null)} />}
          <ServerList<FinTitle> resource="fin-titles" path="/finance/titles" schema={titlePage} caption="Títulos locais" columns={columns}
            filters={[
              { name: "kind", label: "Tipo", type: "select", options: [{ value: "payable", label: "A pagar" }, { value: "receivable", label: "A receber" }] },
              { name: "status", label: "Situação", type: "select", options: [{ value: "open", label: "Em aberto" }, { value: "partially_settled", label: "Parcialmente baixado" }, { value: "settled", label: "Baixado" }, { value: "cancelled", label: "Cancelado" }] },
            ]}
            defaultSort="createdAt" defaultOrder="desc" rowKey={(t) => t.id} onRowOpen={(t) => setSelected(t.id)} emptyMessage="Nenhum título." />
        </>
      )}
      {tab === "accounts" && (
        <section className="erp-card">
          {can("finance:write") && <SimpleCreate path="/finance/accounts" title="Criar conta" resource="fin-accounts" />}
          {accountList.isLoading && <StatePanel kind="loading" />}
          {accountList.data && accountList.data.items.length === 0 && <StatePanel kind="empty" message="Nenhuma conta financeira." />}
          {accountList.data && accountList.data.items.length > 0 && (
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Código</th><th>Nome</th><th>Tipo</th><th className="num">Saldo inicial</th><th className="num">Saldo atual</th></tr></thead>
              <tbody>{accountList.data.items.map((a) => (
                <tr key={a.id}><td>{a.code}</td><td>{a.name}</td><td>{a.kind === "cash" ? "Caixa" : "Banco"}</td><td className="num">{formatMoney(a.openingBalance)}</td><td className="num">{formatMoney(a.balance)}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}
      {tab === "setup" && (
        <div className="erp-split">
          <section className="erp-card"><h3>Categorias financeiras</h3>
            {can("finance:write") && <SimpleCreate path="/finance/categories" title="Criar categoria" resource="fin-categories" withKind />}
            <ul>{categories.data?.items.map((c) => <li key={c.id}>{c.code} · {c.name} ({c.kind === "income" ? "receita" : "despesa"})</li>)}</ul>
            {categories.data?.items.length === 0 && <StatePanel kind="empty" message="Nenhuma categoria." />}</section>
          <section className="erp-card"><h3>Centros de custo</h3>
            {can("finance:write") && <SimpleCreate path="/finance/cost-centers" title="Criar centro de custo" resource="fin-cost-centers" />}
            <ul>{centers.data?.items.map((c) => <li key={c.id}>{c.code} · {c.name}</li>)}</ul>
            {centers.data?.items.length === 0 && <StatePanel kind="empty" message="Nenhum centro de custo." />}</section>
        </div>
      )}
      {tab === "cash" && (
        <section className="erp-card">
          <div className="erp-toolbar">
            <label className="erp-field"><span>De</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="erp-field"><span>Até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <p className="erp-muted">Previsto = parcelas em aberto por vencimento; realizado = baixas e estornos. Entradas positivas, saídas negativas.</p>
          {flow.isLoading && <StatePanel kind="loading" />}
          {flow.error && <StatePanel kind="error" message={(flow.error as Error).message} onRetry={() => void flow.refetch()} />}
          {flow.data && flow.data.days.length === 0 && <StatePanel kind="empty" message="Sem movimento previsto ou realizado no período." />}
          {flow.data && flow.data.days.length > 0 && (
            <div className="erp-table-wrap"><table className="erp-table">
              <thead><tr><th>Dia</th><th className="num">Previsto</th><th className="num">Realizado</th></tr></thead>
              <tbody>{flow.data.days.map((d) => <tr key={d.date}><td>{formatDay(d.date)}</td><td className="num">{formatMoney(d.planned)}</td><td className="num">{formatMoney(d.realized)}</td></tr>)}
                <tr><th scope="row">Total</th><th className="num">{formatMoney(flow.data.totals.planned)}</th><th className="num">{formatMoney(flow.data.totals.realized)}</th></tr></tbody>
            </table></div>
          )}
        </section>
      )}
    </>
  );
}
