import { useErpQuery } from "../api/hooks";
import { operationalSummarySchema } from "../api/schemas";
import { periodLabel } from "../scope";

/** Explica um filtro vazio usando o intervalo realmente presente no espelho. */
export function PeriodDataNotice({ from, to, empty }: { from?: string; to?: string; empty: boolean }) {
  const selected = Boolean(from || to);
  const available = useErpQuery(
    ["overview-orders", { dateFrom: undefined, dateTo: undefined }],
    "/operational-summary",
    operationalSummarySchema,
    { enabled: selected && empty, staleTime: 60_000 },
  );
  const first = available.data?.dates?.orderDate.min;
  const last = available.data?.dates?.orderDate.max;
  if (!selected || !empty || !first || !last) return null;

  const outside = Boolean((from && from > last) || (to && to < first));
  return (
    <div className="erp-notice" role="status">
      <strong>{outside ? "Período fora dos pedidos importados" : "Nenhum pedido neste filtro"}</strong>
      <span>
        O espelho contém pedidos de {periodLabel(first, last)}.
        {outside && !available.data?.coverage.complete
          ? " A sincronização ainda está em andamento; datas mais recentes podem não ter chegado."
          : " Ajuste o período ou confira os outros filtros."}
      </span>
    </div>
  );
}
