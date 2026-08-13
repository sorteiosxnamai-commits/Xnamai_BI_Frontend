import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { QueryState } from "../components/feedback/QueryState";

const dateTime = (value: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR") : "—";

export function SyncPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const status = useQuery({
    queryKey: ["sync-status"],
    queryFn: api.syncStatus,
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.status === "running") ? 5_000 : false,
  });
  const runs = useQuery({
    queryKey: ["sync-runs", page],
    queryFn: () => api.syncRuns(page),
    refetchInterval: status.data?.some((item) => item.status === "running")
      ? 5_000
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
  const running = status.data?.some((item) => item.status === "running") || sync.isPending;

  return (
    <div className="page-stack">
      <article className="module-card">
        <div className="module-heading">
          <div>
            <h2>Sincronização Mercos</h2>
            <p>Execuções incrementais administrativas, sem reinício automático.</p>
          </div>
          <div className="table-actions">
            <button type="button" disabled={running} onClick={() => sync.mutate("orders")}>
              Sincronizar pedidos
            </button>
            <button type="button" disabled={running} onClick={() => sync.mutate("all")}>
              Sincronizar tudo
            </button>
          </div>
        </div>
        {sync.error && <div className="state-panel error">{sync.error.message}</div>}
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
                    <td>{item.status}</td>
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
                        <td>{run.status}</td>
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
