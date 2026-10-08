import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useErp } from "../../auth/context";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import { operationSchema, orderDetailSchema, type OrderDetail, type Product } from "../../api/schemas";
import { OperationTracker } from "../../components/OperationTracker";
import { ProductPicker, useCatalogOptions } from "../../components/pickers";
import { StatePanel } from "../../components/StatePanel";
import { Badge, CapabilityNotice, Dl, PageHeader, CommandError } from "../../components/ui";
import { formatDay, formatInstant, formatMoney, formatQuantity, parseMoneyInput, parseQuantityInput } from "../../format";
import { StatusChips } from "./OrdersPage";

type EditLine = { key: number; product: Product | null; quantity: string; unitPrice: string };

function initialLines(order: OrderDetail): EditLine[] {
  return order.items
    .filter((item) => !item.excluded)
    .map((item, index) => ({
      key: index + 1,
      // só o necessário para o seletor mostrar o produto atual
      product: item.productId
        ? ({ id: item.productId, code: item.code ?? null, name: item.name ?? item.productId } as unknown as Product)
        : null,
      quantity: String(Number(item.quantity)),
      unitPrice: item.unitPrice ?? "",
    }));
}

/** Itens no formato do contrato, ou a mensagem do primeiro erro. */
export function itemsPayload(lines: EditLine[]): Record<string, unknown>[] | string {
  const result: Record<string, unknown>[] = [];
  for (const [index, line] of lines.entries()) {
    if (!line.product) return `Item ${index + 1}: escolha o produto.`;
    const quantity = parseQuantityInput(line.quantity);
    if (quantity === null) return `Item ${index + 1}: quantidade inválida (positiva, até 4 casas).`;
    const price = line.unitPrice.trim() ? parseMoneyInput(line.unitPrice) : null;
    if (line.unitPrice.trim() && price === null) return `Item ${index + 1}: preço inválido (use 1234,56).`;
    result.push({ productId: line.product.id, quantity, ...(price ? { unitPrice: price } : {}) });
  }
  if (result.length === 0) return "Inclua ao menos um item.";
  return result;
}

function EditPanel({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const [lines, setLines] = useState<EditLine[]>(() => initialLines(order));
  const [nextKey, setNextKey] = useState(() => order.items.length + 1);
  const [originalItems] = useState(() => itemsPayload(initialLines(order)));
  const itemsLocked = order.items.some((item) => !item.excluded && !item.productId);
  const payment = useCatalogOptions("payment-conditions");
  const carriers = useCatalogOptions("carriers");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [paymentConditionId, setPaymentConditionId] = useState(order.paymentConditionId ?? "");
  const [carrierId, setCarrierId] = useState(order.carrierId ?? "");
  const [delivery, setDelivery] = useState(order.expectedDeliveryDate ?? "");
  const [message, setMessage] = useState("");
  const [operationId, setOperationId] = useState<string | null>(null);
  const command = useCommand<Record<string, unknown>, ReturnType<typeof operationSchema.parse>>(operationSchema);
  const invalidate = useInvalidateErp();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const body: Record<string, unknown> = {};
    if (notes !== (order.notes ?? "")) body.notes = notes || null;
    if (paymentConditionId !== (order.paymentConditionId ?? "")) body.paymentConditionId = paymentConditionId || null;
    if (carrierId !== (order.carrierId ?? "")) body.carrierId = carrierId || null;
    if (delivery !== (order.expectedDeliveryDate ?? "")) body.expectedDeliveryDate = delivery || null;
    if (!itemsLocked) {
      const built = itemsPayload(lines);
      if (typeof built === "string") {
        setMessage(built);
        return;
      }
      // só envia os itens se mudaram: enviar apenas campos intencionais
      if (JSON.stringify(built) !== JSON.stringify(originalItems)) body.items = built;
    }
    if (Object.keys(body).length === 0) {
      setMessage("Nenhum campo foi alterado.");
      return;
    }
    setMessage("");
    body.expectedVersion = order.version;
    const result = await command
      .mutateAsync({
        path: `/sales-orders/${encodeURIComponent(order.id)}`,
        method: "PATCH",
        body,
        idempotent: true,
      })
      .catch(() => null);
    if (result) {
      setOperationId(result.operationId);
      void invalidate("orders");
    }
  }

  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label="Editar pedido">
      <h3 className="erp-wide">Editar pedido {order.number ?? order.id}</h3>
      <p className="erp-muted erp-wide">
        Só os campos alterados são enviados. Não há comparação-e-troca no Mercos: se a origem mudar
        entre a consulta e o envio, o risco residual é conciliado após a confirmação.
      </p>
      <label className="erp-field">
        <span>Condição de pagamento</span>
        <select value={paymentConditionId} onChange={(e) => setPaymentConditionId(e.target.value)}>
          <option value="">—</option>
          {payment.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="erp-field">
        <span>Transportadora</span>
        <select value={carrierId} onChange={(e) => setCarrierId(e.target.value)}>
          <option value="">—</option>
          {carriers.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label className="erp-field">
        <span>Previsão de entrega</span>
        <input type="date" value={delivery} onChange={(e) => setDelivery(e.target.value)} />
      </label>
      <label className="erp-field erp-wide">
        <span>Observações</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="erp-wide erp-items-editor">
        <strong>Itens</strong>
        {itemsLocked ? (
          <p className="erp-muted">
            Há itens sem produto identificado na origem; a edição de itens fica bloqueada para não
            enviar um pedido incompleto.
          </p>
        ) : (
          <>
            <p className="erp-muted">
              Editar itens substitui a lista inteira no Mercos. Preço em branco usa o preço de tabela.
            </p>
            {lines.map((line) => (
              <div className="erp-items-row" key={line.key}>
                <ProductPicker
                  label="Produto"
                  selected={line.product}
                  onSelect={(product) =>
                    setLines((cur) => cur.map((l) => (l.key === line.key ? { ...l, product } : l)))
                  }
                />
                <label className="erp-field">
                  <span>Quantidade</span>
                  <input
                    inputMode="decimal"
                    value={line.quantity}
                    onChange={(e) =>
                      setLines((cur) => cur.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)))
                    }
                  />
                </label>
                <label className="erp-field">
                  <span>Preço unitário</span>
                  <input
                    inputMode="decimal"
                    value={line.unitPrice}
                    onChange={(e) =>
                      setLines((cur) => cur.map((l) => (l.key === line.key ? { ...l, unitPrice: e.target.value } : l)))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="erp-btn"
                  disabled={lines.length === 1}
                  onClick={() => setLines((cur) => cur.filter((l) => l.key !== line.key))}
                >
                  Remover
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="erp-btn"
                onClick={() => {
                  setLines((cur) => [...cur, { key: nextKey, product: null, quantity: "1", unitPrice: "" }]);
                  setNextKey((k) => k + 1);
                }}
              >
                Adicionar item
              </button>
            </div>
          </>
        )}
      </div>
      <CommandError error={command.error} local={message} />
      <div className="erp-form-actions">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>
          {command.isPending ? "Enviando…" : "Enviar alterações"}
        </button>
        <button type="button" className="erp-btn" onClick={onClose}>Fechar</button>
      </div>
      {operationId && <div className="erp-wide"><OperationTracker operationId={operationId} /></div>}
    </form>
  );
}

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const { can, capability } = useErp();
  const [editing, setEditing] = useState(false);
  const query = useErpQuery(["order", id], `/sales-orders/${encodeURIComponent(id)}`, orderDetailSchema);
  const write = capability("write.orders");
  const cancel = capability("write.order_cancel");
  const billing = capability("write.billing");

  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const o = query.data;
  if (!o) return null;
  const canEdit = can("orders:write") && Boolean(write?.enabled) && o.itemsComplete && o.kind !== "cancelled";

  return (
    <>
      <PageHeader
        title={`${o.kind === "quote" ? "Orçamento" : "Pedido"} ${o.number ?? o.id}`}
        subtitle={`Cliente ${o.customerName ?? o.customerId ?? "—"} · versão local ${o.version} · origem atualizada em ${formatInstant(o.sourceUpdatedAt)}`}
        actions={
          <>
            {o.customerId && (
              <Link className="erp-btn" to={`/erp/clientes/${encodeURIComponent(o.customerId)}`}>Ver cliente</Link>
            )}
            {canEdit && (
              <button type="button" className="erp-btn erp-btn-primary" onClick={() => setEditing((v) => !v)}>
                {editing ? "Fechar edição" : "Editar"}
              </button>
            )}
          </>
        }
      />
      <section className="erp-card">
        <h3>Estados (separados)</h3>
        <StatusChips order={o} />
        <p className="erp-muted">
          Comercial vem do Mercos; faturamento é o estado externo de faturamento; atendimento e pagamento
          são controlados separadamente no ERP.
        </p>
      </section>
      {!o.itemsComplete && (
        <div className="erp-notice">
          <strong>Pedido incompleto</strong>
          <span>{o.incompleteReason ?? "Itens indisponíveis."} Operações dependentes (edição, estoque, financeiro) ficam bloqueadas até a hidratação.</span>
        </div>
      )}
      {can("orders:write") && <CapabilityNotice capability={write} />}
      <CapabilityNotice capability={cancel} />
      <CapabilityNotice capability={billing} />
      {editing && canEdit && <EditPanel order={o} onClose={() => setEditing(false)} />}
      <section className="erp-card">
        <h3>Resumo</h3>
        <Dl
          items={[
            ["Emissão", o.issueDate ? formatDay(o.issueDate) : formatInstant(o.issuedAt)],
            ["Previsão de entrega", formatDay(o.expectedDeliveryDate)],
            ["Total bruto", formatMoney(o.grossTotal)],
            ["Desconto", formatMoney(o.discountTotal)],
            ["Frete", formatMoney(o.freightTotal)],
            ["Total líquido", formatMoney(o.netTotal)],
            ["Vendedor", o.sellerId],
            ["Tipo de pedido", o.orderTypeId],
            ["Condição de pagamento", o.paymentConditionId],
            ["Tabela de preço", o.priceTableId],
            ["Transportadora", o.carrierId],
            ["Política comercial", o.commercialPolicyId],
          ]}
        />
      </section>
      <section className="erp-card">
        <h3>Itens</h3>
        {o.items.length === 0 ? (
          <StatePanel kind="unavailable" message="Itens não recebidos. Isto não significa pedido sem itens." />
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr><th>#</th><th>Produto</th><th className="num">Qtde</th><th className="num">Tabela</th><th className="num">Unitário</th><th className="num">Desconto</th><th className="num">Total</th><th /></tr>
              </thead>
              <tbody>
                {o.items.map((item) => (
                  <tr key={item.position}>
                    <td>{item.position + 1}</td>
                    <td>{item.code ? `${item.code} · ` : ""}{item.name ?? item.productId ?? "—"}</td>
                    <td className="num">{formatQuantity(item.quantity)}</td>
                    <td className="num">{formatMoney(item.listUnitPrice)}</td>
                    <td className="num">{formatMoney(item.unitPrice)}</td>
                    <td className="num">{formatMoney(item.discount)}</td>
                    <td className="num">{formatMoney(item.total)}</td>
                    <td>{item.excluded ? <Badge value="cancelled" label="Excluído" /> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {o.notes && (
        <section className="erp-card">
          <h3>Observações</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{o.notes}</p>
        </section>
      )}
    </>
  );
}
