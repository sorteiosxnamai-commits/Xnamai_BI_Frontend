import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z, type ZodType } from "zod";
import { useErp } from "../../auth/context";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import {
  conflictSchema,
  fieldSchema,
  integrationStatusSchema,
  jobSchema,
  operationDetailSchema,
  operationSchema,
  pageOf,
  quarantineSchema,
  runSchema,
  type Conflict,
  type Operation,
  type Page,
} from "../../api/schemas";
import { OperationTracker } from "../../components/OperationTracker";
import { ServerList, type Column } from "../../components/ServerList";
import { StatePanel } from "../../components/StatePanel";
import { Badge, Dl, PageHeader, Tabs, CommandError } from "../../components/ui";
import { formatInstant } from "../../format";

type Run = z.infer<typeof runSchema>;
type Quarantine = z.infer<typeof quarantineSchema>;
type Field = z.infer<typeof fieldSchema>;
const runPage = pageOf(runSchema) as unknown as ZodType<Page<Run>>;
const operationPage = pageOf(operationSchema) as unknown as ZodType<Page<Operation>>;
const conflictPage = pageOf(conflictSchema) as unknown as ZodType<Page<Conflict>>;
const quarantinePage = pageOf(quarantineSchema) as unknown as ZodType<Page<Quarantine>>;
const fieldPage = pageOf(fieldSchema) as unknown as ZodType<Page<Field>>;

const TABS = [
  { id: "recursos", label: "Recursos" },
  { id: "execucoes", label: "Execuções" },
  { id: "operacoes", label: "Operações de escrita" },
  { id: "conflitos", label: "Conflitos" },
  { id: "quarentena", label: "Quarentena" },
  { id: "campos", label: "Inventário de campos" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const KIND_LABEL: Record<string, string> = {
  create_customer: "Criar cliente",
  update_customer: "Editar cliente",
  create_order: "Criar pedido",
  update_order: "Editar pedido",
  create_title: "Criar título",
  update_title: "Editar título",
};

function JobTracker({ jobId }: { jobId: number }) {
  const query = useErpQuery(["job", jobId], `/integration/jobs/${jobId}`, jobSchema, {
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      return status && ["succeeded", "failed", "cancelled"].includes(status)
        ? false
        : Math.min(2000 * 2 ** Math.min(Math.max(q.state.dataUpdateCount - 1, 0), 4), 30_000);
    },
  });
  if (!query.data) return <span className="erp-muted">Acompanhando job {jobId}…</span>;
  const job = query.data;
  return (
    <div className="erp-operation" role="status">
      <strong>Job {job.jobId}: {job.status}</strong>
      <span>
        {job.status === "queued"
          ? "Agendado. O worker ERP executa em segundo plano; esta tela não lê o Mercos."
          : job.error ?? "—"}
      </span>
    </div>
  );
}

function ResourcesTab() {
  const { can } = useErp();
  const query = useErpQuery(["integration-status"], "/integration/status", integrationStatusSchema, { refetchInterval: 20_000 });
  const sync = useCommand<Record<string, unknown>, z.infer<typeof jobSchema>>(jobSchema);
  const invalidate = useInvalidateErp();
  const [jobId, setJobId] = useState<number | null>(null);
  const [full, setFull] = useState(false);

  async function run(resource: string) {
    const job = await sync.mutateAsync({ path: "/integration/sync", body: { resource, full } }).catch(() => null);
    if (job) {
      setJobId(job.jobId);
      void invalidate("integration-status");
    }
  }
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  const data = query.data;
  if (!data) return null;
  return (
    <>
      <section className="erp-card">
        <Dl
          items={[
            ["Conexão", data.connectionId],
            ["Adaptor", data.adaptorConfigured ? "Configurado" : "Não configurado"],
            ["Chave ERP de escrita", data.writeKeyConfigured ? "Configurada" : "Ausente (escritas bloqueadas)"],
            ["Webhook", data.webhookConfigured ? "Segredo configurado" : "Segredo ausente (receptor responde 503)"],
            ["Jobs", Object.entries(data.jobs).map(([k, v]) => `${k}: ${v}`).join(" · ") || "nenhum"],
          ]}
        />
        {can("integration:sync") && (
          <div className="erp-toolbar" style={{ marginTop: 12 }}>
            <button type="button" className="erp-btn erp-btn-primary" disabled={sync.isPending} onClick={() => void run("all")}>
              Sincronizar tudo
            </button>
            <label className="erp-field"><span><input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Carga completa (consome mais cota do Mercos)</span></label>
          </div>
        )}
        <p className="erp-muted">“Sincronizar” só agenda um job no backend; o navegador nunca percorre páginas do Mercos.</p>
        <CommandError error={sync.error} />
        {jobId !== null && <JobTracker jobId={jobId} />}
      </section>
      <section className="erp-card" aria-label="Recursos">
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead><tr><th>Recurso</th><th>Origem</th><th>Situação</th><th className="num">Local</th><th>Dados até</th><th>Última tentativa</th><th className="num">Pendentes</th><th className="num">Campos novos</th><th /></tr></thead>
            <tbody>
              {data.resources.map((r) => (
                <tr key={r.resource}>
                  <td><strong>{r.label}</strong><div className="erp-muted">{r.resource}</div>{r.error && <div className="erp-field-error">{r.error}</div>}</td>
                  <td>{r.upstream}</td>
                  <td><Badge value={r.status} />{r.retryAfter && <div className="erp-muted">retry após {formatInstant(r.retryAfter)}</div>}</td>
                  <td className="num">{r.localRecords === null ? "indisponível" : r.localRecords}</td>
                  <td>{formatInstant(r.dataThrough)}</td>
                  <td>{formatInstant(r.lastAttemptAt)}</td>
                  <td className="num">{r.unresolved ?? "—"}</td>
                  <td className="num">{r.unmappedFields}</td>
                  <td>{can("integration:sync") && <button type="button" className="erp-btn" disabled={sync.isPending} onClick={() => void run(r.resource)}>Sincronizar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {data.pendingReferences.length > 0 && (
        <section className="erp-card"><h3>Referências pendentes</h3>
          <ul>{data.pendingReferences.map((p) => <li key={`${p.resource}.${p.field}`}>{p.pending} em {p.resource}.{p.field} aguardando {p.target}</li>)}</ul></section>
      )}
    </>
  );
}

function OperationPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const { can } = useErp();
  const query = useErpQuery(["operation-detail", id], `/integration/operations/${id}`, operationDetailSchema);
  const reconcile = useCommand<Record<string, unknown>, z.infer<typeof operationDetailSchema>>(operationDetailSchema);
  const invalidate = useInvalidateErp();
  const [externalId, setExternalId] = useState("");
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<"created" | "not_created" | null>(null);
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  const op = query.data;
  if (!op) return null;
  const decide = async (decision: string) => {
    const body: Record<string, unknown> = { decision, note: note.trim() || null };
    if (decision === "confirm_created") body.externalId = externalId.trim();
    await reconcile.mutateAsync({ path: `/integration/operations/${id}/reconcile`, body }).catch(() => null);
    setConfirm(null);
    void query.refetch();
    void invalidate("operations");
  };
  return (
    <section className="erp-card">
      <div className="erp-page-head">
        <div><h3>{KIND_LABEL[op.kind] ?? op.kind}</h3><p className="erp-muted">Operação {op.operationId} · operador {op.operator}</p></div>
        <button type="button" className="erp-btn" onClick={onClose}>Fechar</button>
      </div>
      <OperationTracker operationId={op.operationId} />
      <Dl items={[["Alvo", op.targetId ?? "—"], ["ID externo", op.externalId ?? "—"], ["Erro", op.errorCode ? `${op.errorCode}: ${op.error ?? ""}` : "—"], ["Tentativas", String(op.attempts)], ["Criada", formatInstant(op.createdAt)], ["Concluída", formatInstant(op.completedAt)]]} />
      {op.canReconcile && can("integration:resolve") && (
        <div className="erp-card" style={{ marginTop: 12 }}>
          <h3>Reconciliar resultado desconhecido</h3>
          <p className="erp-muted">
            Esta operação não será reenviada automaticamente: o Mercos pode ter aceitado. Colete evidências e
            decida. Igualdade de nome ou valor não prova registro único.
          </p>
          <div className="erp-toolbar">
            <button type="button" className="erp-btn" disabled={reconcile.isPending} onClick={() => void decide("check")}>Verificar evidências no espelho</button>
          </div>
          {op.reconcileEvidence != null && <pre className="erp-muted" style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(op.reconcileEvidence, null, 2)}</pre>}
          <div className="erp-form">
            <label className="erp-field"><span>ID externo confirmado</span><input value={externalId} onChange={(e) => setExternalId(e.target.value)} /></label>
            <label className="erp-field"><span>Observação</span><input value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          {confirm && (
            <div className="erp-notice" role="alert">
              <strong>{confirm === "created" ? "Confirmar que o Mercos registrou" : "Confirmar que o Mercos NÃO registrou"}</strong>
              <span>{confirm === "created" ? `A operação passa a aceita com o ID externo ${externalId}.` : "A operação é encerrada como não aplicada; para tentar de novo, crie uma nova intenção."}</span>
              <div className="erp-toolbar-actions">
                <button type="button" className="erp-btn erp-btn-primary" onClick={() => void decide(confirm === "created" ? "confirm_created" : "confirm_not_created")}>Confirmar decisão</button>
                <button type="button" className="erp-btn" onClick={() => setConfirm(null)}>Voltar</button>
              </div>
            </div>
          )}
          {!confirm && (
            <div className="erp-toolbar-actions" style={{ marginTop: 8 }}>
              <button type="button" className="erp-btn" disabled={!externalId.trim()} onClick={() => setConfirm("created")}>Foi criado no Mercos…</button>
              <button type="button" className="erp-btn erp-btn-danger" onClick={() => setConfirm("not_created")}>Não foi criado no Mercos…</button>
            </div>
          )}
          <CommandError error={reconcile.error} />
        </div>
      )}
    </section>
  );
}

function ConflictPanel({ conflict }: { conflict: Conflict }) {
  const { can } = useErp();
  const resolve = useCommand<Record<string, unknown>, unknown>(z.unknown());
  const invalidate = useInvalidateErp();
  const [confirm, setConfirm] = useState<"use_local" | "use_external" | null>(null);
  if (conflict.status !== "open") return <Badge value="success" label={`Resolvido: ${conflict.resolution ?? ""}`} />;
  return (
    <div>
      {conflict.fields.map((field) => (
        <fieldset key={field} className="erp-diff">
          <legend className="sr-only">Comparação de {field}</legend>
          <div><small className="erp-muted">Base (quando você editou)</small><br />{String(conflict.base?.[field] ?? "—")}</div>
          <div><small className="erp-muted">Sua alteração</small><br />{String((conflict.local as Record<string, unknown> | null)?.[field] ?? "—")}</div>
          <div><small className="erp-muted">Origem agora (Mercos)</small><br />{String(conflict.external?.[field] ?? "—")}</div>
        </fieldset>
      ))}
      {can("integration:resolve") && (
        <div className="erp-toolbar-actions" style={{ marginTop: 8 }}>
          {confirm ? (
            <>
              <span>{confirm === "use_local" ? "Enviar minha alteração ao Mercos?" : "Descartar minha alteração e manter a versão do Mercos?"}</span>
              <button type="button" className="erp-btn erp-btn-primary" disabled={resolve.isPending}
                onClick={() => void resolve.mutateAsync({ path: `/integration/conflicts/${conflict.id}/resolve`, body: { resolution: confirm } })
                  .then(() => { setConfirm(null); void invalidate("conflicts"); void invalidate("operations"); }).catch(() => null)}>Confirmar</button>
              <button type="button" className="erp-btn" onClick={() => setConfirm(null)}>Voltar</button>
            </>
          ) : (
            <>
              <button type="button" className="erp-btn" onClick={() => setConfirm("use_local")}>Manter a minha</button>
              <button type="button" className="erp-btn" onClick={() => setConfirm("use_external")}>Manter a do Mercos</button>
            </>
          )}
        </div>
      )}
      <CommandError error={resolve.error} />
    </div>
  );
}

export function IntegrationPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("aba");
  const [tab, setTabState] = useState<TabId>(TABS.some((t) => t.id === initial) ? (initial as TabId) : "recursos");
  const [selected, setSelected] = useState<string | null>(null);
  const setTab = (id: TabId) => {
    setTabState(id);
    setParams({ aba: id }, { replace: true });
  };

  const runColumns: Column<Run>[] = [
    { key: "res", header: "Recurso", render: (r) => r.resource },
    { key: "mode", header: "Modo", render: (r) => r.mode },
    { key: "status", header: "Situação", render: (r) => <Badge value={r.status} /> },
    { key: "start", header: "Início", sortKey: "startedAt", render: (r) => formatInstant(r.startedAt) },
    { key: "pages", header: "Páginas", render: (r) => r.pages },
    { key: "recv", header: "Recebidos", render: (r) => r.received },
    { key: "pers", header: "Gravados", render: (r) => r.persisted },
    { key: "unch", header: "Sem mudança", render: (r) => r.unchanged },
    { key: "q", header: "Quarentena", render: (r) => r.quarantined },
    { key: "err", header: "Erro", render: (r) => r.error ?? "—" },
  ];
  const opColumns: Column<Operation>[] = [
    { key: "kind", header: "Operação", render: (o) => KIND_LABEL[o.kind] ?? o.kind },
    { key: "status", header: "Situação", render: (o) => <Badge value={o.status} /> },
    { key: "target", header: "Alvo", render: (o) => o.targetId ?? o.externalId ?? "—" },
    { key: "sync", header: "Sincronizado", render: (o) => (o.synchronized ? "Sim" : "Não") },
    { key: "by", header: "Operador", render: (o) => o.operator },
    { key: "at", header: "Criada", sortKey: "createdAt", render: (o) => formatInstant(o.createdAt) },
    { key: "err", header: "Erro", render: (o) => o.error ?? "—" },
  ];
  const conflictColumns: Column<Conflict>[] = [
    { key: "entity", header: "Registro", render: (c) => `${c.entityType} ${c.entityId ?? ""}` },
    { key: "fields", header: "Campos", render: (c) => c.fields.join(", ") },
    { key: "when", header: "Quando", sortKey: "createdAt", render: (c) => formatInstant(c.createdAt) },
    { key: "resolve", header: "Comparação e decisão", render: (c) => <ConflictPanel conflict={c} /> },
  ];

  return (
    <>
      <PageHeader
        title="Integrações"
        subtitle="Estado por recurso, execuções, operações pendentes/unknown/conflito e evidências de reconciliação. Operação unknown nunca tem “tentar de novo”."
      />
      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      {tab === "recursos" && <ResourcesTab />}
      {tab === "execucoes" && (
        <ServerList<Run> resource="runs" path="/integration/runs" schema={runPage} caption="Execuções de sincronização" columns={runColumns}
          filters={[{ name: "resource", label: "Recurso", type: "text" }, { name: "status", label: "Situação", type: "select", options: ["success", "failed", "waiting_rate_limit", "forbidden", "interrupted", "partial", "cancelled"].map((v) => ({ value: v, label: v })) }]}
          defaultSort="startedAt" defaultOrder="desc" rowKey={(r) => r.id} emptyMessage="Nenhuma execução ainda." />
      )}
      {tab === "operacoes" && (
        <>
          {selected && <OperationPanel id={selected} onClose={() => setSelected(null)} />}
          <ServerList<Operation> resource="operations" path="/integration/operations" schema={operationPage} caption="Operações de escrita" columns={opColumns}
            filters={[{ name: "status", label: "Situação", type: "select", options: ["queued", "processing", "waiting_rate_limit", "succeeded", "failed", "unknown", "conflict"].map((v) => ({ value: v, label: v })) }]}
            defaultSort="createdAt" defaultOrder="desc" rowKey={(o) => o.operationId} onRowOpen={(o) => setSelected(o.operationId)} emptyMessage="Nenhuma operação de escrita." />
        </>
      )}
      {tab === "conflitos" && (
        <ServerList<Conflict> resource="conflicts" path="/integration/conflicts" schema={conflictPage} caption="Conflitos" columns={conflictColumns}
          filters={[{ name: "status", label: "Situação", type: "select", options: [{ value: "open", label: "Abertos" }, { value: "resolved", label: "Resolvidos" }] }]}
          defaultSort="createdAt" defaultOrder="desc" rowKey={(c) => c.id} emptyMessage="Nenhum conflito." />
      )}
      {tab === "quarentena" && (
        <ServerList<Quarantine> resource="quarantine" path="/integration/quarantine" schema={quarantinePage} caption="Linhas em quarentena"
          columns={[
            { key: "res", header: "Recurso", render: (q) => q.resource },
            { key: "key", header: "Chave", render: (q) => q.externalKey },
            { key: "reason", header: "Motivo", render: (q) => q.reason },
            { key: "n", header: "Tentativas", render: (q) => q.attempts },
            { key: "at", header: "Desde", render: (q) => formatInstant(q.createdAt) },
          ]}
          filters={[{ name: "resource", label: "Recurso", type: "text" }]} defaultSort="createdAt" defaultOrder="desc" rowKey={(q) => q.id}
          emptyMessage="Nenhuma linha em quarentena: o checkpoint pode avançar." />
      )}
      {tab === "campos" && (
        <ServerList<Field> resource="fields" path="/integration/fields" schema={fieldPage} caption="Inventário de campos de origem"
          columns={[
            { key: "res", header: "Recurso", sortKey: "resource", render: (f) => f.resource },
            { key: "key", header: "Campo de origem", sortKey: "key", render: (f) => <code>{f.sourceKey}</code> },
            { key: "mapped", header: "Mapeado", render: (f) => (f.mapped ? <Badge value="success" label="Sim" /> : <Badge value="partial" label="Não — fica no snapshot restrito" />) },
            { key: "seen", header: "Vezes visto", sortKey: "seen", render: (f) => f.seenCount },
            { key: "type", header: "Tipo", render: (f) => f.sampleType ?? "—" },
            { key: "last", header: "Visto por último", render: (f) => formatInstant(f.lastSeenAt) },
          ]}
          filters={[{ name: "resource", label: "Recurso", type: "text" }, { name: "mapped", label: "Mapeamento", type: "select", options: [{ value: "false", label: "Somente não mapeados" }, { value: "true", label: "Somente mapeados" }] }]}
          defaultSort="resource" pageSize={50} rowKey={(f) => `${f.resource}:${f.sourceKey}`} emptyMessage="Nenhum campo registrado ainda." />
      )}
    </>
  );
}
