import { useState, type FormEvent } from "react";
import { z, type ZodType } from "zod";
import { useErp } from "../../auth/context";
import { buildQuery } from "../../api/client";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import {
  pageOf,
  purchaseOrderSchema,
  supplierSchema,
  warehouseSchema,
  simpleListSchema,
  type Page,
  type PurchaseOrder,
  type Supplier,
} from "../../api/schemas";
import { ServerList, type Column } from "../../components/ServerList";
import { StatePanel } from "../../components/StatePanel";
import { Badge, FieldError, PageHeader, Tabs, CommandError } from "../../components/ui";
import { formatInstant, formatMoney, formatQuantity, parseMoneyInput, parseQuantityInput } from "../../format";

const supplierPage = pageOf(supplierSchema) as unknown as ZodType<Page<Supplier>>;
const orderPage = pageOf(purchaseOrderSchema) as unknown as ZodType<Page<PurchaseOrder>>;
const warehouses = simpleListSchema(warehouseSchema);
const receiptResult = z.looseObject({
  receiptId: z.number(),
  status: z.string(),
  inventoryEffect: z.string(),
  payableTitleId: z.number().nullable().optional(),
});

const INVENTORY_EFFECT: Record<string, string> = {
  applied: "Entrada de estoque aplicada.",
  not_applied_authority_mercos:
    "Entrada de estoque NÃO aplicada: o saldo oficial ainda é o do Mercos (sem corte/autoridade ERP).",
  partial: "Entrada de estoque aplicada parcialmente (itens sem vínculo de produto).",
};

function SupplierForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ code: "", name: "", document: "", email: "", phone: "", city: "", state: "", paymentTerms: "" });
  const [touched, setTouched] = useState(false);
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const errors = { code: form.code.trim() ? "" : "Informe o código.", name: form.name.trim() ? "" : "Informe o nome." };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (errors.code || errors.name) return;
    const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v.trim() !== ""));
    const ok = await command.mutateAsync({ path: "/suppliers", body }).then(() => true).catch(() => false);
    if (ok) {
      void invalidate("suppliers");
      onDone();
    }
  }
  return (
    <form className="erp-card erp-form" onSubmit={submit} noValidate aria-label="Novo fornecedor">
      <h3 className="erp-wide">Novo fornecedor</h3>
      <label className="erp-field"><span>Código *</span>
        <input value={form.code} onChange={(e) => set("code", e.target.value)} aria-invalid={touched && Boolean(errors.code)} />
        <FieldError message={touched ? errors.code : null} /></label>
      <label className="erp-field"><span>Nome *</span>
        <input value={form.name} onChange={(e) => set("name", e.target.value)} aria-invalid={touched && Boolean(errors.name)} />
        <FieldError message={touched ? errors.name : null} /></label>
      <label className="erp-field"><span>Documento</span><input value={form.document} onChange={(e) => set("document", e.target.value)} /></label>
      <label className="erp-field"><span>E-mail</span><input value={form.email} onChange={(e) => set("email", e.target.value)} /></label>
      <label className="erp-field"><span>Telefone</span><input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
      <label className="erp-field"><span>Cidade</span><input value={form.city} onChange={(e) => set("city", e.target.value)} /></label>
      <label className="erp-field"><span>UF</span><input maxLength={5} value={form.state} onChange={(e) => set("state", e.target.value.toUpperCase())} /></label>
      <label className="erp-field"><span>Condições de pagamento</span><input value={form.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} /></label>
      <CommandError error={command.error} />
      <div className="erp-form-actions">
        <button className="erp-btn erp-btn-primary" type="submit" disabled={command.isPending}>{command.isPending ? "Salvando…" : "Cadastrar"}</button>
        <button className="erp-btn" type="button" onClick={onDone}>Fechar</button>
      </div>
    </form>
  );
}

type DraftItem = { key: number; productId: string; description: string; quantity: string; unitCost: string };

function PurchaseForm({ onDone }: { onDone: () => void }) {
  const suppliers = useErpQuery(["suppliers", "options"], `/suppliers${buildQuery({ page_size: 100 })}`, supplierPage);
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ key: 1, productId: "", description: "", quantity: "1", unitCost: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const [touched, setTouched] = useState(false);
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();

  const itemError = (item: DraftItem) =>
    !item.description.trim() ? "Descreva o item."
      : parseQuantityInput(item.quantity) === null ? "Quantidade inválida."
      : item.unitCost.trim() === "" || parseMoneyInput(item.unitCost) === null ? "Custo unitário inválido (use 12,34)."
      : "";
  const hasErrors = !supplierId || items.some((i) => itemError(i));
  const patch = (key: number, change: Partial<DraftItem>) => setItems((cur) => cur.map((i) => (i.key === key ? { ...i, ...change } : i)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (hasErrors) return;
    const body = {
      supplierId: Number(supplierId),
      expectedDate: expectedDate || null,
      notes: notes.trim() || null,
      items: items.map((i) => ({
        productId: i.productId.trim() || null,
        description: i.description.trim(),
        quantity: parseQuantityInput(i.quantity),
        unitCost: parseMoneyInput(i.unitCost),
      })),
    };
    const ok = await command.mutateAsync({ path: "/purchase-orders", body }).then(() => true).catch(() => false);
    if (ok) {
      void invalidate("purchase-orders");
      onDone();
    }
  }

  return (
    <form className="erp-card erp-form" onSubmit={submit} noValidate aria-label="Novo pedido de compra">
      <h3 className="erp-wide">Novo pedido de compra (rascunho)</h3>
      <label className="erp-field"><span>Fornecedor *</span>
        <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} aria-invalid={touched && !supplierId}>
          <option value="">Selecione</option>
          {suppliers.data?.items.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
        </select>
        <FieldError message={touched && !supplierId ? "Escolha o fornecedor." : null} /></label>
      <label className="erp-field"><span>Previsão de entrega</span><input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></label>
      <div className="erp-wide erp-items-editor">
        <strong>Itens *</strong>
        {items.map((item) => (
          <div key={item.key}>
            <div className="erp-items-row" style={{ gridTemplateColumns: "1fr 2fr 100px 120px auto" }}>
              <label className="erp-field"><span>ID do produto (opcional)</span><input value={item.productId} onChange={(e) => patch(item.key, { productId: e.target.value })} /></label>
              <label className="erp-field"><span>Descrição</span><input value={item.description} onChange={(e) => patch(item.key, { description: e.target.value })} /></label>
              <label className="erp-field"><span>Qtde</span><input inputMode="decimal" value={item.quantity} onChange={(e) => patch(item.key, { quantity: e.target.value })} /></label>
              <label className="erp-field"><span>Custo unit.</span><input inputMode="decimal" value={item.unitCost} onChange={(e) => patch(item.key, { unitCost: e.target.value })} /></label>
              <button type="button" className="erp-btn" disabled={items.length === 1} onClick={() => setItems((cur) => cur.filter((i) => i.key !== item.key))}>Remover</button>
            </div>
            <FieldError message={touched ? itemError(item) : null} />
          </div>
        ))}
        <div><button type="button" className="erp-btn" onClick={() => { setItems((cur) => [...cur, { key: nextKey, productId: "", description: "", quantity: "1", unitCost: "" }]); setNextKey((k) => k + 1); }}>Adicionar item</button></div>
      </div>
      <label className="erp-field erp-wide"><span>Observações</span><textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <CommandError error={command.error} />
      <div className="erp-form-actions">
        <button className="erp-btn erp-btn-primary" type="submit" disabled={command.isPending}>{command.isPending ? "Salvando…" : "Criar rascunho"}</button>
        <button className="erp-btn" type="button" onClick={onDone}>Fechar</button>
      </div>
    </form>
  );
}

function ReceivePanel({ order, onDone }: { order: PurchaseOrder; onDone: () => void }) {
  const stock = useErpQuery(["warehouses"], "/inventory/warehouses", warehouses);
  const [warehouseId, setWarehouseId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [withPayable, setWithPayable] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [installments, setInstallments] = useState("1");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<z.infer<typeof receiptResult> | null>(null);
  const command = useCommand<Record<string, unknown>, z.infer<typeof receiptResult>>(receiptResult);
  const invalidate = useInvalidateErp();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const lines = (order.items ?? [])
      .map((item) => ({ itemId: item.id, quantity: parseQuantityInput(quantities[item.id] ?? "") }))
      .filter((line) => line.quantity !== null);
    if (!warehouseId) return setMessage("Escolha o depósito.");
    if (lines.length === 0) return setMessage("Informe a quantidade recebida de ao menos um item.");
    if (withPayable && !dueDate) return setMessage("Informe o vencimento da conta a pagar.");
    setMessage("");
    const body: Record<string, unknown> = { warehouseId: Number(warehouseId), invoiceNumber: invoice.trim() || null, lines };
    if (withPayable) body.payable = { dueDate, installments: Number(installments) || 1 };
    const res = await command.mutateAsync({ path: `/purchase-orders/${order.id}/receive`, body, idempotent: true }).catch(() => null);
    if (res) {
      setResult(res);
      void invalidate("purchase-orders");
      void invalidate("balances");
    }
  }

  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label="Receber mercadoria">
      <h3 className="erp-wide">Receber mercadoria — {order.number}</h3>
      <label className="erp-field"><span>Depósito *</span>
        <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
          <option value="">Selecione</option>
          {stock.data?.items.map((w) => <option key={w.id} value={w.id}>{w.code} · {w.name}</option>)}
        </select></label>
      <label className="erp-field"><span>Nota fiscal</span><input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></label>
      <div className="erp-wide erp-table-wrap">
        <table className="erp-table">
          <thead><tr><th>Item</th><th className="num">Pedido</th><th className="num">Recebido</th><th className="num">Pendente</th><th>Receber agora</th></tr></thead>
          <tbody>
            {order.items?.map((item) => (
              <tr key={item.id}>
                <td>{item.description}</td>
                <td className="num">{formatQuantity(item.quantity)}</td>
                <td className="num">{formatQuantity(item.receivedQuantity)}</td>
                <td className="num">{formatQuantity(item.pendingQuantity)}</td>
                <td><input aria-label={`Receber ${item.description}`} inputMode="decimal" value={quantities[item.id] ?? ""} placeholder="0" onChange={(e) => setQuantities((q) => ({ ...q, [item.id]: e.target.value }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <label className="erp-field erp-wide"><span><input type="checkbox" checked={withPayable} onChange={(e) => setWithPayable(e.target.checked)} /> Gerar conta a pagar deste recebimento</span></label>
      {withPayable && (
        <>
          <label className="erp-field"><span>1º vencimento</span><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          <label className="erp-field"><span>Parcelas</span><input inputMode="numeric" value={installments} onChange={(e) => setInstallments(e.target.value)} /></label>
        </>
      )}
      <CommandError error={command.error} local={message} />
      {result && (
        <div className="erp-notice erp-wide" role="status">
          <strong>Recebimento {result.receiptId} registrado — pedido {result.status}</strong>
          <span>{INVENTORY_EFFECT[result.inventoryEffect] ?? result.inventoryEffect}</span>
          {result.payableTitleId ? <span>Conta a pagar #{result.payableTitleId} criada.</span> : null}
        </div>
      )}
      <div className="erp-form-actions">
        <button className="erp-btn erp-btn-primary" type="submit" disabled={command.isPending}>{command.isPending ? "Registrando…" : "Registrar recebimento"}</button>
        <button className="erp-btn" type="button" onClick={onDone}>Fechar</button>
      </div>
    </form>
  );
}

function ReceiptReversal({ orderId, receiptId, onDone }: { orderId: number; receiptId: number; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  return (
    <form
      className="erp-form"
      aria-label="Estornar recebimento"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length < 3) return;
        if (!confirm) return setConfirm(true);
        void command
          .mutateAsync({
            path: `/purchase-orders/${orderId}/receipts/${receiptId}/reversals`,
            body: { reason: reason.trim() },
            idempotent: true,
          })
          .then(onDone)
          .catch(() => null);
      }}
    >
      <label className="erp-field erp-wide">
        <span>Motivo do estorno</span>
        <input value={reason} onChange={(e) => { setReason(e.target.value); setConfirm(false); }} />
      </label>
      {confirm && (
        <div className="erp-notice erp-wide" role="alert">
          <strong>Confirme os efeitos</strong>
          <span>
            Devolve a quantidade ao pedido, reverte a entrada de estoque (recusado se o saldo já foi
            consumido) e cancela a conta a pagar do recebimento (recusado se já houver baixa). Tudo ou nada.
          </span>
        </div>
      )}
      <CommandError error={command.error} />
      <div className="erp-form-actions">
        <button type="submit" className="erp-btn erp-btn-danger" disabled={reason.trim().length < 3 || command.isPending}>
          {confirm ? "Confirmar estorno" : "Estornar recebimento"}
        </button>
        <button type="button" className="erp-btn" onClick={onDone}>Cancelar</button>
      </div>
    </form>
  );
}

function PurchaseDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const { can } = useErp();
  const query = useErpQuery(["purchase-order", id], `/purchase-orders/${id}`, purchaseOrderSchema);
  const invalidate = useInvalidateErp();
  const [receiving, setReceiving] = useState(false);
  const [reversing, setReversing] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const approve = useCommand<undefined, unknown>(z.unknown());
  const cancel = useCommand<Record<string, unknown>, unknown>(z.unknown());
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  const order = query.data;
  if (!order) return null;
  const refresh = () => { void query.refetch(); void invalidate("purchase-orders"); };
  const canReceive = can("purchases:receive") && ["approved", "partially_received"].includes(order.status);

  return (
    <section className="erp-card">
      <div className="erp-page-head">
        <div><h3>{order.number} · {order.supplierName}</h3><p className="erp-muted">Criado por {order.createdBy} · total {formatMoney(order.total)}</p></div>
        <div className="erp-page-actions">
          <Badge value={order.status} />
          {order.status === "draft" && can("purchases:approve") && (
            <button type="button" className="erp-btn erp-btn-primary" disabled={approve.isPending} onClick={() => void approve.mutateAsync({ path: `/purchase-orders/${order.id}/approve` }).then(refresh).catch(() => null)}>Aprovar</button>
          )}
          {canReceive && <button type="button" className="erp-btn erp-btn-primary" onClick={() => setReceiving((v) => !v)}>Receber</button>}
          <button type="button" className="erp-btn" onClick={onClose}>Fechar</button>
        </div>
      </div>
      <CommandError error={approve.error} />
      <div className="erp-table-wrap">
        <table className="erp-table">
          <thead><tr><th>Item</th><th>Produto</th><th className="num">Qtde</th><th className="num">Recebido</th><th className="num">Custo unit.</th></tr></thead>
          <tbody>
            {order.items?.map((item) => (
              <tr key={item.id}><td>{item.description}</td><td>{item.productId ?? "—"}</td><td className="num">{formatQuantity(item.quantity)}</td><td className="num">{formatQuantity(item.receivedQuantity)}</td><td className="num">{formatQuantity(item.unitCost)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {receiving && canReceive && <ReceivePanel order={order} onDone={() => { setReceiving(false); refresh(); }} />}
      {(order.receipts?.length ?? 0) > 0 && (
        <section aria-label="Recebimentos">
          <h3 style={{ marginTop: 16 }}>Recebimentos</h3>
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead><tr><th>#</th><th>NF</th><th>Recebido por</th><th>Quando</th><th>Itens</th><th>Situação</th><th /></tr></thead>
              <tbody>
                {order.receipts?.map((r) => (
                  <tr key={r.id}>
                    <td>{r.id}</td>
                    <td>{r.invoiceNumber ?? "—"}</td>
                    <td>{r.receivedBy}</td>
                    <td>{formatInstant(r.receivedAt)}</td>
                    <td>{r.lines.map((l) => `${l.itemId}: ${formatQuantity(l.quantity)}`).join(" · ")}</td>
                    <td>
                      {r.reversedAt ? (
                        <><Badge value="cancelled" label="Estornado" /><div className="erp-muted">{r.reverseReason}</div></>
                      ) : (
                        <Badge value="success" label="Válido" />
                      )}
                    </td>
                    <td>
                      {!r.reversedAt && can("purchases:receive") && order.status !== "cancelled" && (
                        <button type="button" className="erp-btn" onClick={() => setReversing(reversing === r.id ? null : r.id)}>
                          Estornar
                        </button>
                      )}
                      {reversing === r.id && (
                        <ReceiptReversal orderId={order.id} receiptId={r.id} onDone={() => { setReversing(null); refresh(); }} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {["draft", "approved"].includes(order.status) && can("purchases:approve") && (
        <form
          className="erp-toolbar"
          onSubmit={(e) => {
            e.preventDefault();
            if (reason.trim().length < 3) return;
            void cancel.mutateAsync({ path: `/purchase-orders/${order.id}/cancel`, body: { reason: reason.trim() } }).then(refresh).catch(() => null);
          }}
        >
          <label className="erp-field"><span>Motivo do cancelamento</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          <button className="erp-btn erp-btn-danger" type="submit" disabled={cancel.isPending || reason.trim().length < 3}>Cancelar pedido de compra</button>
          <CommandError error={cancel.error} />
        </form>
      )}
    </section>
  );
}

export function PurchasingPage() {
  const { can } = useErp();
  const [tab, setTab] = useState<"orders" | "suppliers">("orders");
  const [creatingSupplier, setCreatingSupplier] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const supplierColumns: Column<Supplier>[] = [
    { key: "code", header: "Código", sortKey: "code", render: (s) => s.code },
    { key: "name", header: "Fornecedor", sortKey: "name", render: (s) => <strong>{s.name}</strong> },
    { key: "doc", header: "Documento", render: (s) => s.document ?? "—" },
    { key: "contact", header: "Contato", render: (s) => s.email ?? s.phone ?? "—" },
    { key: "city", header: "Cidade/UF", render: (s) => [s.city, s.state].filter(Boolean).join(" / ") || "—" },
    { key: "active", header: "Situação", render: (s) => (s.active ? <Badge value="active" label="Ativo" /> : <Badge value="cancelled" label="Inativo" />) },
  ];
  const orderColumns: Column<PurchaseOrder>[] = [
    { key: "number", header: "Número", sortKey: "number", render: (o) => <strong>{o.number}</strong> },
    { key: "supplier", header: "Fornecedor", render: (o) => o.supplierName ?? o.supplierId },
    { key: "status", header: "Situação", render: (o) => <Badge value={o.status} /> },
    { key: "total", header: "Total", render: (o) => formatMoney(o.total) },
    { key: "created", header: "Criado por", render: (o) => o.createdBy },
  ];

  return (
    <>
      <PageHeader
        title="Compras e fornecedores"
        subtitle="Rascunho, aprovação e recebimento parcial. O custo real vem do recebimento; nunca do preço de tabela de venda."
        actions={
          can("purchases:write") ? (
            tab === "suppliers" ? (
              <button type="button" className="erp-btn erp-btn-primary" onClick={() => setCreatingSupplier((v) => !v)}>Novo fornecedor</button>
            ) : (
              <button type="button" className="erp-btn erp-btn-primary" onClick={() => setCreatingOrder((v) => !v)}>Novo pedido de compra</button>
            )
          ) : null
        }
      />
      <Tabs tabs={[{ id: "orders", label: "Pedidos de compra" }, { id: "suppliers", label: "Fornecedores" }]} value={tab} onChange={setTab} />
      {tab === "suppliers" && creatingSupplier && <SupplierForm onDone={() => setCreatingSupplier(false)} />}
      {tab === "orders" && creatingOrder && <PurchaseForm onDone={() => setCreatingOrder(false)} />}
      {tab === "orders" && selected !== null && <PurchaseDetail id={selected} onClose={() => setSelected(null)} />}
      {tab === "suppliers" ? (
        <ServerList<Supplier> resource="suppliers" path="/suppliers" schema={supplierPage} caption="Fornecedores" columns={supplierColumns}
          filters={[{ name: "search", label: "Buscar", type: "text", placeholder: "Nome" }]} defaultSort="name" rowKey={(s) => s.id}
          emptyMessage="Nenhum fornecedor cadastrado." />
      ) : (
        <ServerList<PurchaseOrder> resource="purchase-orders" path="/purchase-orders" schema={orderPage} caption="Pedidos de compra" columns={orderColumns}
          filters={[{ name: "status", label: "Situação", type: "select", options: [
            { value: "draft", label: "Rascunho" }, { value: "approved", label: "Aprovado" },
            { value: "partially_received", label: "Recebido parcialmente" }, { value: "received", label: "Recebido" }, { value: "cancelled", label: "Cancelado" } ] }]}
          defaultSort="createdAt" defaultOrder="desc" rowKey={(o) => o.id} onRowOpen={(o) => setSelected(o.id)}
          emptyMessage="Nenhum pedido de compra." />
      )}
    </>
  );
}
