import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { OperationTracker, pollDelay } from "./OperationTracker";
import { mockFetch, renderErp } from "../test/utils";

const base = {
  operationId: "11111111-2222-3333-4444-555555555555",
  kind: "create_customer",
  targetResource: "customers",
  targetId: null,
  externalId: null,
  operator: "admin@xnamai.com",
  attempts: 0,
  errorCode: null,
  error: null,
  nextAttemptAt: null,
  completedAt: null,
  mirrorConfirmedAt: null,
  createdAt: null,
  statusUrl: "/api/v1/erp/integration/operations/x",
  synchronized: false,
  canReconcile: false,
  canRetry: false,
};

beforeEach(() => vi.stubEnv("VITE_BI_API_URL", "https://api.test"));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function show(operation: Record<string, unknown>) {
  const mock = mockFetch(() => ({ body: { ...base, ...operation } }));
  renderErp(<OperationTracker operationId={base.operationId} />);
  return mock;
}

test("fila: 'Envio pendente', nunca 'salvo no Mercos'", async () => {
  show({ status: "queued" });
  expect(await screen.findByText("Envio pendente")).toBeInTheDocument();
  expect(screen.queryByText(/sincronizado com mercos/i)).not.toBeInTheDocument();
});

test("aceito pelo Mercos mas sem confirmação do espelho ainda não é 'Sincronizado'", async () => {
  show({ status: "succeeded", externalId: "777", synchronized: false });
  expect(await screen.findByText("Aceito pelo Mercos")).toBeInTheDocument();
  expect(screen.queryByText("Sincronizado com Mercos")).not.toBeInTheDocument();
});

test("só depois da confirmação aparece 'Sincronizado com Mercos'", async () => {
  show({ status: "succeeded", externalId: "777", synchronized: true, mirrorConfirmedAt: "2026-10-07T12:00:00+00:00" });
  expect(await screen.findByText("Sincronizado com Mercos")).toBeInTheDocument();
});

test("unknown: 'Resultado em verificação', sem botão de tentar de novo", async () => {
  show({ status: "unknown", errorCode: "transport" });
  expect(await screen.findByText("Resultado em verificação")).toBeInTheDocument();
  expect(screen.getByText(/NÃO será reenviada automaticamente/)).toBeInTheDocument();
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(screen.queryByText(/tentar de novo/i)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Abrir em Integrações" })).toHaveAttribute("href", "/erp/integracoes?aba=operacoes");
});

test("conflito leva à resolução; falha mostra o erro", async () => {
  show({ status: "conflict" });
  expect(await screen.findByText("Conflito")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Abrir em Integrações" })).toHaveAttribute("href", "/erp/integracoes?aba=conflitos");
});

test("falha mostra o motivo", async () => {
  show({ status: "failed", error: "CPF/CNPJ duplicado" });
  expect(await screen.findByText("Não aplicado")).toBeInTheDocument();
  expect(screen.getByText("CPF/CNPJ duplicado")).toBeInTheDocument();
});

test("backoff do acompanhamento: 2s, 4s, 8s, 16s e teto de 30s", () => {
  expect([0, 1, 2, 3, 4, 9].map(pollDelay)).toEqual([2000, 4000, 8000, 16000, 30000, 30000]);
});

test("polling continua enquanto ativo e PARA ao desmontar", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const mock = mockFetch(() => ({ body: { ...base, status: "queued" } }));
  const { unmount } = renderErp(<OperationTracker operationId={base.operationId} />);
  await screen.findByText("Envio pendente");
  const initial = mock.calls.length;
  await vi.advanceTimersByTimeAsync(2100);
  await waitFor(() => expect(mock.calls.length).toBeGreaterThan(initial));
  unmount();
  const afterUnmount = mock.calls.length;
  await vi.advanceTimersByTimeAsync(120_000);
  expect(mock.calls.length).toBe(afterUnmount);
});

test("polling de operação já terminal não repete a consulta", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const mock = mockFetch(() => ({ body: { ...base, status: "failed", error: "x" } }));
  renderErp(<OperationTracker operationId={base.operationId} />);
  await screen.findByText("Não aplicado");
  const count = mock.calls.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(mock.calls.length).toBe(count);
});
