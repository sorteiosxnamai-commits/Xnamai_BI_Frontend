import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { ZodType } from "zod";
import { useErp } from "../../auth/context";
import { orderSchema, pageOf, type Order, type Page } from "../../api/schemas";
import { ServerList, type Column, type FilterDef } from "../../components/ServerList";
import { Badge, CapabilityNotice, PageHeader } from "../../components/ui";
import { formatDay, formatInstant, formatMoney } from "../../format";

const schema = pageOf(orderSchema) as unknown as ZodType<Page<Order>>;

const KIND_LABEL: Record<string, string> = {
  order: "Pedido",
  quote: "Orçamento",
  cancelled: "Cancelado",
  unknown: "Status não reconhecido",
};

export function StatusChips({ order }: { order: Pick<Order, "statuses" | "kind"> }) {
  const s = order.statuses;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      <span className="erp-badge" title="Status comercial (origem)">Comercial: {s.commercial ?? "—"}</span>
      <span className="erp-badge" title="Faturamento">Faturamento: {s.billing ?? "—"}</span>
      <span className="erp-badge" title="Atendimento/expedição (ERP)">Atendimento: {s.fulfillment ?? "—"}</span>
      <span className="erp-badge" title="Pagamento">Pagamento: {s.payment ?? "—"}</span>
    </div>
  );
}

const COLUMNS: Column<Order>[] = [
  { key: "number", header: "Número", sortKey: "number", render: (o) => <strong>{o.number ?? o.id}</strong> },
  {
    key: "kind",
    header: "Tipo",
    render: (o) => (
      <Badge value={o.kind === "cancelled" ? "cancelled" : o.kind === "unknown" ? "unknown" : "active"} label={KIND_LABEL[o.kind] ?? o.kind} />
    ),
  },
  { key: "customer", header: "Cliente", render: (o) => o.customerName ?? o.customerId ?? "—" },
  { key: "issued", header: "Emissão", sortKey: "issuedAt", render: (o) => (o.issueDate ? formatDay(o.issueDate) : formatInstant(o.issuedAt)) },
  { key: "total", header: "Total líquido", sortKey: "netTotal", render: (o) => formatMoney(o.netTotal) },
  { key: "statuses", header: "Estados", render: (o) => <StatusChips order={o} /> },
  {
    key: "items",
    header: "Itens",
    render: (o) =>
      o.itemsComplete ? `${o.itemCount ?? 0}` : <Badge value="partial" label="Incompleto" />,
  },
];

const FILTERS: FilterDef[] = [
  { name: "search", label: "Número", type: "text", placeholder: "Número do pedido" },
  {
    name: "kind",
    label: "Tipo",
    type: "select",
    options: [
      { value: "order", label: "Pedidos" },
      { value: "quote", label: "Orçamentos" },
      { value: "cancelled", label: "Cancelados" },
    ],
  },
  {
    name: "itemsComplete",
    label: "Itens",
    type: "select",
    options: [
      { value: "true", label: "Completos" },
      { value: "false", label: "Incompletos" },
    ],
  },
];

export function OrdersPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { can, capability } = useErp();
  const customerId = params.get("customerId") ?? undefined;
  const cap = capability("write.orders");
  const canWrite = can("orders:write") && Boolean(cap?.enabled);
  return (
    <>
      <PageHeader
        title="Pedidos e orçamentos"
        subtitle="Status comercial, faturamento, atendimento e pagamento são estados separados. Pedidos sem itens completos ficam marcados e bloqueiam operações dependentes."
        actions={
          canWrite ? (
            <Link className="erp-btn erp-btn-primary" to="/erp/pedidos/novo">
              Novo pedido
            </Link>
          ) : null
        }
      />
      {can("orders:write") && <CapabilityNotice capability={cap} />}
      {customerId && (
        <div className="erp-notice">
          <strong>Filtrando pelo cliente {customerId}</strong>
          <Link to="/erp/pedidos">Limpar filtro</Link>
        </div>
      )}
      <ServerList<Order>
        resource="orders"
        path="/sales-orders"
        schema={schema}
        caption="Pedidos e orçamentos"
        columns={COLUMNS}
        filters={FILTERS}
        fixedParams={{ customerId }}
        defaultSort="issuedAt"
        defaultOrder="desc"
        rowKey={(o) => o.id}
        onRowOpen={(o) => navigate(`/erp/pedidos/${encodeURIComponent(o.id)}`)}
        emptyMessage="Nenhum pedido no espelho. Se a sincronização ainda não rodou, veja Integrações."
      />
    </>
  );
}
