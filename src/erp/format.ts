import { ERP_TIMEZONE } from "./config";

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: ERP_TIMEZONE,
  dateStyle: "short",
  timeStyle: "short",
});

/** Instante (UTC ISO) apresentado em America/Sao_Paulo. */
export function formatInstant(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateTime.format(date);
}

/**
 * Data sem hora (vencimento, emissão): apenas rearranja o texto. Converter via
 * Date aplicaria fuso e poderia mostrar o dia anterior.
 */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "—";
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Dinheiro vem do contrato como string decimal; ausente continua "—", não R$ 0,00. */
export function formatMoney(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number) ? currency.format(number) : "—";
}

export function formatQuantity(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("pt-BR", { maximumFractionDigits: 4 })
    : "—";
}

/**
 * Normaliza digitação de dinheiro sem perder precisão: aceita "1.234,56",
 * "1234,5" e "1234.56"; no máximo 2 casas; devolve "1234.56" ou null.
 */
export function parseMoneyInput(text: string): string | null {
  const raw = text.trim().replace(/^R\$\s*/, "");
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(",")) normalized = raw.replace(/\./g, "").replace(",", ".");
  else if ((raw.match(/\./g) || []).length > 1) normalized = raw.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return normalized;
}

/** Quantidade: até 4 casas decimais, estritamente positiva. */
export function parseQuantityInput(text: string): string | null {
  const raw = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,4})?$/.test(raw)) return null;
  return Number(raw) > 0 ? raw : null;
}

/** Documentos alfanuméricos são válidos: não se removem letras. */
export function isValidDocument(text: string): boolean {
  return /^[A-Za-z0-9./\- ]{3,40}$/.test(text.trim());
}

export function newIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") return cryptoApi.randomUUID();
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
