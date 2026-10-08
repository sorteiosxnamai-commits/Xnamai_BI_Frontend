/**
 * Flag de build do ERP. Desativada: o cartão some do portal e a rota /erp não
 * abre. O backend continua sendo a autoridade da flag e das permissões
 * (ERP_ENABLED responde 404 quando desligado).
 */
export function erpEnabled(): boolean {
  return import.meta.env.VITE_ERP_ENABLED === "true";
}

/** Rota do ERP com limite de segmento: /erp ou /erp/..., nunca /erpfoo. */
export function isErpPath(pathname: string): boolean {
  return pathname === "/erp" || pathname.startsWith("/erp/");
}

export const ERP_TIMEZONE = "America/Sao_Paulo";
