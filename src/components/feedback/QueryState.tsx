import type { AnalyticsMetadata } from "../../types/analytics";

export function QueryState({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: Error | null;
  empty?: boolean;
  onRetry?: () => void;
}) {
  if (loading) return <div className="state-panel skeleton">Carregando dados…</div>;
  if (error) {
    return (
      <div className="state-panel error">
        <strong>Falha ao carregar</strong>
        <span>{error.message}</span>
        {onRetry && (
          <button type="button" onClick={onRetry}>
            Tentar novamente
          </button>
        )}
      </div>
    );
  }
  if (empty) return <div className="state-panel">Sem dados no período selecionado.</div>;
  return null;
}

export function MetadataStatus({ metadata }: { metadata: AnalyticsMetadata }) {
  return (
    <div className={`metadata-status ${metadata.isPartial ? "partial" : "updated"}`}>
      <strong>{metadata.isPartial ? "Dados parciais" : "Atualizado"}</strong>
      <span>
        Gerado em {new Date(metadata.generatedAt).toLocaleString("pt-BR")}
        {metadata.dataThrough &&
          ` · dados até ${new Date(metadata.dataThrough).toLocaleString("pt-BR")}`}
      </span>
      {metadata.quality.ordersWithItemsPct != null && (
        <span>
          Cobertura de itens:{" "}
          {metadata.quality.ordersWithItemsPct.toLocaleString("pt-BR", {
            maximumFractionDigits: 2,
          })}
          %
        </span>
      )}
      {metadata.warnings.map((warning) => (
        <small key={warning}>{warning}</small>
      ))}
    </div>
  );
}
