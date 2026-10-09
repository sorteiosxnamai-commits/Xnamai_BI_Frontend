import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * Escopo do painel (busca e período) vive na URL: abrir o link direto, recarregar e compartilhar
 * reproduzem a mesma visão. O cabeçalho escreve aqui; as páginas leem daqui.
 * Datas são dias civis (AAAA-MM-DD), sem fuso: o filtro do backend compara `issue_date`.
 */
export const SCOPE_KEYS = { search: "search", from: "from", to: "to" } as const;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function validDay(value: string | null): string | undefined {
  if (!value || !DAY.test(value)) return undefined;
  return Number.isNaN(new Date(`${value}T12:00:00`).getTime()) ? undefined : value;
}

export function useScope() {
  const [params, setParams] = useSearchParams();
  const search = params.get(SCOPE_KEYS.search) ?? "";
  const from = validDay(params.get(SCOPE_KEYS.from));
  const to = validDay(params.get(SCOPE_KEYS.to));
  const set = useCallback(
    (changes: Record<string, string | undefined>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === "") next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return useMemo(() => ({ search, from, to, params, set }), [search, from, to, params, set]);
}

export function periodSearch(params: URLSearchParams): string {
  const keep = new URLSearchParams();
  for (const key of [SCOPE_KEYS.from, SCOPE_KEYS.to]) {
    const value = validDay(params.get(key));
    if (value) keep.set(key, value);
  }
  const text = keep.toString();
  return text ? `?${text}` : "";
}

export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function presetPeriods(now = new Date()): { label: string; from: string; to: string }[] {
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return isoDay(d);
  };
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const prevFirst = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevLast = new Date(now.getFullYear(), now.getMonth(), 0);
  return [
    { label: "Hoje", from: day(0), to: day(0) },
    { label: "Últimos 7 dias", from: day(-6), to: day(0) },
    { label: "Últimos 30 dias", from: day(-29), to: day(0) },
    { label: "Este mês", from: isoDay(first), to: isoDay(last) },
    { label: "Mês anterior", from: isoDay(prevFirst), to: isoDay(prevLast) },
  ];
}

export function periodLabel(from?: string, to?: string): string {
  const fmt = (v: string) => `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`;
  if (from && to) return `${fmt(from)} – ${fmt(to)}`;
  if (from) return `a partir de ${fmt(from)}`;
  if (to) return `até ${fmt(to)}`;
  return "Todo o período";
}
