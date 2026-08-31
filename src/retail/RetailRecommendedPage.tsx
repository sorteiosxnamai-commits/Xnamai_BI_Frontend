import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { EntityDetailDrawer } from "../components/feedback/EntityDetailDrawer";
import { retailApi, type RetailChannel, type RetailProduct } from "./retailApi";

function money(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pct(value?: number | null) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

function platformClass(platform?: string) {
  switch (platform) {
    case "mercado_livre":
      return "retail-badge ml";
    case "shopee":
      return "retail-badge shopee";
    case "tiktok":
      return "retail-badge tiktok";
    case "nuvemshop":
      return "retail-badge nuvem";
    default:
      return "retail-badge site";
  }
}

function ChannelTable({ channels }: { channels?: RetailChannel[] }) {
  if (!channels?.length) return <p className="retail-empty">Sem comparativo de canais.</p>;
  return (
    <div className="retail-table-wrap">
      <table className="retail-table">
        <thead>
          <tr>
            <th>Canal</th>
            <th>Preco anunciado</th>
            <th>Vendedores</th>
            <th>Taxa</th>
            <th>Frete</th>
            <th>Margem</th>
          </tr>
        </thead>
        <tbody>
          {channels.map((row) => {
            const listings = (row.listings || []).filter((item) => item.price != null);
            return (
              <tr key={row.platform}>
                <td>{row.label}</td>
                <td>
                  {row.hasPrice === false || row.retailPrice == null ? (
                    <span className="retail-muted">Sem anuncio encontrado</span>
                  ) : row.url ? (
                    <a href={row.url} target="_blank" rel="noreferrer">
                      {money(row.retailPrice)}
                    </a>
                  ) : (
                    money(row.retailPrice)
                  )}
                </td>
                <td>
                  {listings.length > 0 ? (
                    <ul className="retail-sellers">
                      {listings.slice(0, 4).map((item) => (
                        <li key={`${item.seller}-${item.price}-${item.url || ""}`}>
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer">
                              {item.seller || "Vendedor"}
                            </a>
                          ) : (
                            <span>{item.seller || "Vendedor"}</span>
                          )}
                          <em>{money(item.price)}</em>
                        </li>
                      ))}
                      {listings.length > 4 && (
                        <li className="retail-muted">+{listings.length - 4} outros</li>
                      )}
                    </ul>
                  ) : (
                    row.seller || row.source || "-"
                  )}
                </td>
                <td>
                  {row.fee == null ? "-" : `${pct(row.feePct)} (${money(row.fee)})`}
                </td>
                <td>{row.freight == null ? "-" : money(row.freight)}</td>
                <td>
                  {row.marginPct == null || row.netMargin == null
                    ? "-"
                    : `${pct(row.marginPct)} / ${money(row.netMargin)}`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProductDetail({
  product,
  loading,
  onRefresh,
  refreshing,
}: {
  product?: RetailProduct | null;
  loading: boolean;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  if (loading && !product) {
    return <p className="retail-empty">Carregando analise...</p>;
  }
  if (!product) {
    return <p className="retail-empty">Produto nao encontrado.</p>;
  }
  const best = product.channels?.find((row) => row.hasPrice !== false && row.retailPrice != null)
    || product.channels?.[0];
  return (
    <div className="retail-detail">
      <section className="retail-block">
        <div className="retail-detail-head">
          <div>
            <span className={platformClass(product.melhorPlataforma)}>
              {product.melhorPlataformaLabel}
            </span>
            <h3>{product.name}</h3>
            <p>
              Codigo {product.code || "-"} ? Score {product.recomendacaoScore.toFixed(1)}
              {product.rank ? ` ? Rank #${product.rank}` : ""}
            </p>
          </div>
          <button type="button" className="row-action" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? "Atualizando..." : "Atualizar analise"}
          </button>
        </div>
      </section>

      <section className="retail-block">
        <h4>Por que foi escolhido</h4>
        <p className="retail-why">{product.motivoCurto}</p>
        {!!product.motivos?.length && (
          <ul className="retail-reasons">
            {product.motivos.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="retail-block">
        <h4>Plataforma indicada</h4>
        <p>
          <strong>{product.melhorPlataformaLabel}</strong>
          {product.porquePlataforma ? ` - ${product.porquePlataforma}` : ""}
        </p>
        {product.porqueCanalDetalhe && (
          <p className="retail-why">{product.porqueCanalDetalhe}</p>
        )}
        <p className="retail-muted">
          Envio: {product.melhorEnvioLabel || product.melhorEnvio || "-"}
          {product.packUnits ? ` ? SKU com ${product.packUnits} unidade(s)` : ""}
        </p>
        {!!product.comparativoCanais?.length && (
          <ul className="retail-channel-why">
            {product.comparativoCanais.map((row) => (
              <li key={String(row.plataforma || row.label)}>
                <strong>{String(row.label || row.plataforma)}</strong>
                {row.veredito ? ` (${row.veredito})` : ""}
                {!!row.pros?.length && <span> Pros: {row.pros.join("; ")}</span>}
                {!!row.contras?.length && <span> Contras: {row.contras.join("; ")}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="retail-block">
        <h4>Precos por plataforma (mesmo produto)</h4>
        <p className="retail-muted">
          Busca em paralelo com varios vendedores por canal. Custo de compra = preco de tabela Mercos.
          O preco usado na margem e a mediana dos anuncios validos (evita outlier).
        </p>
        <ChannelTable channels={product.channels} />
      </section>

      <section className="retail-block">
        <h4>Breakdown financeiro (melhor canal com preco real)</h4>
        {!best && <p className="retail-empty">Sem breakdown - nenhum anuncio real encontrado ainda.</p>}
        {best && (
          <dl className="retail-facts">
            <div>
              <dt>Preco varejo (anuncio)</dt>
              <dd>{money(best.retailPrice)}</dd>
            </div>
            <div>
              <dt>Custo (preco tabela Mercos)</dt>
              <dd>{money(best.cost)}</dd>
            </div>
            <div>
              <dt>Taxa canal</dt>
              <dd>
                {money(best.fee)} ({pct(best.feePct)})
              </dd>
            </div>
            <div>
              <dt>Frete</dt>
              <dd>{money(best.freight)}</dd>
            </div>
            <div>
              <dt>Embalagem</dt>
              <dd>{money(best.packaging)}</dd>
            </div>
            <div>
              <dt>Margem liquida</dt>
              <dd>
                {money(best.netMargin)} ({pct(best.marginPct)})
              </dd>
            </div>
            <div>
              <dt>Vendedor / fonte</dt>
              <dd>{best.seller || best.source || "-"}</dd>
            </div>
            <div>
              <dt>Estoque</dt>
              <dd>{product.stock ?? "-"}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="retail-block">
        <h4>Fontes e confianca</h4>
        <p className="retail-muted">Confianca: {product.confidence || "-"}</p>
        {!product.sources?.length && <p className="retail-empty">Sem fontes publicas.</p>}
        {!!product.sources?.length && (
          <ul className="retail-sources">
            {product.sources.map((source) => (
              <li key={source.url || source.title}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noreferrer">
                    {source.title || source.url}
                  </a>
                ) : (
                  source.title
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function RetailRecommendedPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [autoResumeTried, setAutoResumeTried] = useState(false);

  const jobStatus = useQuery({
    queryKey: ["retail-job"],
    queryFn: () => retailApi.jobStatus(),
    refetchInterval: (query) => (query.state.data?.hasActiveJob ? 2000 : 10_000),
  });

  const jobRunning = Boolean(jobStatus.data?.hasActiveJob);

  const recommended = useQuery({
    queryKey: ["retail-recommended"],
    queryFn: () => retailApi.recommended(100),
    refetchInterval: jobRunning ? 4000 : false,
  });

  const detail = useQuery({
    queryKey: ["retail-analysis", selectedId, refreshToken],
    queryFn: () => retailApi.analysis(selectedId as string, refreshToken > 0),
    enabled: Boolean(selectedId),
  });

  const startJob = useMutation({
    mutationFn: (payload: { mode: "batch" | "all"; batchSize?: number }) =>
      retailApi.startJob(payload.mode, payload.batchSize ?? 10, true),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retail-job"] });
      void queryClient.invalidateQueries({ queryKey: ["retail-recommended"] });
    },
  });

  const resumeJob = useMutation({
    mutationFn: (id: number) => retailApi.resumeJob(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retail-job"] });
      void queryClient.invalidateQueries({ queryKey: ["retail-recommended"] });
    },
  });

  const cancelJob = useMutation({
    mutationFn: (id: number) => retailApi.cancelJob(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["retail-job"] });
      void queryClient.invalidateQueries({ queryKey: ["retail-recommended"] });
    },
  });

  const job = jobStatus.data?.job;
  const catalogPending =
    jobStatus.data?.catalogPending ?? recommended.data?.pendingCount ?? 0;
  const catalogAnalyzed =
    jobStatus.data?.catalogAnalyzed ??
    job?.catalogAnalyzed ??
    recommended.data?.analyzedCount ??
    0;
  const catalogPool =
    jobStatus.data?.catalogPoolSize ??
    job?.catalogPoolSize ??
    recommended.data?.poolSize ??
    0;
  const catalogPct =
    catalogPool > 0 ? Math.min(100, Math.round((catalogAnalyzed / catalogPool) * 1000) / 10) : 0;
  const jobPct = job ? Math.min(100, Number(job.progressPct) || 0) : 0;

  useEffect(() => {
    if (!job) return;
    if (job.status === "completed" || job.processed > 0) {
      void queryClient.invalidateQueries({ queryKey: ["retail-recommended"] });
    }
  }, [job?.status, job?.processed, job?.cursor, job, queryClient]);

  useEffect(() => {
    if (autoResumeTried || jobRunning || !job?.resumable || !job.id) return;
    setAutoResumeTried(true);
    resumeJob.mutate(job.id);
    // Auto-resume once per page load for interrupted/failed jobs (timeout recovery).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoResumeTried, job?.id, job?.resumable, jobRunning]);

  const data = recommended.data;
  const items = data?.items || [];
  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) || detail.data || null,
    [items, selectedId, detail.data],
  );

  return (
    <div className="page-stack retail-page">
      <section className="module-card retail-hero">
        <div>
          <h2>Top 100 mais indicados para varejo</h2>
          <p>
            Ranking por apelo, potencial de venda e margem liquida apos taxas, frete e embalagem -
            nao pelo faturamento atacado do Mercos. A lista abaixo atualiza enquanto a analise
            roda em paralelo.
          </p>
        </div>
        <div className="retail-progress">
          <strong>
            {catalogAnalyzed}/{catalogPool || data?.poolSize || 0} analisados no catalogo
          </strong>
          <span>
            {catalogPending} pendentes - Top 100 atualiza a cada lote concluido
          </span>

          <div
            className="retail-progress-track"
            role="progressbar"
            aria-valuenow={catalogPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do catalogo"
          >
            <div className="retail-progress-fill" style={{ width: `${catalogPct}%` }} />
          </div>
          <span className="retail-progress-meta">{catalogPct}% do catalogo</span>

          {job && (
            <div className={`retail-job-box${jobRunning ? " is-running" : ""}`}>
              <strong>
                Job #{job.id}: {job.status} - lote {job.cursor}/{job.total} ({jobPct}%)
              </strong>
              <div
                className="retail-progress-track retail-progress-track--job"
                role="progressbar"
                aria-valuenow={jobPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Progresso do lote atual"
              >
                <div className="retail-progress-fill retail-progress-fill--job" style={{ width: `${jobPct}%` }} />
              </div>
              <span>
                ok {job.processed} / falhas {job.failed}
                {job.concurrency ? ` / ${job.concurrency} workers` : ""}
                {job.currentProductId ? ` / atual ${job.currentProductId}` : ""}
              </span>
              {job.lastError && <em className="retail-error">{job.lastError}</em>}
            </div>
          )}

          <div className="retail-job-actions">
            <button
              type="button"
              className="row-action"
              disabled={jobRunning || startJob.isPending || catalogPending === 0}
              onClick={() => startJob.mutate({ mode: "all", batchSize: 5 })}
            >
              {jobRunning && job?.mode === "all"
                ? `Analisando em paralelo (${job.concurrency || 5})...`
                : "Analisar catalogo em paralelo"}
            </button>
            <button
              type="button"
              className="row-action"
              disabled={jobRunning || startJob.isPending || catalogPending === 0}
              onClick={() => startJob.mutate({ mode: "batch", batchSize: 10 })}
            >
              {jobRunning && job?.mode === "batch" ? "Processando..." : "Analisar proximos 10"}
            </button>
            {job?.resumable && (
              <button
                type="button"
                className="row-action"
                disabled={resumeJob.isPending || jobRunning}
                onClick={() => resumeJob.mutate(job.id)}
              >
                Retomar job
              </button>
            )}
            {jobRunning && job && (
              <button
                type="button"
                className="row-action"
                disabled={cancelJob.isPending}
                onClick={() => cancelJob.mutate(job.id)}
              >
                Pausar / cancelar
              </button>
            )}
          </div>
          {(startJob.isError || resumeJob.isError || jobStatus.isError) && (
            <em className="retail-error">
              {startJob.error instanceof Error
                ? startJob.error.message
                : resumeJob.error instanceof Error
                  ? resumeJob.error.message
                  : jobStatus.error instanceof Error
                    ? jobStatus.error.message
                    : "Falha de comunicacao com a API"}
            </em>
          )}
          <em className="retail-muted">
            Cada produto e salvo ao concluir. Em timeout ou queda, o job fica retomavel e a barra
            continua de onde parou.
          </em>
        </div>
      </section>

      <section className="retail-kpi-grid">
        <article className="module-card">
          <small>Score medio Top 100</small>
          <strong>{data?.dashboard.avgRecommendationScore?.toFixed(1) ?? "-"}</strong>
        </article>
        <article className="module-card">
          <small>Margem media</small>
          <strong>{pct(data?.dashboard.avgMarginPct)}</strong>
        </article>
        <article className="module-card">
          <small>Apelo alto / medio / baixo</small>
          <strong>
            {data?.dashboard.appealDistribution.alto ?? 0} /{" "}
            {data?.dashboard.appealDistribution.medio ?? 0} /{" "}
            {data?.dashboard.appealDistribution.baixo ?? 0}
          </strong>
        </article>
        <article className="module-card retail-platform-card">
          <small>Melhor plataforma (Top 100)</small>
          <ul>
            {(data?.dashboard.platformDistribution || []).map((row) => (
              <li key={row.platform}>
                <span className={platformClass(row.platform)}>{row.label}</span>
                <em>{row.count}</em>
              </li>
            ))}
            {!data?.dashboard.platformDistribution?.length && (
              <li className="retail-empty">Sem dados ainda</li>
            )}
          </ul>
        </article>
      </section>

      <section className="module-card">
        <div className="retail-list-head">
          <p className="retail-disclaimer">{data?.disclaimer}</p>
          {jobRunning && (
            <span className="retail-live-pill" aria-live="polite">
              Atualizando lista...
            </span>
          )}
        </div>
        {recommended.isLoading && <p className="retail-empty">Carregando ranking...</p>}
        {recommended.isError && (
          <p className="retail-error">
            {recommended.error instanceof Error
              ? recommended.error.message
              : "Falha ao carregar recomendados"}
          </p>
        )}
        <div className="retail-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="retail-card"
              onClick={() => {
                setSelectedId(item.id);
                setRefreshToken(0);
              }}
            >
              <div className="retail-card-rank">#{item.rank}</div>
              <div className="retail-card-body">
                <div className="retail-card-head">
                  <strong>{item.name}</strong>
                  <em>{item.recomendacaoScore.toFixed(1)}</em>
                </div>
                <div className="retail-card-meta">
                  <span className={platformClass(item.melhorPlataforma)}>
                    {item.melhorPlataformaLabel}
                  </span>
                  <span>Envio: {item.melhorEnvioLabel || item.melhorEnvio || "-"}</span>
                  <span>Margem {pct(item.margemLiquidaPct)}</span>
                  <span className={`retail-appeal ${item.apelo || "medio"}`}>
                    Apelo {item.apelo || "medio"}
                  </span>
                  {!item.analyzed && <span className="retail-pending">Heuristica</span>}
                </div>
                <p className="retail-why">{item.motivoCurto}</p>
              </div>
            </button>
          ))}
        </div>
        {!recommended.isLoading && !items.length && (
          <p className="retail-empty">
            Nenhum produto analisado ainda. Inicie a analise em paralelo para popular o Top 100.
          </p>
        )}
      </section>

      {selectedId && (
        <EntityDetailDrawer
          title={selected?.name || "Produto"}
          loading={detail.isLoading && !selected}
          error={detail.error instanceof Error ? detail.error : null}
          onClose={() => setSelectedId(null)}
          onRetry={() => void detail.refetch()}
        >
          <ProductDetail
            product={detail.data || selected}
            loading={detail.isLoading}
            refreshing={detail.isFetching && refreshToken > 0}
            onRefresh={() => setRefreshToken((value) => value + 1)}
          />
        </EntityDetailDrawer>
      )}
    </div>
  );
}
