export const money = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const moneyExact = (n: number) =>
  (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const num = (n: number) => (n || 0).toLocaleString("pt-BR");

export const pct = (n: number) => `${n > 0 ? "+" : ""}${(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export const statusLabel = (s: string | number | null | undefined) => {
  const x = String(s ?? "").toLowerCase().trim();
  // Mercos v2 pedidos: 0=Cancelado, 1=Orçamento, 2=Pedido
  if (x === "0" || ["cancelled", "cancelado"].includes(x)) return "Cancelado";
  if (x === "1" || ["orcamento", "orçamento", "budget", "quote", "pending", "pendente"].includes(x)) return "Orçamento";
  if (x === "2" || ["pedido", "order"].includes(x)) return "Pedido";
  if (["4", "delivered", "entregue"].includes(x)) return "Entregue";
  if (["3", "shipped", "em trânsito", "em transito", "processing", "processando"].includes(x)) return "Em trânsito";
  if (x === "5") return "Cancelado";
  return x || "—";
};

export const relativeTime = (iso: string | null | undefined) => {
  if (!iso) return "nunca";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
};

export function chartPath(values: number[], w = 520, h = 145) {
  if (!values.length) return { line: "", area: "" };
  const max = Math.max(...values, 1);
  const step = values.length === 1 ? w : w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * step;
    const y = h - (v / max) * (h - 12) - 4;
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `M0 ${h} L${pts.map(([x, y]) => `${x} ${y}`).join(" ")} L${w} ${h}Z`;
  return { line, area };
}
