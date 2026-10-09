import { Link } from "react-router-dom";
import { useErpQuery } from "../api/hooks";
import { type OperationStatus, operationDetailSchema } from "../api/schemas";
import { formatInstant } from "../format";
import { StatePanel } from "./StatePanel";

const ACTIVE: ReadonlySet<OperationStatus> = new Set(["queued", "processing", "waiting_rate_limit"]);
const MAX_CONFIRMATION_POLLS = 40;

/** Intervalo de acompanhamento com backoff: 2s, 4s, 8s, 16s, depois 30s. */
export function pollDelay(updates: number): number {
  return Math.min(2000 * 2 ** Math.min(updates, 4), 30_000);
}

/**
 * Acompanha uma operação de escrita externa. Mensagens seguem o contrato:
 * "Envio pendente" até haver resposta; "Sincronizado com Mercos" só depois da
 * confirmação do espelho; "Resultado em verificação" para unknown (sem botão de
 * tentar de novo). O polling para ao desmontar (o observer do react-query sai).
 */
export function OperationTracker({ operationId }: { operationId: string }) {
  const query = useErpQuery(
    ["operation", operationId],
    `/integration/operations/${operationId}`,
    operationDetailSchema,
    {
      refetchInterval: (q) => {
        const data = q.state.data;
        if (!data) return pollDelay(0);
        // a 1ª resposta já conta como atualização: o 1º reconsulta sai em 2s
        if (ACTIVE.has(data.status)) return pollDelay(Math.max(q.state.dataUpdateCount - 1, 0));
        if (data.status === "succeeded" && !data.synchronized) {
          return q.state.dataUpdateCount < MAX_CONFIRMATION_POLLS ? 15_000 : false;
        }
        return false;
      },
    },
  );
  if (query.isLoading) return <StatePanel kind="loading" title="Acompanhando operação…" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const op = query.data;
  if (!op) return null;

  let tone = "pending";
  let title = "Envio pendente";
  let message = "A operação está na fila e ainda não foi enviada ao Mercos.";
  if (op.status === "processing") message = "Enviando ao Mercos…";
  if (op.status === "waiting_rate_limit") {
    title = "Aguardando limite de requisições";
    message = `O Mercos pediu para esperar. Nova tentativa automática a partir de ${formatInstant(op.nextAttemptAt)}.`;
  }
  if (op.status === "succeeded" && !op.synchronized) {
    tone = "ok";
    title = "Aceito pelo Mercos";
    message = `ID externo ${op.externalId ?? "—"}. Aguardando a confirmação no espelho local antes de chamar de sincronizado.`;
  }
  if (op.status === "succeeded" && op.synchronized) {
    tone = "ok";
    title = "Sincronizado com Mercos";
    message = `Confirmado em ${formatInstant(op.mirrorConfirmedAt)} (ID ${op.externalId ?? "—"}).`;
  }
  if (op.status === "failed") {
    tone = "bad";
    title = "Não aplicado";
    message = op.error || "O Mercos recusou a operação. Nada foi alterado.";
  }
  if (op.status === "unknown") {
    tone = "warn";
    title = "Resultado em verificação";
    message =
      "Não sabemos se o Mercos aceitou. A operação NÃO será reenviada automaticamente para evitar duplicidade. " +
      "Um operador precisa reconciliar.";
  }
  if (op.status === "conflict") {
    tone = "warn";
    title = "Conflito";
    message = "Os mesmos campos mudaram no Mercos e aqui. Resolva o conflito para liberar o envio.";
  }
  return (
    <div className={`erp-operation erp-operation-${tone}`} role="status" aria-live="polite">
      <strong>{title}</strong>
      <span>{message}</span>
      <small>
        Operação {op.operationId.slice(0, 8)} · tentativas: {op.attempts}
        {op.status === "unknown" || op.status === "conflict" ? (
          <>
            {" · "}
            <Link to={`/erp/integracoes?aba=${op.status === "unknown" ? "operacoes" : "conflitos"}`}>
              Abrir em Integrações
            </Link>
          </>
        ) : null}
      </small>
    </div>
  );
}
