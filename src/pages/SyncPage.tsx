import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { QueryState } from "../components/feedback/QueryState";

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

const statusLabel = (status: string) =>
  ({
    success: "Atualizado",
    running: "Em andamento",
    waiting: "Aguardando nova tentativa",
    interrupted: "Interrompido",
    partial: "Parcial",
    unavailable: "Sem permissão no Mercos",
    error: "Erro",
    never: "Ainda não sincronizado",
  })[status] || status;

export function SyncPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["sync-status"],
    queryFn: api.syncStatus,
    refetchInterval: (query) => {
      const states = query.state.data || [];
      if (states.some((item) => item.status === "running")) return 5_000;
      if (states.some((item) => item.status === "waiting")) return 30_000;
      return false;
    },
  });
  const runs = useQuery({
    queryKey: ["sync-runs", page],
    queryFn: () => api.syncRuns(page),
    refetchInterval: status.data?.some((item) => item.status === "running")
      ? 5_000
      : status.data?.some((item) => item.status === "waiting")
        ? 30_000
        : false,
  });
  const sync = useMutation({
    mutationFn: (resource: string) => api.sync(resource, false),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sync-status"] }),
        queryClient.invalidateQueries({ queryKey: ["sync-runs"] }),
      ]);
    },
  });
  const cancel = useMutation({
    mutationFn: () => api.cancelSync(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sync-status"] }),
        queryClient.invalidateQueries({ queryKey: ["sync-runs"] }),
      ]);
    },
  });
  const autoManaged =
    status.data?.some((item) => ["running", "waiting"].includes(item.status)) ||
    sync.isPending;
  const waiting = status.data?.some((item) => item.status === "waiting");

  return (
    <div className="page-stack">
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Sincronização Mercos</h2>
            <p>
              Atualização automática: pedidos a cada 10 minutos e um recurso de
              catálogo por vez a cada 30 minutos. Quando o Mercos limitar as
              chamadas, o sistema aguarda e tenta novamente sozinho.
            </p>
          </div>
          <div className="table-actions">
            <button type="button" disabled={autoManaged} onClick={() => sync.mutate("orders")}>
              Sincronizar pedidos
            </button>
            <button type="button" disabled={autoManaged} onClick={() => sync.mutate("all")}>
              Sincronizar tudo
            </button>
            <button
              type="button"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate()}
            >
              {cancel.isPending ? "Interrompendo…" : "Interromper"}
            </button>
          </div>
        </div>
        {sync.error && <div className="state-panel error">{sync.error.message}</div>}
        {cancel.error && <div className="state-panel error">{cancel.error.message}</div>}
        {waiting && (
          <div className="state-panel">
            O Mercos limitou temporariamente as chamadas. Nenhuma ação é
            necessária: a próxima tentativa será automática.
          </div>
        )}
        <QueryState
          loading={status.isLoading}
          error={status.error as Error | null}
          empty={status.data?.length === 0}
          onRetry={() => void status.refetch()}
        />
        {status.data && status.data.length > 0 && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Recurso</th><th>Status</th><th>Registros</th><th>Último sucesso</th><th>Erro</th></tr>
              </thead>
              <tbody>
                {status.data.map((item) => (
                  <tr key={item.resource}>
                    <td>{item.resource}</td>
                    <td>{statusLabel(item.status)}</td>
                    <td>{item.records?.toLocaleString("pt-BR") || 0}</td>
                    <td>{dateTime(item.lastSuccessAt)}</td>
                    <td>{item.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <article className="module-card table-module">
        <div className="module-heading">
          <div><h2>Histórico auditável</h2><p>Cursores, volumes, falhas e duração de cada execução.</p></div>
        </div>
        <QueryState
          loading={runs.isLoading}
          error={runs.error as Error | null}
          empty={runs.data?.totalItems === 0}
          onRetry={() => void runs.refetch()}
        />
        {runs.data && runs.data.totalItems > 0 && (
          <>
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Início</th><th>Recurso</th><th>Modo</th><th>Status</th><th>Páginas</th><th>Recebidos</th><th>Persistidos</th><th>Falhas</th><th>Duração</th></tr>
                </thead>
                <tbody>
                  {runs.data.items.map((run) => {
                    const duration = run.finishedAt
                      ? Math.max(
                          0,
                          (new Date(run.finishedAt).getTime() -
                            new Date(run.startedAt).getTime()) /
                            1000
                        )
                      : null;
                    return (
                      <tr key={run.id}>
                        <td>{dateTime(run.startedAt)}</td>
                        <td>{run.resource}</td>
                        <td>{run.mode}</td>
                        <td>{statusLabel(run.status)}</td>
                        <td>{run.pages}</td>
                        <td>{run.received}</td>
                        <td>{run.persisted}</td>
                        <td>{run.failed}</td>
                        <td>{duration == null ? "Em andamento" : `${duration.toFixed(1)}s`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="table-pagination">
              <span>{runs.data.totalItems.toLocaleString("pt-BR")} execuções</span>
              <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
              <button type="button" disabled={page >= runs.data.totalPages} onClick={() => setPage((value) => value + 1)}>Próxima</button>
            </div>
          </>
        )}
      </article>
    </div>
  );
}
