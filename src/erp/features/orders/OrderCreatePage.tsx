import { type FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useCommand, useInvalidateErp } from "../../api/hooks";
import { type Customer, operationSchema, type Product } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { OperationTracker } from "../../components/OperationTracker";
import { CustomerPicker, ProductPicker, useCatalogOptions } from "../../components/pickers";
import { StatePanel } from "../../components/StatePanel";
import { CapabilityNotice, CommandError, FieldError, PageHeader, useFocusInvalid } from "../../components/ui";
import { formatMoney, parseMoneyInput, parseQuantityInput } from "../../format";

type Line = {
  key: number;
  product: Product | null;
  quantity: string;
  unitPrice: string;
};

type Errors = { customer?: string; lines?: Record<number, string>; general?: string };

export function validateOrder(customer: Customer | null, lines: Line[]): Errors {
  const errors: Errors = {};
  if (!customer) errors.customer = "Escolha o cliente.";
  else if (customer.blocked) errors.customer = "Cliente bloqueado na origem: não é possível criar pedido.";
  if (lines.length === 0) errors.general = "Inclua ao menos um item.";
  const lineErrors: Record<number, string> = {};
  for (const line of lines) {
    if (!line.product) lineErrors[line.key] = "Escolha o produto.";
    else if (parseQuantityInput(line.quantity) === null) lineErrors[line.key] = "Quantidade inválida (positiva, até 4 casas).";
    else if (line.unitPrice.trim() && parseMoneyInput(line.unitPrice) === null) lineErrors[line.key] = "Preço inválido (use 1234,56).";
  }
  if (Object.keys(lineErrors).length) errors.lines = lineErrors;
  return errors;
}

export function OrderCreatePage() {
  const { can, capability } = useErp();
  const cap = capability("write.orders");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lines, setLines] = useState<Line[]>([{ key: 1, product: null, quantity: "1", unitPrice: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const [paymentConditionId, setPaymentConditionId] = useState("");
  const [priceTableId, setPriceTableId] = useState("");
  const [carrierId, setCarrierId] = useState("");
  const [orderTypeId, setOrderTypeId] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const payment = useCatalogOptions("payment-conditions");
  const tables = useCatalogOptions("price-tables");
  const carriers = useCatalogOptions("carriers");
  const types = useCatalogOptions("order-types");
  const command = useCommand<Record<string, unknown>, ReturnType<typeof operationSchema.parse>>(operationSchema);
  const invalidate = useInvalidateErp();
  const errors = validateOrder(customer, lines);
  const invalidFocus = useFocusInvalid();

  if (!can("orders:write")) {
    return <StatePanel kind="forbidden" message="Seu perfil não pode criar pedidos." />;
  }

  const patchLine = (key: number, change: Partial<Line>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0 || !customer) {
      invalidFocus.focus();
      return;
    }
    const body: Record<string, unknown> = {
      customerId: customer.id,
      items: lines.map((line) => ({
        productId: (line.product as Product).id,
        quantity: parseQuantityInput(line.quantity),
        ...(line.unitPrice.trim() ? { unitPrice: parseMoneyInput(line.unitPrice) } : {}),
      })),
    };
    if (paymentConditionId) body.paymentConditionId = paymentConditionId;
    if (priceTableId) body.priceTableId = priceTableId;
    if (carrierId) body.carrierId = carrierId;
    if (orderTypeId) body.orderTypeId = orderTypeId;
    if (notes.trim()) body.notes = notes.trim();
    const result = await command
      .mutateAsync({ path: "/sales-orders", method: "POST", body, idempotent: true })
      .catch(() => null);
    if (result) {
      setOperationId(result.operationId);
      void invalidate("orders");
    }
  }

  const select = (
    label: string,
    value: string,
    set: (v: string) => void,
    options: { value: string; label: string }[],
  ) => (
    <label className="erp-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => set(e.target.value)}>
        <option value="">—</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <PageHeader
        title="Novo pedido"
        subtitle="O pedido vira uma operação assíncrona. Nada é dado como salvo no Mercos antes da confirmação."
        actions={<Link className="erp-btn" to="/erp/pedidos">Voltar à lista</Link>}
      />
      <CapabilityNotice capability={cap} />
      {!cap?.enabled ? null : (
        <form ref={invalidFocus.ref} className="erp-card erp-form" onSubmit={submit} noValidate aria-label="Novo pedido">
          <div className="erp-wide">
            <CustomerPicker
              label="Cliente *"
              selected={customer}
              onSelect={setCustomer}
              invalid={touched && Boolean(errors.customer)}
            />
            <FieldError message={touched ? errors.customer : null} />
          </div>
          <div className="erp-wide erp-items-editor">
            <strong>Itens *</strong>
            {lines.map((line) => (
              <div key={line.key}>
                <div className="erp-items-row">
                  <ProductPicker
                    label="Produto"
                    selected={line.product}
                    onSelect={(product) => patchLine(line.key, { product })}
                    invalid={touched && Boolean(errors.lines?.[line.key])}
                  />
                  <label className="erp-field">
                    <span>Quantidade</span>
                    <input inputMode="decimal" value={line.quantity} onChange={(e) => patchLine(line.key, { quantity: e.target.value })} />
                  </label>
                  <label className="erp-field">
                    <span>Preço unitário (opcional)</span>
                    <input
                      inputMode="decimal"
                      placeholder={line.product ? formatMoney(line.product.listPrice) : "1234,56"}
                      value={line.unitPrice}
                      onChange={(e) => patchLine(line.key, { unitPrice: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="erp-btn"
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((l) => l.key !== line.key))}
                  >
                    Remover
                  </button>
                </div>
                <FieldError message={touched ? errors.lines?.[line.key] : null} />
              </div>
            ))}
            <div>
              <button
                type="button"
                className="erp-btn"
                onClick={() => {
                  setLines((current) => [...current, { key: nextKey, product: null, quantity: "1", unitPrice: "" }]);
                  setNextKey((k) => k + 1);
                }}
              >
                Adicionar item
              </button>
            </div>
            <FieldError message={touched ? errors.general : null} />
          </div>
          {select("Condição de pagamento", paymentConditionId, setPaymentConditionId, payment.options)}
          {select("Tabela de preço", priceTableId, setPriceTableId, tables.options)}
          {select("Transportadora", carrierId, setCarrierId, carriers.options)}
          {select("Tipo de pedido", orderTypeId, setOrderTypeId, types.options)}
          <label className="erp-field erp-wide">
            <span>Observações</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {command.error && (
            <div className="erp-wide">
              <CommandError error={command.error} />
              <p className="erp-muted">O formulário foi preservado. Reenviar o mesmo conteúdo reaproveita a chave de idempotência.</p>
            </div>
          )}
          <div className="erp-form-actions">
            <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>
              {command.isPending ? "Enviando…" : "Criar pedido"}
            </button>
          </div>
          {operationId && <div className="erp-wide"><OperationTracker operationId={operationId} /></div>}
        </form>
      )}
    </>
  );
}
