import { useState, type FormEvent } from "react";
import { z, type ZodType } from "zod";
import { useErp } from "../../auth/context";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import {
  authoritySchema,
  balancesSchema,
  movementSchema,
  pageOf,
  reservationSchema,
  simpleListSchema,
  warehouseSchema,
  type Authority,
  type Page,
} from "../../api/schemas";
import { ServerList, type Column } from "../../components/ServerList";
import { StatePanel } from "../../components/StatePanel";
import { Badge, PageHeader, Tabs, CommandError } from "../../components/ui";
import { formatInstant, formatQuantity, parseQuantityInput } from "../../format";

type Balance = z.infer<typeof balancesSchema>["items"][number];
type Movement = z.infer<typeof movementSchema>;
const balancePage = balancesSchema as unknown as ZodType<Page<Balance>>;
const movementPage = pageOf(movementSchema) as unknown as ZodType<Page<Movement>>;
const warehouseList = simpleListSchema(warehouseSchema);
const reservationList = simpleListSchema(reservationSchema);

const KIND_LABEL: Record<string, string> = {
  receipt: "Entrada de compra",
  adjustment: "Ajuste",
  transfer_out: "Transferência (saída)",
  transfer_in: "Transferência (entrada)",
  reservation: "Reserva",
  reservation_release: "Liberação de reserva",
  sale_issue: "Saída de venda",
};

function AuthorityBanner({ authority }: { authority: Authority }) {
  return (
    <div className={authority.movementsEnabled ? "erp-operation erp-operation-ok" : "erp-notice"} role="note">
      <strong>
        Autoridade do saldo: {authority.authority === "erp" && authority.effective ? "ERP (após corte conciliado)" : "Mercos (modo consulta)"}
      </strong>
      <span>
        {authority.movementsEnabled
          ? "Movimentos oficiais habilitados. A publicação do saldo ao Mercos continua desabilitada."
          : authority.movementsReason}
      </span>
      <small>Publicação ao Mercos: desabilitada — {authority.publishReason}</small>
    </div>
  );
}

function CommandForm<T extends Record<string, string>>({
  title,
  fields,
  initial,
  onSubmit,
  disabledReason,
  submitLabel,
  children,
}: {
  title: string;
  fields: { name: keyof T & string; label: string; inputMode?: "decimal" | "text" }[];
  initial: T;
  onSubmit: (values: T) => { path: string; body: Record<string, unknown> } | string;
  disabledReason?: string | null;
  submitLabel: string;
  children?: React.ReactNode;
}) {
  const [values, setValues] = useState<T>(initial);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState("");
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setOk("");
    const built = onSubmit(values);
    if (typeof built === "string") return setMessage(built);
    setMessage("");
    const res = await command.mutateAsync({ path: built.path, body: built.body, idempotent: true }).then(() => true).catch(() => false);
    if (res) {
      setOk("Registrado.");
      void invalidate("balances");
      void invalidate("movements");
      void invalidate("reservations");
      void invalidate("warehouses");
    }
  }
  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label={title}>
      <h3 className="erp-wide">{title}</h3>
      {disabledReason && <div className="erp-notice erp-wide"><strong>Indisponível</strong><span>{disabledReason}</span></div>}
      {fields.map((f) => (
        <label className="erp-field" key={f.name}>
          <span>{f.label}</span>
          <input inputMode={f.inputMode} value={values[f.name]} disabled={Boolean(disabledReason)}
                 onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
        </label>
      ))}
      {children}
      <CommandError error={command.error} local={message} />
      {ok && <span className="erp-muted" role="status">{ok}</span>}
      <div className="erp-form-actions">
        <button className="erp-btn erp-btn-primary" type="submit" disabled={Boolean(disabledReason) || command.isPending}>
          {command.isPending ? "Enviando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Actions({ authority }: { authority: Authority }) {
  const { can } = useErp();
  const reason = authority.movementsEnabled ? null : authority.movementsReason ?? "Movimentos oficiais desabilitados.";
  const asInt = (value: string) => Number(value.trim());
  return (
    <div className="erp-split">
      {can("inventory:adjust") && (
        <CommandForm
          title="Ajustar saldo (valor absoluto)"
          fields={[
            { name: "warehouseId", label: "ID do depósito" },
            { name: "productId", label: "ID do produto" },
            { name: "newQuantity", label: "Novo saldo", inputMode: "decimal" },
            { name: "reason", label: "Motivo" },
          ]}
          initial={{ warehouseId: "", productId: "", newQuantity: "", reason: "" }}
          disabledReason={reason}
          submitLabel="Confirmar ajuste"
          onSubmit={(v) => {
            const qty = parseQuantityInput(v.newQuantity) ?? (v.newQuantity.trim() === "0" ? "0" : null);
            if (!Number.isInteger(asInt(v.warehouseId)) || !v.warehouseId.trim()) return "Informe o depósito.";
            if (!v.productId.trim()) return "Informe o produto.";
            if (qty === null) return "Novo saldo inválido.";
            if (v.reason.trim().length < 3) return "Informe o motivo (mínimo 3 caracteres).";
            return { path: "/inventory/adjustments", body: { warehouseId: asInt(v.warehouseId), productId: v.productId.trim(), newQuantity: qty, reason: v.reason.trim() } };
          }}
        />
      )}
      {can("inventory:transfer") && (
        <CommandForm
          title="Transferir entre depósitos"
          fields={[
            { name: "fromWarehouseId", label: "Depósito de origem" },
            { name: "toWarehouseId", label: "Depósito de destino" },
            { name: "productId", label: "ID do produto" },
            { name: "quantity", label: "Quantidade", inputMode: "decimal" },
          ]}
          initial={{ fromWarehouseId: "", toWarehouseId: "", productId: "", quantity: "" }}
          disabledReason={reason}
          submitLabel="Confirmar transferência"
          onSubmit={(v) => {
            const qty = parseQuantityInput(v.quantity);
            if (!v.fromWarehouseId.trim() || !v.toWarehouseId.trim()) return "Informe origem e destino.";
            if (v.fromWarehouseId === v.toWarehouseId) return "Origem e destino devem ser diferentes.";
            if (!v.productId.trim()) return "Informe o produto.";
            if (qty === null) return "Quantidade inválida.";
            return { path: "/inventory/transfers", body: { fromWarehouseId: asInt(v.fromWarehouseId), toWarehouseId: asInt(v.toWarehouseId), productId: v.productId.trim(), quantity: qty } };
          }}
        />
      )}
      {can("inventory:adjust") && (
        <CommandForm
          title="Reservar saldo"
          fields={[
            { name: "warehouseId", label: "ID do depósito" },
            { name: "productId", label: "ID do produto" },
            { name: "quantity", label: "Quantidade", inputMode: "decimal" },
            { name: "orderId", label: "Pedido (opcional)" },
          ]}
          initial={{ warehouseId: "", productId: "", quantity: "", orderId: "" }}
          disabledReason={reason}
          submitLabel="Reservar"
          onSubmit={(v) => {
            const qty = parseQuantityInput(v.quantity);
            if (!v.warehouseId.trim()) return "Informe o depósito.";
            if (!v.productId.trim()) return "Informe o produto.";
            if (qty === null) return "Quantidade inválida.";
            return { path: "/inventory/reservations", body: { warehouseId: asInt(v.warehouseId), productId: v.productId.trim(), quantity: qty, orderId: v.orderId.trim() || null } };
          }}
        />
      )}
    </div>
  );
}

function AuthorityTab({ authority }: { authority: Authority }) {
  const { can } = useErp();
  const [reason, setReason] = useState("");
  const [reconciled, setReconciled] = useState(false);
  const [target, setTarget] = useState<"mercos" | "erp">(authority.authority);
  const [confirm, setConfirm] = useState(false);
  const command = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  const erpMove = target === "erp" && authority.authority !== "erp";
  const valid = reason.trim().length >= 3 && (target !== "erp" || reconciled);
  return (
    <section className="erp-card">
      <h3>Autoridade do saldo</h3>
      <AuthorityBanner authority={authority} />
      <p className="erp-muted">
        Corte efetuado em {formatInstant(authority.cutoverAt)} · conciliado em {formatInstant(authority.reconciledAt)}.
        Virar fonte do saldo não republica nada ao Mercos e nunca reaplica uma saída já observada lá.
      </p>
      {can("*") ? (
        <form
          className="erp-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            if (erpMove && !confirm) return setConfirm(true);
            void command
              .mutateAsync({ path: "/inventory/authority", method: "PUT", body: { authority: target, reason: reason.trim(), cutoverReconciled: reconciled } })
              .then(() => { setConfirm(false); void invalidate("authority"); void invalidate("balances"); })
              .catch(() => null);
          }}
        >
          <label className="erp-field"><span>Nova autoridade</span>
            <select value={target} onChange={(e) => { setTarget(e.target.value as "mercos" | "erp"); setConfirm(false); }}>
              <option value="mercos">Mercos (consulta)</option>
              <option value="erp">ERP (após corte)</option>
            </select></label>
          <label className="erp-field erp-wide"><span>Motivo</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
          {target === "erp" && (
            <label className="erp-field erp-wide"><span>
              <input type="checkbox" checked={reconciled} onChange={(e) => setReconciled(e.target.checked)} />{" "}
              Confirmo que o corte foi aprovado e o saldo foi conciliado com o Mercos
            </span></label>
          )}
          {confirm && (
            <div className="erp-notice erp-wide" role="alert">
              <strong>Confirmar mudança crítica</strong>
              <span>O ERP passará a ser a fonte oficial do saldo neste escopo. Efeito: movimentos de estoque oficiais serão aceitos; a publicação ao Mercos segue desabilitada.</span>
            </div>
          )}
          <CommandError error={command.error} />
          <div className="erp-form-actions">
            <button className="erp-btn erp-btn-primary" type="submit" disabled={!valid || command.isPending}>
              {confirm ? "Confirmar e aplicar" : "Alterar autoridade"}
            </button>
          </div>
        </form>
      ) : (
        <StatePanel kind="forbidden" message="Somente o administrador ERP altera a autoridade do saldo." />
      )}
    </section>
  );
}

export function InventoryPage() {
  const { can } = useErp();
  const [tab, setTab] = useState<"balances" | "movements" | "reservations" | "warehouses" | "authority">("balances");
  const authority = useErpQuery(["authority"], "/inventory/authority", authoritySchema);
  const warehouses = useErpQuery(["warehouses"], "/inventory/warehouses", warehouseList);
  const reservations = useErpQuery(["reservations"], "/inventory/reservations", reservationList, { enabled: tab === "reservations" });
  const invalidate = useInvalidateErp();
  const release = useCommand<undefined, unknown>(z.unknown());

  const balanceColumns: Column<Balance>[] = [
    { key: "product", header: "Produto", sortKey: "productId", render: (b) => <><strong>{b.productName ?? b.productId}</strong><div className="erp-muted">ID {b.productId}</div></> },
    { key: "wh", header: "Depósito", render: (b) => b.warehouseId },
    { key: "ext", header: "Saldo externo (Mercos)", render: (b) => formatQuantity(b.external.quantity) },
    { key: "onhand", header: "Operacional: físico", sortKey: "onHand", render: (b) => formatQuantity(b.operational.onHand) },
    { key: "res", header: "Reservado", render: (b) => formatQuantity(b.operational.reserved) },
    { key: "avail", header: "Disponível", render: (b) => formatQuantity(b.operational.available) },
  ];
  const movementColumns: Column<Movement>[] = [
    { key: "at", header: "Quando", sortKey: "occurredAt", render: (m) => formatInstant(m.occurredAt) },
    { key: "kind", header: "Tipo", render: (m) => KIND_LABEL[m.kind] ?? m.kind },
    { key: "product", header: "Produto", render: (m) => m.productId },
    { key: "wh", header: "Depósito", render: (m) => m.warehouseId },
    { key: "delta", header: "Variação", render: (m) => formatQuantity(m.quantityDelta) },
    { key: "res", header: "Reserva", render: (m) => formatQuantity(m.reservedDelta) },
    { key: "by", header: "Operador", render: (m) => m.operator },
    { key: "why", header: "Motivo", render: (m) => m.reason ?? "—" },
  ];

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Saldo externo do Mercos e saldo operacional do ERP ficam separados. O histórico é um razão imutável: não é editável como tabela simples."
      />
      {authority.data && <AuthorityBanner authority={authority.data} />}
      {authority.error && <StatePanel kind="error" message={(authority.error as Error).message} onRetry={() => void authority.refetch()} />}
      <Tabs
        tabs={[
          { id: "balances", label: "Saldos" },
          { id: "movements", label: "Razão de movimentos" },
          { id: "reservations", label: "Reservas" },
          { id: "warehouses", label: "Depósitos" },
          { id: "authority", label: "Autoridade" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "balances" && (
        <>
          {authority.data && <Actions authority={authority.data} />}
          <ServerList<Balance> resource="balances" path="/inventory/balances" schema={balancePage} caption="Saldos de estoque" columns={balanceColumns}
            filters={[{ name: "productId", label: "Produto (ID)", type: "text" }]} defaultSort="productId" rowKey={(b) => `${b.warehouseId}:${b.productId}`}
            emptyMessage="Nenhum saldo operacional ainda. O saldo externo aparece aqui quando houver movimento no ERP." />
        </>
      )}
      {tab === "movements" && (
        <ServerList<Movement> resource="movements" path="/inventory/movements" schema={movementPage} caption="Razão de movimentos" columns={movementColumns}
          filters={[
            { name: "productId", label: "Produto (ID)", type: "text" },
            { name: "kind", label: "Tipo", type: "select", options: Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label })) },
          ]}
          defaultSort="occurredAt" defaultOrder="desc" rowKey={(m) => m.id} emptyMessage="Nenhum movimento registrado." />
      )}
      {tab === "reservations" && (
        <section className="erp-card">
          {reservations.isLoading && <StatePanel kind="loading" />}
          {reservations.data && reservations.data.items.length === 0 && <StatePanel kind="empty" message="Nenhuma reserva." />}
          {reservations.data && reservations.data.items.length > 0 && (
            <div className="erp-table-wrap">
              <table className="erp-table">
                <thead><tr><th>#</th><th>Produto</th><th>Depósito</th><th className="num">Quantidade</th><th>Pedido</th><th>Situação</th><th /></tr></thead>
                <tbody>
                  {reservations.data.items.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td><td>{r.productId}</td><td>{r.warehouseId}</td>
                      <td className="num">{formatQuantity(r.quantity)}</td><td>{r.orderId ?? "—"}</td>
                      <td><Badge value={r.status === "active" ? "partial" : "settled"} label={r.status === "active" ? "Ativa" : "Liberada"} /></td>
                      <td>{r.status === "active" && can("inventory:adjust") && (
                        <button type="button" className="erp-btn" disabled={release.isPending}
                          onClick={() => void release.mutateAsync({ path: `/inventory/reservations/${r.id}/release` }).then(() => { void invalidate("reservations"); void invalidate("balances"); }).catch(() => null)}>
                          Liberar
                        </button>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <CommandError error={release.error} />
        </section>
      )}
      {tab === "warehouses" && (
        <>
          {can("inventory:adjust") && (
            <CommandForm
              title="Novo depósito"
              fields={[{ name: "code", label: "Código" }, { name: "name", label: "Nome" }]}
              initial={{ code: "", name: "" }}
              submitLabel="Criar depósito"
              onSubmit={(v) => (!v.code.trim() || !v.name.trim() ? "Informe código e nome." : { path: "/inventory/warehouses", body: { code: v.code.trim(), name: v.name.trim() } })}
            />
          )}
          <section className="erp-card">
            {warehouses.isLoading && <StatePanel kind="loading" />}
            {warehouses.data && warehouses.data.items.length === 0 && <StatePanel kind="empty" message="Nenhum depósito cadastrado." />}
            {warehouses.data && warehouses.data.items.length > 0 && (
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead><tr><th>ID</th><th>Código</th><th>Nome</th><th>Situação</th></tr></thead>
                  <tbody>{warehouses.data.items.map((w) => (
                    <tr key={w.id}><td>{w.id}</td><td>{w.code}</td><td>{w.name}</td><td>{w.active ? <Badge value="active" label="Ativo" /> : <Badge value="cancelled" label="Inativo" />}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      {tab === "authority" && authority.data && <AuthorityTab authority={authority.data} />}
    </>
  );
}
