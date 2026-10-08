import { useRef } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import type { z } from "zod";
import { useErp } from "../auth/context";
import { newIdempotencyKey } from "../format";
import { erpRequest, type RequestOptions } from "./client";

/**
 * Query keys do ERP: ['erp', connectionId, recurso, filtros]. Nunca invalidam
 * chaves do BI (as do BI não começam por 'erp').
 */
export function useErpQuery<T>(
  parts: unknown[],
  path: string,
  schema: z.ZodType<T>,
  options: Partial<Pick<UseQueryOptions<T>, "enabled" | "refetchInterval" | "staleTime">> & {
    keepPrevious?: boolean;
  } = {},
) {
  const { connectionId } = useErp();
  const { keepPrevious, ...rest } = options;
  return useQuery<T>({
    queryKey: ["erp", connectionId, ...parts],
    queryFn: ({ signal }) => erpRequest(path, schema, { signal }),
    placeholderData: keepPrevious ? keepPreviousData : undefined,
    ...rest,
  });
}

/** Invalida somente consultas ERP afetadas (prefixo ['erp', connectionId, ...]). */
export function useInvalidateErp() {
  const client = useQueryClient();
  const { connectionId } = useErp();
  return (...parts: unknown[]) =>
    client.invalidateQueries({ queryKey: ["erp", connectionId, ...parts] });
}

/**
 * Idempotency-Key estável por intenção de negócio: o mesmo conteúdo reaproveita
 * a chave em retries seguros; nova edição após conclusão recebe nova chave.
 */
export function useIdempotencyKey() {
  const ref = useRef<{ fingerprint: string; key: string } | null>(null);
  return {
    keyFor(payload: unknown): string {
      const fingerprint = JSON.stringify(payload);
      if (!ref.current || ref.current.fingerprint !== fingerprint) {
        ref.current = { fingerprint, key: newIdempotencyKey() };
      }
      return ref.current.key;
    },
    reset() {
      ref.current = null;
    },
  };
}

export type CommandInput<TBody> = {
  path: string;
  method?: RequestOptions["method"];
  body?: TBody;
  idempotent?: boolean;
};

/**
 * Comando com Idempotency-Key opcional. Sem cache otimista: o retorno do
 * servidor é a única prova; formulário permanece em caso de erro.
 */
export function useCommand<TBody, TResult>(schema: z.ZodType<TResult>) {
  const idem = useIdempotencyKey();
  const mutation = useMutation<TResult, Error, CommandInput<TBody>>({
    mutationFn: (input) =>
      erpRequest(input.path, schema, {
        method: input.method ?? "POST",
        body: input.body,
        idempotencyKey: input.idempotent
          ? idem.keyFor({ path: input.path, method: input.method, body: input.body })
          : undefined,
      }),
    onSuccess: () => idem.reset(),
  });
  return mutation;
}
