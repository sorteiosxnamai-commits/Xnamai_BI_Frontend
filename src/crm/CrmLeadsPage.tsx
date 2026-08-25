import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { EntityDetailDrawer } from "../components/feedback/EntityDetailDrawer";
import { QueryState } from "../components/feedback/QueryState";
import { money, moneyExact, num, relativeTime, statusLabel } from "../format";
import { crmApi, type CrmLead, type CrmLeadAnalysisResponse, type CrmLeadDetail, type CrmProduct } from "./crmApi";

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
  showAi = false,
}: {
  lead: CrmLead;
  rank?: number;
  onOpen: () => void;
  showAi?: boolean;
}) {
  return (
    <button type="button" className="crm-lead-card" onClick={onOpen}>
      <div className="crm-lead-card-head">
        {rank != null && <b>{rank}</b>}
        <div>
          <strong>{lead.name}</strong>
          <small>{[lead.city, lead.state].filter(Boolean).join(" | ") || "Sem cidade"}</small>
        </div>
        {showAi && lead.aiScore != null ? (
          <em className="crm-ai-score" title={lead.aiReason || undefined}>
            {Math.round(lead.aiScore)}
          </em>
        ) : (
          <em className={`crm-pill ${lead.attendanceStatus}`}>{statusText(lead.attendanceStatus)}</em>
        )}
      </div>
      {showAi && lead.aiReason && <p className="crm-ai-reason">{lead.aiReason}</p>}
      <dl>
        <div>
          <dt>Faturamento</dt>
          <dd>{moneyExact(lead.revenue)}</dd>
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

function LeadAnalysis({
  data,
  loading,
  error,
  onRetry,
  onRefresh,
  refreshing,
}: {
  data: CrmLeadAnalysisResponse | undefined;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (loading) {
    return (
      <section className="crm-block crm-analysis">
        <h3>Analise com IA</h3>
        <p className="crm-empty">Gerando analise do cliente (pode levar ate 1 minuto)...</p>
      </section>
    );
  }
  if (error) {
    return (
      <section className="crm-block crm-analysis">
        <h3>Analise com IA</h3>
        <p className="login-error">{error.message}</p>
        <button type="button" className="row-action" onClick={onRetry}>
          Tentar novamente
        </button>
      </section>
    );
  }
  if (!data) return null;

  const { contact, analysis, cached, generatedAt } = data;
  return (
    <section className="crm-block crm-analysis">
      <div className="crm-analysis-head">
        <h3>Analise com IA</h3>
        <div className="crm-analysis-actions">
          {cached && <small className="muted">Cache {when(generatedAt)}</small>}
          <button type="button" className="row-action" disabled={refreshing} onClick={onRefresh}>
            {refreshing ? "Atualizando..." : "Atualizar analise"}
          </button>
        </div>
      </div>
      <div className="crm-analysis-contact">
        {contact.whatsappUrl ? (
          <a href={contact.whatsappUrl} target="_blank" rel="noreferrer" className="row-action-solid">
            Abrir WhatsApp
          </a>
        ) : (
          <span className="crm-empty">WhatsApp nao disponivel no cadastro</span>
        )}
        {contact.phone && <span>{contact.phone}</span>}
        {contact.email && <span>{contact.email}</span>}
      </div>
      {analysis.companyProfile && (
        <p>
          <strong>Perfil:</strong> {analysis.companyProfile}
        </p>
      )}
      <dl className="crm-facts compact">
        {analysis.sector && (
          <div>
            <dt>Ramo</dt>
            <dd>{analysis.sector}</dd>
          </div>
        )}
        {analysis.website && (
          <div>
            <dt>Site</dt>
            <dd>
              <a href={analysis.website} target="_blank" rel="noreferrer">
                {analysis.website}
              </a>
            </dd>
          </div>
        )}
        {analysis.confidence && (
          <div>
            <dt>Confianca</dt>
            <dd>{analysis.confidence}</dd>
          </div>
        )}
      </dl>
      {!!analysis.publicProducts?.length && (
        <>
          <h4>Produtos publicos</h4>
          <ul className="crm-analysis-list">
            {analysis.publicProducts.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {!!analysis.purchasePreferences?.length && (
        <>
          <h4>Preferencias (historico)</h4>
          <ul className="crm-analysis-list">
            {analysis.purchasePreferences.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {analysis.approachStrategy && (
        <>
          <h4>Melhor abordagem</h4>
          <p>{analysis.approachStrategy}</p>
        </>
      )}
      {analysis.openingMessage && (
        <>
          <h4>Mensagem sugerida (WhatsApp)</h4>
          <blockquote className="crm-analysis-message">{analysis.openingMessage}</blockquote>
        </>
      )}
      {!!analysis.talkingPoints?.length && (
        <>
          <h4>Pontos de conversa</h4>
          <ul className="crm-analysis-list">
            {analysis.talkingPoints.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {!!analysis.risksOrCautions?.length && (
        <>
          <h4>Cuidados</h4>
          <ul className="crm-analysis-list">
            {analysis.risksOrCautions.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </>
      )}
      {!!analysis.sources?.length && (
        <>
          <h4>Fontes publicas</h4>
          <ul className="crm-analysis-sources">
            {analysis.sources.map((source) => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.title || source.url}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function LeadDetail({
  lead,
  defaultSeller,
  onSellerChange,
  onStartFocus,
  onFinish,
  onDiscard,
  busy,
  actionError,
  analysisData,
  analysisLoading,
  analysisError,
  onAnalysisRetry,
  onAnalysisRefresh,
  analysisRefreshing,
}: {
  lead: CrmLeadDetail;
  defaultSeller: string;
  onSellerChange: (value: string) => void;
  onStartFocus: (sellerName: string) => void;
  onFinish: (payload: {
    sellerName: string;
    outcome: "won" | "lost";
    notes?: string;
    saleValue?: number;
    orderNumber?: string;
  }) => void;
  onDiscard: (payload: { sellerName: string; notes: string }) => void;
  busy: boolean;
  actionError: string;
  analysisData: CrmLeadAnalysisResponse | undefined;
  analysisLoading: boolean;
  analysisError: Error | null;
  onAnalysisRetry: () => void;
  onAnalysisRefresh: () => void;
  analysisRefreshing: boolean;
}) {
  const inFocus = lead.attendanceStatus === "in_progress";
  const [sellerName, setSellerName] = useState(lead.claimedBy || defaultSeller);
  const [outcome, setOutcome] = useState<"won" | "lost">("won");
  const [saleValue, setSaleValue] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [notes, setNotes] = useState(lead.notes || "");

  useEffect(() => {
    setSellerName(lead.claimedBy || defaultSeller);
    setNotes(lead.notes || "");
    setSaleValue("");
    setOrderNumber("");
    setOutcome("won");
  }, [lead.id, lead.claimedBy, lead.notes, defaultSeller]);

  const updateSeller = (value: string) => {
    setSellerName(value);
  };

  const commitSeller = (value: string) => {
    onSellerChange(value);
  };

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
    <div className={`crm-detail${inFocus ? " crm-detail-focus" : ""}`}>
      <section className="crm-focus-bar">
        <div>
          <h3>{inFocus ? "Atendimento em foco" : "Preparar atendimento"}</h3>
          <p>
            {inFocus
              ? "Registre o resultado ao encerrar ou descarte o lead com motivo."
              : "Informe o vendedor e inicie para entrar no modo foco neste cliente."}
          </p>
        </div>
        <label>
          Vendedor responsavel
          <input
            value={sellerName}
            onChange={(event) => updateSeller(event.target.value)}
            onBlur={(event) => commitSeller(event.target.value)}
            placeholder="Ex.: Ana Souza"
            disabled={inFocus && Boolean(lead.claimedBy)}
          />
        </label>
        {!inFocus && (
          <button
            type="button"
            className="row-action-solid"
            disabled={busy || !sellerName.trim()}
            onClick={() => onStartFocus(sellerName.trim())}
          >
            Iniciar atendimento
          </button>
        )}
        {inFocus && <span className="crm-focus-badge">Em atendimento</span>}
      </section>
      <p>
        {[lead.city, lead.state, lead.phone, lead.email].filter(Boolean).join(" | ") ||
          "Sem contato cadastrado"}
      </p>
      <div className="metric-grid compact">
        <article>
          <span>Faturamento</span>
          <strong>{moneyExact(lead.revenue)}</strong>
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
      <LeadAnalysis
        data={analysisData}
        loading={analysisLoading}
        error={analysisError}
        onRetry={onAnalysisRetry}
        onRefresh={onAnalysisRefresh}
        refreshing={analysisRefreshing}
      />
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
      {inFocus && (
        <section className="crm-actions crm-outcome-panel">
          <h3>Encerrar atendimento</h3>
          <div className="crm-outcome-options">
            <label>
              <input
                type="radio"
                name={`outcome-${lead.id}`}
                checked={outcome === "won"}
                onChange={() => setOutcome("won")}
              />
              Gerou venda
            </label>
            <label>
              <input
                type="radio"
                name={`outcome-${lead.id}`}
                checked={outcome === "lost"}
                onChange={() => setOutcome("lost")}
              />
              Sem venda
            </label>
          </div>
          {outcome === "won" && (
            <div className="crm-outcome-fields">
              <label>
                Valor da venda (R$)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={saleValue}
                  onChange={(event) => setSaleValue(event.target.value)}
                  placeholder="0,00"
                />
              </label>
              <label>
                Numero do pedido
                <input
                  value={orderNumber}
                  onChange={(event) => setOrderNumber(event.target.value)}
                  placeholder="Ex.: 89047"
                />
              </label>
            </div>
          )}
          <label>
            Observacao do atendimento
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder={
                outcome === "won"
                  ? "Detalhes da negociacao, produtos ofertados..."
                  : "Motivo de nao ter fechado, proximo passo..."
              }
            />
          </label>
          <div className="crm-action-row">
            <button
              type="button"
              className="row-action-solid"
              disabled={busy || !sellerName.trim()}
              onClick={() =>
                onFinish({
                  sellerName: sellerName.trim(),
                  outcome,
                  notes: notes.trim() || undefined,
                  saleValue: outcome === "won" ? Number.parseFloat(saleValue.replace(",", ".")) : undefined,
                  orderNumber: outcome === "won" ? orderNumber.trim() || undefined : undefined,
                })
              }
            >
              Concluir atendimento
            </button>
            <button
              type="button"
              className="row-action crm-discard-btn"
              disabled={busy || !sellerName.trim() || !notes.trim()}
              onClick={() =>
                onDiscard({
                  sellerName: sellerName.trim(),
                  notes: notes.trim(),
                })
              }
            >
              Descartar lead
            </button>
          </div>
          {!notes.trim() && (
            <small className="muted">Para descartar, informe o motivo na observacao.</small>
          )}
          {actionError && <div className="login-error">{actionError}</div>}
        </section>
      )}
      {!inFocus && actionError && <div className="login-error">{actionError}</div>}
    </div>
  );
}

export function CrmLeadsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"main" | "new" | "ai">("main");
  const [queuePage, setQueuePage] = useState(1);
  const [queueItems, setQueueItems] = useState<CrmLead[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sellerName, setSellerName] = useState(readSeller);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshAi, setRefreshAi] = useState(false);

  useEffect(() => {
    setQueuePage(1);
    setQueueItems([]);
    setHasMore(false);
    setRefreshAi(false);
  }, [search, view]);

  const leadsQuery = useQuery({
    queryKey: ["crm-leads", search, view, refreshAi],
    queryFn: () =>
      crmApi.leads({
        search,
        top: 20,
        view,
        queuePage: 1,
        refreshAi: view === "ai" && refreshAi,
      }),
    retry: false,
  });

  useEffect(() => {
    if (!refreshAi || leadsQuery.isFetching || !leadsQuery.data) return;
    setRefreshAi(false);
  }, [refreshAi, leadsQuery.isFetching, leadsQuery.data]);

  const pageData = leadsQuery.data;

  useEffect(() => {
    if (!pageData) return;
    setQueueItems(pageData.queue);
    setQueuePage(1);
    setHasMore(pageData.hasMore ?? false);
  }, [pageData]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = queuePage + 1;
      const next = await crmApi.leads({
        search,
        top: 20,
        view,
        queuePage: nextPage,
      });
      setQueueItems((current) => {
        const known = new Set(current.map((lead) => lead.id));
        const extra = next.queue.filter((lead) => !known.has(lead.id));
        return extra.length ? [...current, ...extra] : current;
      });
      setQueuePage(nextPage);
      setHasMore(next.hasMore ?? false);
    } finally {
      setLoadingMore(false);
    }
  };

  const detailQuery = useQuery({
    queryKey: ["crm-lead", selectedId],
    queryFn: () => crmApi.lead(selectedId as string),
    enabled: Boolean(selectedId),
  });
  const [analysisRefreshToken, setAnalysisRefreshToken] = useState(0);
  useEffect(() => {
    setAnalysisRefreshToken(0);
  }, [selectedId]);
  const analysisQuery = useQuery({
    queryKey: ["crm-lead-analysis", selectedId, analysisRefreshToken],
    queryFn: () => crmApi.analyzeLead(selectedId as string, analysisRefreshToken > 0),
    enabled: Boolean(selectedId),
    staleTime: 1000 * 60 * 60,
    retry: false,
  });

  const claimMutation = useMutation({
    mutationFn: (seller: string) => crmApi.claim(selectedId as string, seller),
    onSuccess: (detail) => {
      queryClient.setQueryData(["crm-lead", selectedId], detail);
      void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    },
  });
  const finishMutation = useMutation({
    mutationFn: (payload: Parameters<typeof crmApi.finish>[1]) =>
      crmApi.finish(selectedId as string, payload),
    onSuccess: () => {
      setSelectedId(null);
      setQueuePage(1);
      setQueueItems([]);
      setHasMore(false);
      void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] });
    },
  });

  const busy = claimMutation.isPending || finishMutation.isPending;
  const actionError = claimMutation.error || finishMutation.error;

  const preview = useMemo(() => {
    if (!pageData || !selectedId) return null;
    return [...pageData.top, ...queueItems].find((lead) => lead.id === selectedId) || null;
  }, [pageData, queueItems, selectedId]);

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
          {pageData
            ? view === "new"
              ? `${num(pageData.count)} sem compra | ${num(pageData.open)} livres | ${num(pageData.inProgress)} em atendimento`
              : view === "ai"
                ? `${num(pageData.count)} compradores | ${num(pageData.aiScored ?? 0)} priorizados pela IA${
                    pageData.aiPending ? ` | ${num(pageData.aiPending)} aguardando analise` : ""
                  } | ${num(pageData.open)} livres`
                : `${num(pageData.count)} na fila | ${num(pageData.open)} livres | ${num(pageData.inProgress)} em atendimento${
                    pageData.newCount ? ` | ${num(pageData.newCount)} nunca compraram` : ""
                  }`
            : leadsQuery.isError
              ? "Nao foi possivel carregar a fila"
              : "Carregando fila..."}
        </p>
        <div className="crm-view-tabs" role="tablist" aria-label="Visao da fila">
          <button
            type="button"
            role="tab"
            aria-selected={view === "main"}
            className={view === "main" ? "active" : ""}
            onClick={() => setView("main")}
          >
            Fila principal
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "new"}
            className={view === "new" ? "active" : ""}
            onClick={() => setView("new")}
          >
            Leads novos
            {pageData?.newCount != null ? ` (${num(pageData.newCount)})` : ""}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "ai"}
            className={view === "ai" ? "active" : ""}
            onClick={() => setView("ai")}
          >
            Selecao IA
          </button>
        </div>
      </section>

      <QueryState
        loading={leadsQuery.isLoading && queuePage === 1}
        error={leadsQuery.error instanceof Error ? leadsQuery.error : null}
        onRetry={() => void leadsQuery.refetch()}
      />

      {pageData && view === "main" && (
        <>
          <section>
            <div className="module-heading">
              <div>
                <h2>Top 20</h2>
                <p>Alto faturamento e mais tempo sem comprar - maior potencial de recuperacao.</p>
              </div>
            </div>
            <div className="crm-lead-grid">
              {pageData.top.map((lead, index) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  rank={index + 1}
                  onOpen={() => setSelectedId(lead.id)}
                />
              ))}
              {!pageData.top.length && <p className="crm-empty">Nenhum lead no Top 20.</p>}
            </div>
          </section>
          <section>
            <div className="module-heading">
              <div>
                <h2>Fila</h2>
                <p>
                  Demais clientes fora do Top 20. Quem finalizar o atendimento sai da lista.
                  {pageData.queueTotal
                    ? ` Mostrando ${num(queueItems.length)} de ${num(pageData.queueTotal)}.`
                    : ""}
                </p>
              </div>
            </div>
            <div className="crm-lead-grid">
              {queueItems.map((lead) => (
                <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedId(lead.id)} />
              ))}
              {!queueItems.length && <p className="crm-empty">Fila vazia alem do Top 20.</p>}
            </div>
            {hasMore && (
              <div className="crm-load-more">
                <button
                  type="button"
                  className="row-action"
                  disabled={loadingMore}
                  onClick={() => void loadMore()}
                >
                  {loadingMore ? "Carregando..." : "Carregar mais"}
                </button>
              </div>
            )}
          </section>
        </>
      )}

      {pageData && view === "new" && (
        <section>
          <div className="module-heading">
            <div>
              <h2>Leads novos</h2>
              <p>Clientes cadastrados que nunca compraram. Ordenados do cadastro mais recente.</p>
            </div>
          </div>
          <div className="crm-lead-grid">
            {queueItems.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onOpen={() => setSelectedId(lead.id)} />
            ))}
            {!queueItems.length && <p className="crm-empty">Nenhum lead sem compra encontrado.</p>}
          </div>
          {hasMore && (
            <div className="crm-load-more">
              <button
                type="button"
                className="row-action"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Carregando..." : "Carregar mais"}
              </button>
            </div>
          )}
        </section>
      )}

      {pageData && view === "ai" && (
        <section>
          <div className="module-heading">
            <div>
              <h2>Selecao IA</h2>
              <p>
                Clientes com historico de compra priorizados pela IA (faturamento, recencia, frequencia,
                segmento e mix de produtos). Maior pontuacao = maior chance de recompra agora.
                {pageData.aiPending
                  ? ` Analisando em lotes de 40 - ${num(pageData.aiPending)} ainda na fila de analise.`
                  : ""}
              </p>
            </div>
            <button
              type="button"
              className="row-action"
              disabled={leadsQuery.isFetching}
              onClick={() => {
                setQueuePage(1);
                setQueueItems([]);
                setHasMore(false);
                setRefreshAi(true);
                void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
              }}
            >
              {leadsQuery.isFetching ? "Analisando..." : "Reanalisar lote"}
            </button>
          </div>
          <div className="crm-lead-grid">
            {queueItems.map((lead, index) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                rank={index + 1}
                showAi
                onOpen={() => setSelectedId(lead.id)}
              />
            ))}
            {!queueItems.length && (
              <p className="crm-empty">
                {leadsQuery.isFetching
                  ? "A IA esta analisando o primeiro lote de clientes..."
                  : "Nenhum comprador encontrado para priorizar."}
              </p>
            )}
          </div>
          {hasMore && (
            <div className="crm-load-more">
              <button
                type="button"
                className="row-action"
                disabled={loadingMore}
                onClick={() => void loadMore()}
              >
                {loadingMore ? "Carregando..." : "Carregar mais"}
              </button>
            </div>
          )}
        </section>
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
              defaultSeller={sellerName}
              onSellerChange={(value) => {
                setSellerName(value);
                writeSeller(value);
              }}
              busy={busy}
              actionError={actionError instanceof Error ? actionError.message : ""}
              onStartFocus={(name) => claimMutation.mutate(name)}
              onFinish={(payload) => finishMutation.mutate(payload)}
              onDiscard={(payload) =>
                finishMutation.mutate({
                  sellerName: payload.sellerName,
                  outcome: "discarded",
                  notes: payload.notes,
                })
              }
              analysisData={analysisQuery.data}
              analysisLoading={analysisQuery.isLoading}
              analysisError={analysisQuery.error instanceof Error ? analysisQuery.error : null}
              onAnalysisRetry={() => void analysisQuery.refetch()}
              onAnalysisRefresh={() => setAnalysisRefreshToken((token) => token + 1)}
              analysisRefreshing={analysisQuery.isFetching && analysisRefreshToken > 0}
            />
          )}
        </EntityDetailDrawer>
      )}
    </div>
  );
}
