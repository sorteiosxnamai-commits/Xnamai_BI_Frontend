import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { EntityDetailDrawer } from "../components/feedback/EntityDetailDrawer";
import { QueryState } from "../components/feedback/QueryState";
import { money, moneyExact, num, relativeTime, statusLabel } from "../format";
import { crmApi, type CrmLead, type CrmLeadDetail, type CrmProduct } from "./crmApi";

const SELLER_KEY = "crm-seller-name";

const SEGMENT_LABEL: Record<string, string> = {
  lead_novo: "Lead novo",
  ativo: "Ativo",
  em_risco: "Em risco",
  recuperar: "Recuperar",
};

function readSeller() {
  try {
    return localStorage.getItem(SELLER_KEY) || "";
  } catch {
    return "";
  }
}

function writeSeller(value: string) {
  try {
    localStorage.setItem(SELLER_KEY, value);
  } catch {
    /* ignore quota */
  }
}

function when(iso: string | null | undefined) {
  if (!iso) return "--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("pt-BR");
}

function statusText(status: string) {
  if (status === "in_progress") return "Em atendimento";
  if (status === "finished") return "Finalizado";
  return "Disponivel";
}

function ProductList({
  title,
  items,
  empty,
}: {
  title: string;
  items: CrmProduct[];
  empty: string;
}) {
  if (!items.length) return <p className="crm-empty">{empty}</p>;
  return (
    <section className="crm-block">
      <h3>{title}</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>Produto</th>
            <th>Qtd</th>
            <th>Valor</th>
            <th>Quando</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={`${item.productId || item.code || item.name}-${index}`}>
              <td>
                <strong>{item.name}</strong>
                <small className="muted">
                  {[item.code, item.orderNumber ? `#${item.orderNumber}` : null]
                    .filter(Boolean)
                    .join(" | ")}
                </small>
              </td>
              <td>{num(item.quantity)}</td>
              <td>{moneyExact(item.revenue ?? item.total ?? 0)}</td>
              <td>{when(item.lastDate || item.date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function LeadCard({
  lead,
  rank,
  onOpen,
}: {
  lead: CrmLead;
  rank?: number;
  onOpen: () => void;
}) {
  return (
    <button type="button" className="crm-lead-card" onClick={onOpen}>
      <div className="crm-lead-card-head">
        {rank != null && <b>{rank}</b>}
        <div>
          <strong>{lead.name}</strong>
          <small>{[lead.city, lead.state].filter(Boolean).join(" | ") || "Sem cidade"}</small>
        </div>
        <em className={`crm-pill ${lead.attendanceStatus}`}>{statusText(lead.attendanceStatus)}</em>
      </div>
      <dl>
        <div>
          <dt>Faturamento</dt>
          <dd>{money(lead.revenue)}</dd>
        </div>
        <div>
          <dt>Pedidos</dt>
          <dd>{num(lead.orders)}</dd>
        </div>
        <div>
          <dt>Ticket</dt>
          <dd>{money(lead.ticketAverage)}</dd>
        </div>
        <div>
          <dt>Ultima compra</dt>
          <dd>{lead.daysSinceLastOrder == null ? "--" : `${lead.daysSinceLastOrder} d`}</dd>
        </div>
      </dl>
      <p>
        {SEGMENT_LABEL[lead.segment] || lead.segment}
        {lead.phone ? ` | ${lead.phone}` : ""}
        {lead.claimedBy ? ` | ${lead.claimedBy}` : ""}
      </p>
      <ul>
        {(lead.lastProducts || []).slice(0, 3).map((item, index) => (
          <li key={`${item.name}-${index}`}>
            {item.name} | {num(item.quantity)} | {moneyExact(item.total)}
          </li>
        ))}
        {!lead.lastProducts?.length && <li>Sem historico de itens</li>}
      </ul>
    </button>
  );
}

function LeadDetail({
  lead,
  sellerName,
  onClaim,
  onFinish,
  busy,
  actionError,
}: {
  lead: CrmLeadDetail;
  sellerName: string;
  onClaim: () => void;
  onFinish: (notes: string) => void;
  busy: boolean;
  actionError: string;
}) {
  const [notes, setNotes] = useState(lead.notes || "");
  const extras: [string, string][] = [
    ["Razao social", lead.legalName || lead.name],
    ["Nome fantasia", lead.tradeName || "--"],
    ["Documento", lead.document || "--"],
    ["IE", lead.ie || "--"],
    ["Tipo", lead.type || "--"],
    ["Ramo", lead.branch || "--"],
    ["E-mail", lead.email || lead.extraEmail || "--"],
    ["Telefone", lead.phone || lead.extraPhone || "--"],
    ["Celular", lead.mobile || "--"],
    ["Endereco", lead.address || "--"],
    ["Bairro", lead.neighborhood || "--"],
    ["CEP", lead.zipCode || "--"],
    ["Cidade", [lead.city, lead.state].filter(Boolean).join(" / ") || "--"],
    ["Segmento", SEGMENT_LABEL[lead.segment] || lead.segment],
    ["Vendedor Mercos", lead.sellerName || "--"],
    ["Atendimento", statusText(lead.attendanceStatus)],
    ["Com quem", lead.claimedBy || "Livre"],
    ["Pegou em", when(lead.claimedAt)],
    ["Primeiro pedido", when(lead.firstOrderAt)],
    ["Ultimo pedido", when(lead.lastOrderAt)],
    ["Dias sem compra", lead.daysSinceLastOrder == null ? "--" : String(lead.daysSinceLastOrder)],
    ["Pedidos", num(lead.orders)],
    ["Faturamento", moneyExact(lead.revenue)],
    ["Ticket medio", moneyExact(lead.ticketAverage)],
    ["Cliente ativo", lead.active === false ? "Nao" : "Sim"],
    ["Bloqueado", lead.blocked ? "Sim" : "Nao"],
    ["Cadastro na origem", when(lead.createdAtSource)],
    ["Atualizado na origem", when(lead.updatedAtSource)],
  ];
  return (
    <div className="crm-detail">
      <p>
        {[lead.city, lead.state, lead.phone, lead.email].filter(Boolean).join(" | ") ||
          "Sem contato cadastrado"}
      </p>
      <div className="metric-grid compact">
        <article>
          <span>Faturamento</span>
          <strong>{money(lead.revenue)}</strong>
        </article>
        <article>
          <span>Pedidos</span>
          <strong>{num(lead.orders)}</strong>
        </article>
        <article>
          <span>Ticket medio</span>
          <strong>{money(lead.ticketAverage)}</strong>
        </article>
        <article>
          <span>Ultima compra</span>
          <strong>{relativeTime(lead.lastOrderAt)}</strong>
        </article>
      </div>
      <dl className="crm-facts">
        {extras.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <ProductList
        title="Ultimos produtos comprados"
        items={lead.lastProducts || []}
        empty="Sem ultimos produtos."
      />
      <ProductList
        title="Produtos mais comprados"
        items={lead.mostBoughtProducts || []}
        empty="Sem ranking de produtos."
      />
      <section className="crm-block">
        <h3>Historico de pedidos</h3>
        {!lead.orderHistory?.length && <p className="crm-empty">Sem pedidos.</p>}
        {(lead.orderHistory || []).map((order) => (
          <details key={order.id} className="crm-order">
            <summary>
              <strong>#{order.number || order.id}</strong>
              <span>{statusLabel(order.status)}</span>
              <span>{when(order.date)}</span>
              <span>{moneyExact(order.total)}</span>
              <span>{order.sellerName || "--"}</span>
            </summary>
            <ul>
              {order.items.map((item, index) => (
                <li key={`${item.name}-${index}`}>
                  {item.name} | {num(item.quantity)} x {moneyExact(item.unitPrice || 0)} ={" "}
                  {moneyExact(item.total)}
                  {item.stock != null ? ` | estoque ${num(item.stock)}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
      <section className="crm-actions">
        <label>
          Observacao do atendimento
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
        </label>
        <div>
          <button type="button" className="row-action-solid" disabled={busy || !sellerName.trim()} onClick={onClaim}>
            Pegar lead
          </button>
          <button
            type="button"
            className="row-action"
            disabled={busy || !sellerName.trim()}
            onClick={() => onFinish(notes)}
          >
            Finalizar atendimento
          </button>
        </div>
        {actionError && <div className="login-error">{actionError}</div>}
        {!sellerName.trim() && <small>Informe seu nome no topo da lista para atender.</small>}
      </section>
    </div>
  );
}

export function CrmLeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [sellerName, setSellerName] = useState(readSeller);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const leadsQuery = useQuery({
    queryKey: ["crm-leads", search],
    queryFn: () => crmApi.leads(search, 20),
    retry: false,
  });
  const detailQuery = useQuery({
    queryKey: ["crm-lead", selectedId],
    queryFn: () => crmApi.lead(selectedId as string),
    enabled: Boolean(selectedId),
  });

  const claimMutation = useMutation({
    mutationFn: () => crmApi.claim(selectedId as string, sellerName.trim()),
    onSuccess: (detail) => {
      queryClient.setQueryData(["crm-lead", selectedId], detail);
      void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    },
  });
  const finishMutation = useMutation({
    mutationFn: (notes: string) => crmApi.finish(selectedId as string, sellerName.trim(), notes),
    onSuccess: () => {
      setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] });
    },
  });

  const data = leadsQuery.data;
  const busy = claimMutation.isPending || finishMutation.isPending;
  const actionError = claimMutation.error || finishMutation.error;

  const preview = useMemo(() => {
    if (!data || !selectedId) return null;
    return [...data.top, ...data.queue].find((lead) => lead.id === selectedId) || null;
  }, [data, selectedId]);

  return (
    <div className="page-stack crm-leads">
      <section className="module-card crm-toolbar">
        <label>
          Seu nome (vendedor)
          <input
            value={sellerName}
            onChange={(event) => {
              setSellerName(event.target.value);
              writeSeller(event.target.value);
            }}
            placeholder="Ex.: Ana Souza"
          />
        </label>
        <label>
          Buscar lead
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, cidade, telefone, documento"
          />
        </label>
        <p>
          {data
            ? `${num(data.count)} na fila | ${num(data.open)} livres | ${num(data.inProgress)} em atendimento`
            : leadsQuery.isError
              ? "Nao foi possivel carregar a fila"
              : "Carregando fila..."}
        </p>
      </section>

      <QueryState
        loading={leadsQuery.isLoading}
        error={leadsQuery.error instanceof Error ? leadsQuery.error : null}
        onRetry={() => void leadsQuery.refetch()}
      />

      {data && (
        <>
          <section>
            <div className="module-heading">
              <div>
                <h2>Top 20</h2>
                <p>Maiores faturamentos ainda disponiveis para atendimento.</p>
              </div>
            </div>
            <div className="crm-lead-grid">
              {data.top.map((lead, index) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  rank={index + 1}
                  onOpen={() => setSelectedId(lead.id)}
                />
              ))}
              {!data.top.length && <p className="crm-empty">Nenhum lead no Top 20.</p>}
            </div>
          </section>
          <section>
            <div className="module-heading">
              <div>
                <h2>Fila</h2>
                <p>
                  Demais clientes fora do Top 20. Quem finalizar o atendimento sai da lista.
                  {data.hidden ? ` Mais ${data.hidden} fora desta tela - use a busca.` : ""}
                </p>
              </div>
            </div>
            <div className="crm-lead-grid">
              {data.queue.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedId(lead.id)} />
              ))}
              {!data.queue.length && <p className="crm-empty">Fila vazia alem do Top 20.</p>}
            </div>
          </section>
        </>
      )}

      {selectedId && (
        <EntityDetailDrawer
          title={detailQuery.data?.name || preview?.name || "Lead"}
          loading={detailQuery.isLoading}
          error={detailQuery.error instanceof Error ? detailQuery.error : null}
          onClose={() => setSelectedId(null)}
          onRetry={() => void detailQuery.refetch()}
        >
          {detailQuery.data && (
            <LeadDetail
              lead={detailQuery.data}
              sellerName={sellerName}
              busy={busy}
              actionError={actionError instanceof Error ? actionError.message : ""}
              onClaim={() => claimMutation.mutate()}
              onFinish={(notes) => finishMutation.mutate(notes)}
            />
          )}
        </EntityDetailDrawer>
      )}
    </div>
  );
}
