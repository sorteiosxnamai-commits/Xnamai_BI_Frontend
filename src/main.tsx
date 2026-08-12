import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  api,
  type ClassifiedCustomer,
  type CustomerIntelligence,
  type CustomerRow,
  type Dashboard,
  type DeadStockResponse,
  type LeadsResponse,
  type OrderRow,
  type OrdersInsight,
  type ProductMovers,
  type ProductRow,
  type Rankings,
  type SellerRow,
  type SyncState,
} from "./api";
import { chartPath, money, moneyExact, num, pct, relativeTime, statusLabel } from "./format";
import "./style.css";

const menu = [
  "Visão geral",
  "Vendas",
  "Pedidos",
  "Produtos",
  "Clientes × pedidos",
  "Leads a recuperar",
  "Estoque parado",
  "Vendedores",
  "Sincronização",
];

const segmentLabel: Record<string, string> = {
  ativo: "Ativo",
  em_risco: "Em risco",
  recuperar: "Recuperar",
  lead_novo: "Lead novo",
};

const potentialLabel: Record<string, string> = {
  alto: "Alto",
  medio: "Médio",
  descobrir: "Descobrir",
  manter: "Manter",
};

function needsFirstLoad(syncStates: SyncState[], orderCount: number, productCount: number, customerCount: number) {
  // Already have data in the BI DB — do not auto-trigger another full sync
  if (orderCount > 0 || productCount > 0 || customerCount > 0) return false;
  if (syncStates.some((s) => s.status === "running")) return false;
  if (syncStates.some((s) => (s.records || 0) > 0 || Boolean(s.lastSuccessAt))) return false;
  return true;
}

function K({ n, v, d, c = "violet" }: { n: string; v: string; d: string; c?: string }) {
  const down = d.trim().startsWith("-");
  return (
    <article className="kpi">
      <i className={c}>↗</i>
      <span>{n}</span>
      <strong>{v}</strong>
      <small className={down ? "down" : "up"}>
        {d} <b>vs. período anterior</b>
      </small>
    </article>
  );
}

function Rank({ rows }: { rows: string[][] }) {
  if (!rows.length) return <p className="empty">Sem dados no período.</p>;
  return (
    <>
      {rows.map((r, i) => (
        <div className="rank" key={`${r[0]}-${i}`}>
          <b>{i + 1}</b>
          <span>
            <strong>{r[0]}</strong>
            <small>{r[1]}</small>
          </span>
          <em>{r[2]}</em>
        </div>
      ))}
    </>
  );
}

function App() {
  const [active, setActive] = useState(menu[0]);
  const [days, setDays] = useState(30);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [sellers, setSellers] = useState<SellerRow[]>([]);
  const [syncStates, setSyncStates] = useState<SyncState[]>([]);
  const [intelligence, setIntelligence] = useState<CustomerIntelligence | null>(null);
  const [leads, setLeads] = useState<LeadsResponse | null>(null);
  const [deadStock, setDeadStock] = useState<DeadStockResponse | null>(null);
  const [movers, setMovers] = useState<ProductMovers | null>(null);
  const [ordersInsight, setOrdersInsight] = useState<OrdersInsight | null>(null);
  const [segmentFilter, setSegmentFilter] = useState("todos");
  const [tableSort, setTableSort] = useState<{ key: string; order: "asc" | "desc" } | null>(null);
  const [orderSort, setOrderSort] = useState<{ key: string; order: "asc" | "desc" }>({
    key: "date",
    order: "desc",
  });
  const [intelLoading, setIntelLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const notify = (x: string) => {
    setToast(x);
    setTimeout(() => setToast(""), 4500);
  };

  const load = useCallback(async () => {
    if (!api.configured) {
      setError("Configure VITE_BI_API_URL e VITE_BI_API_KEY");
      setLoading(false);
      return null;
    }
    setLoading(true);
    setError("");
    try {
      // Read-only core first (no long retries). Heavy endpoints load after / on demand.
      const results = await Promise.allSettled([
        api.dashboard(days),
        api.rankings(days),
        api.orders(500, { days, sort: "date", order: "desc" }),
        api.products(200),
        api.customers(200),
        api.sellers(),
        api.syncStatus(),
      ]);
      const value = <T,>(i: number) => (results[i].status === "fulfilled" ? (results[i] as PromiseFulfilledResult<T>).value : null);
      const d = value<Dashboard>(0);
      const r = value<Rankings>(1);
      const o = value<OrderRow[]>(2) || [];
      const p = value<ProductRow[]>(3) || [];
      const c = value<CustomerRow[]>(4) || [];
      const s = value<SellerRow[]>(5) || [];
      const st = value<SyncState[]>(6) || [];
      if (d) setDashboard(d);
      if (r) setRankings(r);
      setOrders(o);
      setProducts(p);
      setCustomers(c);
      setSellers(s);
      setSyncStates(st);
      const failed = results.filter((x) => x.status === "rejected").length;
      if (failed === results.length) {
        setError("Backend indisponível no momento (rede/deploy). Tente de novo em alguns segundos.");
        return null;
      }
      // Movers in background — must not block the overview KPIs
      void api.productMovers(days || 365).then(setMovers).catch(() => undefined);
      return { syncStates: st, orders: o.length, products: p.length, customers: c.length };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados");
      return null;
    } finally {
      setLoading(false);
    }
  }, [days]);

  const loadIntelligence = useCallback(async () => {
    if (!api.configured) return;
    setIntelLoading(true);
    try {
      const [intel, leadData, dead] = await Promise.allSettled([
        api.intelligence(90, 90, {
          limit: 1000,
          segment: segmentFilter,
          sort: tableSort?.key,
          order: tableSort?.order,
        }),
        api.leads(90, 90),
        api.deadStock(90),
      ]);
      if (intel.status === "fulfilled") setIntelligence(intel.value);
      if (leadData.status === "fulfilled") setLeads(leadData.value);
      if (dead.status === "fulfilled") setDeadStock(dead.value);
    } finally {
      setIntelLoading(false);
    }
  }, [segmentFilter, tableSort]);

  const runSync = useCallback(async (full = false, silent = false) => {
    if (!api.configured || syncing) return;
    setSyncing(true);
    try {
      if (!silent) notify(full ? "Primeira carga iniciada em background…" : "Sincronização iniciada…");
      await api.syncAndWait("all", full, (st) => setSyncStates(st));
      if (!silent) notify(full ? "Primeira carga concluída." : "Dados sincronizados.");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Falha na sincronização");
    } finally {
      setSyncing(false);
    }
  }, [load, syncing]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (
      active === "Clientes × pedidos" ||
      active === "Leads a recuperar" ||
      active === "Estoque parado"
    ) {
      void loadIntelligence();
    }
  }, [active, loadIntelligence]);

  useEffect(() => {
    if (active !== "Pedidos" || !api.configured) return;
    let cancelled = false;
    (async () => {
      try {
        const [list, insight] = await Promise.all([
          api.orders(1000, { days, sort: orderSort.key, order: orderSort.order }),
          api.ordersInsight(days, 8),
        ]);
        if (!cancelled) {
          setOrders(list);
          setOrdersInsight(insight);
        }
      } catch {
        /* keep previous */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, days, orderSort]);

  const filteredOrders = useMemo(() => {
    let rows = orders.filter((x) =>
      [x.number, x.customerName, x.sellerName, x.status].join(" ").toLowerCase().includes(q.toLowerCase())
    );
    // Client-side sort for name columns (server sorts date/total/status/number)
    const key = orderSort.key;
    const asc = orderSort.order === "asc";
    if (key === "customerName" || key === "sellerName" || key === "status") {
      rows = [...rows].sort((a, b) => {
        const av = String(
          key === "customerName" ? a.customerName : key === "sellerName" ? a.sellerName : a.status
        ).toLowerCase();
        const bv = String(
          key === "customerName" ? b.customerName : key === "sellerName" ? b.sellerName : b.status
        ).toLowerCase();
        if (av < bv) return asc ? -1 : 1;
        if (av > bv) return asc ? 1 : -1;
        return 0;
      });
    } else if (key === "total") {
      rows = [...rows].sort((a, b) => (asc ? a.total - b.total : b.total - a.total));
    } else if (key === "date") {
      rows = [...rows].sort((a, b) => {
        const at = a.date ? new Date(a.date).getTime() : 0;
        const bt = b.date ? new Date(b.date).getTime() : 0;
        return asc ? at - bt : bt - at;
      });
    } else if (key === "number") {
      rows = [...rows].sort((a, b) => {
        const an = Number(a.number) || 0;
        const bn = Number(b.number) || 0;
        return asc ? an - bn : bn - an;
      });
    }
    return rows;
  }, [orders, q, orderSort]);

  const lastSync = useMemo(() => {
    const times = syncStates.map((x) => x.lastSuccessAt).filter(Boolean) as string[];
    if (!times.length) return null;
    return times.sort().at(-1) || null;
  }, [syncStates]);

  const chart = useMemo(
    () => chartPath((dashboard?.salesEvolution || []).map((x) => x.revenue)),
    [dashboard]
  );

  const statusRows = dashboard?.status || [];
  const statusTotal = statusRows.reduce((a, b) => a + b.orders, 0) || 1;
  let angle = 0;
  const donut = statusRows
    .slice(0, 5)
    .map((row, i) => {
      const colors = ["#5c5ee0", "#3db68a", "#e7a746", "#9da5b5", "#df626b"];
      const start = angle;
      const slice = (row.orders / statusTotal) * 100;
      angle += slice;
      return `${colors[i]} ${start}% ${angle}%`;
    })
    .join(", ");

  const emptyBase = needsFirstLoad(syncStates, orders.length, products.length, customers.length);
  const syncProgress = syncStates
    .filter((s) => s.status === "running" || (s.records || 0) > 0)
    .map((s) => `${s.resource}: ${s.status}${s.records ? ` (${num(s.records)})` : ""}`)
    .join(" · ");
  const k = dashboard?.kpis;
  const productRank =
    rankings?.products.map((x) => [x.name, `${num(x.quantity)} un.`, money(x.revenue)]) || [];
  const customerRank =
    rankings?.customers.map((x) => [x.name, `${num(x.orders)} pedidos`, money(x.revenue)]) || [];
  const sellerRank =
    rankings?.sellers.map((x) => [x.name, `${num(x.orders)} pedidos`, money(x.revenue)]) || [];

  const classifiedRows = useMemo(() => {
    const rows = intelligence?.customers || [];
    if (!q.trim()) return rows;
    return rows.filter((c) =>
      [c.name, c.city, c.state, c.email, c.phone, c.segment, c.potential]
        .join(" ")
        .toLowerCase()
        .includes(q.toLowerCase())
    );
  }, [intelligence, q]);

  const toggleSort = (key: string) => {
    setTableSort((prev) => {
      if (!prev || prev.key !== key) return { key, order: key === "daysSinceLastOrder" ? "asc" : "desc" };
      return { key, order: prev.order === "asc" ? "desc" : "asc" };
    });
  };

  const toggleOrderSort = (key: string) => {
    setOrderSort((prev) => {
      if (prev.key !== key) return { key, order: key === "date" || key === "total" ? "desc" : "asc" };
      return { key, order: prev.order === "asc" ? "desc" : "asc" };
    });
  };

  const sortMark = (key: string) => {
    if (!tableSort || tableSort.key !== key) return "";
    return tableSort.order === "asc" ? " ↑" : " ↓";
  };

  const orderSortMark = (key: string) => {
    if (orderSort.key !== key) return "";
    return orderSort.order === "asc" ? " ↑" : " ↓";
  };

  const leadRows = useMemo(() => {
    const rows = leads?.leads || [];
    if (!q.trim()) return rows;
    return rows.filter((c) =>
      [c.name, c.city, c.email, c.phone].join(" ").toLowerCase().includes(q.toLowerCase())
    );
  }, [leads, q]);

  return (
    <main>
      <aside>
        <div className="logo">
          <b>X</b>
          <span>
            <strong>XNAMAI</strong>
            <small>BUSINESS INTELLIGENCE</small>
          </span>
        </div>
        <nav>
          {menu.map((x, i) => (
            <button key={x} className={x === active ? "active" : ""} onClick={() => setActive(x)}>
              <i>{["⌂", "↗", "▣", "◇", "◎", "⚡", "▤", "♙", "↻"][i]}</i>
              {x}
            </button>
          ))}
        </nav>
        <div className="foot">
          <p>
            <i />
            Mercos {error && !dashboard ? "offline" : "conectado"}
            <small>Atualizado {relativeTime(lastSync)}</small>
          </p>
          <div>
            <b>PT</b>
            <span>
              Paulo Tironi<small>Administrador</small>
            </span>
          </div>
        </div>
      </aside>
      <section className="work">
        <header>
          <div>
            <h1>{active}</h1>
            <p>Decisões melhores começam com dados confiáveis.</p>
          </div>
          <label>
            ⌕
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar no BI..." />
          </label>
          <button
            className="secondary"
            disabled={syncing || !api.configured}
            onClick={() => void runSync(true)}
          >
            ☁ {syncing ? "Carregando…" : "Primeira carga"}
          </button>
          <button disabled={syncing || !api.configured} onClick={() => void runSync(false)}>
            ↻ {syncing ? "Sincronizando…" : "Sincronizar"}
          </button>
        </header>
        {toast && <div className="toast">✓ {toast}</div>}
        <div className="content">
          {error && (
            <div className="banner error">
              {error}
              <button onClick={() => void load()}>Tentar de novo</button>
            </div>
          )}
          {loading && <div className="banner">Carregando dados de produção…</div>}
          {syncing && (
            <div className="banner">
              Sincronizando com o Mercos… {syncProgress || "iniciando"}
            </div>
          )}
          {!syncing && !loading && (k?.customersTotal || customers.length) > 0 && (k?.orders || 0) === 0 && (
            <div className="banner">
              Clientes no banco, mas pedidos do período ainda não aparecem. A sync de pedidos está incompleta
              (histórico antigo). Clique em <b>Sincronizar</b> e depois use o filtro <b>Tudo</b> se quiser ver o
              histórico já importado.
              <button onClick={() => void runSync(false)}>Sincronizar pedidos</button>
            </div>
          )}
          {!syncing && !loading && (k?.customers || 0) > 0 && orders.length === 0 && (k?.orders || 0) > 0 && (
            <div className="banner">
              Há faturamento no período, mas a lista recente ainda não carregou. Tente de novo em alguns segundos.
            </div>
          )}
          {emptyBase && !syncing && !loading && !error && (
            <div className="banner">
              Base ainda vazia. Use “Primeira carga” quando quiser importar do Mercos — abrir a tela não dispara sync.
              <button onClick={() => void runSync(true)}>Primeira carga</button>
            </div>
          )}

          <div className="toolbar">
            <div>
              {[
                [30, "30 dias"],
                [90, "90 dias"],
                [365, "1 ano"],
                [1095, "3 anos"],
                [0, "Tudo"],
              ].map(([value, label]) => (
                <button
                  key={String(value)}
                  className={value === days ? "on" : ""}
                  onClick={() => setDays(Number(value))}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="export" onClick={() => notify("Exporte via API /api/v1/intelligence/*")}>
              ⇩ Exportar
            </button>
          </div>

          {(active === "Visão geral" || active === "Vendas") && (
            <>
              <section className="kpis">
                <K n="Faturamento" v={money(k?.revenue || 0)} d={pct(k?.revenueChange || 0)} />
                <K n="Pedidos" v={num(k?.orders || 0)} d={pct(k?.ordersChange || 0)} c="blue" />
                <K n="Ticket médio" v={money(k?.ticketAverage || 0)} d="—" c="green" />
                <K n="Compradores no período" v={num(k?.customers || 0)} d={`base ${num(k?.customersTotal || customers.length)}`} c="orange" />
                <K n="Cancelamentos" v={num(k?.cancellations || 0)} d="—" c="red" />
              </section>
              <section className="grid top">
                <article className="card chart">
                  <h2>Evolução das vendas</h2>
                  <p>Faturamento e pedidos no período</p>
                  <div className="sum">
                    <span>
                      Faturamento acumulado<strong>{money(k?.revenue || 0)}</strong>
                    </span>
                    <b>{pct(k?.revenueChange || 0)}</b>
                  </div>
                  <svg viewBox="0 0 520 145">
                    <defs>
                      <linearGradient id="g">
                        <stop stopColor="#5d5fdf" stopOpacity=".3" />
                        <stop offset="1" stopColor="#5d5fdf" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {chart.area && <path d={chart.area} fill="url(#g)" />}
                    {chart.line && (
                      <polyline points={chart.line} fill="none" stroke="#5d5fdf" strokeWidth="3" />
                    )}
                  </svg>
                </article>
                <article className="card status">
                  <h2>Pedidos por status</h2>
                  <p>Distribuição do período</p>
                  <div
                    className="donut"
                    style={donut ? { background: `conic-gradient(${donut})` } : undefined}
                  >
                    <span>
                      <b>{num(k?.orders || 0)}</b>
                      <small>pedidos</small>
                    </span>
                  </div>
                  {statusRows.slice(0, 5).map((x, i) => (
                    <div className="st" key={x.status}>
                      <i className={`c${i}`} />
                      <span>{statusLabel(x.status)}</span>
                      <b>{x.orders}</b>
                    </div>
                  ))}
                  {!statusRows.length && <p className="empty">Sem pedidos no período.</p>}
                </article>
              </section>
              <section className="grid lower">
                <article className="card table">
                  <h2>Pedidos recentes</h2>
                  <p>Últimas movimentações sincronizadas</p>
                  <div className="scroll">
                    <table>
                      <thead>
                        <tr>
                          {["Pedido", "Cliente", "Vendedor", "Status", "Valor"].map((x) => (
                            <th key={x}>{x}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredOrders.slice(0, 12).map((r) => (
                          <tr key={r.id}>
                            <td>#{r.number}</td>
                            <td>{r.customerName}</td>
                            <td>{r.sellerName}</td>
                            <td>
                              <mark>{statusLabel(r.status)}</mark>
                            </td>
                            <td>{moneyExact(r.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filteredOrders.length && <p className="empty pad">Nenhum pedido encontrado.</p>}
                  </div>
                </article>
                <article className="card">
                  <h2>Produtos em destaque</h2>
                  <p>Por faturamento</p>
                  <Rank rows={productRank.slice(0, 4)} />
                </article>
              </section>
              <section className="insight">
                <div>
                  <small>✦ Insight do BI</small>
                  <h2>
                    {k
                      ? `Faturamento ${pct(k.revenueChange)} no período (${money(k.revenue)})`
                      : "Aguardando primeira sincronização"}
                  </h2>
                  <p>
                    {productRank[0]
                      ? `${productRank[0][0]} lidera o ranking de produtos. Use Sincronizar para atualizar os dados do Mercos.`
                      : "Dispare uma sincronização completa para popular o painel com dados de produção."}
                  </p>
                  <button onClick={() => void runSync(true)}>Primeira carga →</button>
                </div>
              </section>
            </>
          )}

          {active === "Pedidos" && (
            <>
              <section className="kpis">
                <K n="Faturamento do período" v={money(ordersInsight?.kpis.revenue || 0)} d={`${num(ordersInsight?.kpis.orders || 0)} pedidos`} />
                <K n="Ticket médio" v={moneyExact(ordersInsight?.kpis.ticketAverage || 0)} d="valor médio" c="green" />
                <K n="Maior pedido" v={moneyExact(ordersInsight?.kpis.maxOrder || 0)} d="no período" c="blue" />
                <K n="Menor pedido" v={moneyExact(ordersInsight?.kpis.minOrder || 0)} d="> R$ 0" c="orange" />
                <K n="Pedidos" v={num(ordersInsight?.kpis.orders || filteredOrders.length)} d={days ? `${days} dias` : "tudo"} c="violet" />
              </section>
              <section className="grid lower">
                <article className="card">
                  <h2>Maiores pedidos</h2>
                  <p>Por valor no período</p>
                  <Rank
                    rows={(ordersInsight?.biggestOrders || []).map((o) => [
                      `#${o.number} · ${o.customerName}`,
                      o.date ? new Date(o.date).toLocaleDateString("pt-BR") : "—",
                      moneyExact(o.total),
                    ])}
                  />
                </article>
                <article className="card">
                  <h2>Menores pedidos</h2>
                  <p>Por valor no período</p>
                  <Rank
                    rows={(ordersInsight?.smallestOrders || []).map((o) => [
                      `#${o.number} · ${o.customerName}`,
                      o.date ? new Date(o.date).toLocaleDateString("pt-BR") : "—",
                      moneyExact(o.total),
                    ])}
                  />
                </article>
              </section>
              <section className="grid lower three">
                <article className="card">
                  <h2>Clientes que mais pediram</h2>
                  <p>Quantidade de pedidos</p>
                  <Rank
                    rows={(ordersInsight?.topCustomersByOrders || []).map((c) => [
                      c.name,
                      `${num(c.orders)} pedidos`,
                      money(c.revenue),
                    ])}
                  />
                </article>
                <article className="card">
                  <h2>Clientes com maior valor</h2>
                  <p>Faturamento no período</p>
                  <Rank
                    rows={(ordersInsight?.topCustomersByRevenue || []).map((c) => [
                      c.name,
                      `${num(c.orders)} pedidos`,
                      money(c.revenue),
                    ])}
                  />
                </article>
                <article className="card">
                  <h2>Há quanto tempo não pedem</h2>
                  <p>Clientes mais parados (histórico)</p>
                  <Rank
                    rows={(ordersInsight?.idleCustomers || []).map((c) => [
                      c.name,
                      c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("pt-BR") : "—",
                      `${num(c.daysSinceLastOrder)} dias`,
                    ])}
                  />
                </article>
              </section>
              <article className="card table">
                <h2>Pedidos</h2>
                <p>
                  {num(filteredOrders.length)} registros no filtro {days ? `de ${days} dias` : "completo"} — clique
                  nas colunas para ordenar
                </p>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        {(
                          [
                            ["number", "Pedido"],
                            ["customerName", "Cliente"],
                            ["sellerName", "Vendedor"],
                            ["status", "Status"],
                            ["date", "Data"],
                            ["total", "Valor"],
                          ] as const
                        ).map(([key, label]) => (
                          <th key={key}>
                            <button type="button" className="th-sort" onClick={() => toggleOrderSort(key)}>
                              {label}
                              {orderSortMark(key)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((r) => (
                        <tr key={r.id}>
                          <td>#{r.number}</td>
                          <td>{r.customerName}</td>
                          <td>{r.sellerName}</td>
                          <td>
                            <mark>{statusLabel(r.status)}</mark>
                          </td>
                          <td>{r.date ? new Date(r.date).toLocaleDateString("pt-BR") : "—"}</td>
                          <td>{moneyExact(r.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredOrders.length && (
                    <p className="empty pad">
                      Nenhum pedido no período selecionado. Use “Tudo” ou sincronize pedidos recentes.
                    </p>
                  )}
                </div>
              </article>
            </>
          )}

          {active === "Produtos" && (
            <>
              <section className="grid lower">
                <article className="card">
                  <h2>Mais vendidos</h2>
                  <p>Por faturamento no período</p>
                  <Rank
                    rows={(movers?.top || []).map((x) => [
                      x.name,
                      `${num(x.quantity)} un.`,
                      money(x.revenue),
                    ])}
                  />
                </article>
                <article className="card">
                  <h2>Menos giro</h2>
                  <p>Produtos com venda fraca no período</p>
                  <Rank
                    rows={(movers?.slow || []).map((x) => [
                      x.name,
                      `${num(x.quantity)} un.`,
                      money(x.revenue),
                    ])}
                  />
                </article>
              </section>
              <article className="card table">
                <h2>Catálogo</h2>
                <p>Amostra sincronizada</p>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        {["Código", "Nome", "Estoque", "Preço"].map((x) => (
                          <th key={x}>{x}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>{p.code}</td>
                          <td>{p.name}</td>
                          <td>{num(p.stock)}</td>
                          <td>{moneyExact(p.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            </>
          )}

          {active === "Clientes × pedidos" && (
            <>
              <section className="kpis">
                <K n="Ativos" v={num(intelligence?.summary.ativo || 0)} d="compraram nos últimos 3 meses" c="green" />
                <K
                  n="Em risco"
                  v={num((intelligence?.summary.em_risco || 0) + (intelligence?.summary.recuperar || 0))}
                  d="sem compra há 3+ meses"
                  c="orange"
                />
                <K n="Recuperar" v={num(intelligence?.summary.recuperar || 0)} d="parados há 6+ meses" c="red" />
                <K n="Leads novos" v={num(intelligence?.summary.lead_novo || 0)} d="sem histórico ou 1ªs compras" c="blue" />
              </section>
              <article className="card table">
                <h2>Clientes classificados</h2>
                <p>
                  Ativo = compra ≤ {intelligence?.inactiveDays || 90} dias · Em risco = 91+ dias · Recuperar ={" "}
                  {(intelligence?.inactiveDays || 90) * 2}+ dias · Lead novo = primeiros pedidos recentes
                  {intelLoading ? " · atualizando…" : ""}
                  {intelligence?.matched != null ? ` · ${num(intelligence.matched)} nesta aba` : ""}
                </p>
                <div className="toolbar" style={{ marginTop: 10 }}>
                  <div>
                    {["todos", "ativo", "em_risco", "recuperar", "lead_novo"].map((s) => (
                      <button
                        key={s}
                        className={segmentFilter === s ? "on" : ""}
                        onClick={() => setSegmentFilter(s)}
                      >
                        {s === "todos" ? "Todos" : segmentLabel[s] || s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        {(
                          [
                            ["name", "Cliente"],
                            ["segment", "Segmento"],
                            ["potential", "Potencial"],
                            ["orders", "Pedidos"],
                            ["revenue", "Faturamento"],
                            ["ticketAverage", "Ticket"],
                            ["lastOrderAt", "Última compra"],
                            ["daysSinceLastOrder", "Dias parado"],
                            ["email", "Contato"],
                          ] as const
                        ).map(([key, label]) => (
                          <th key={key}>
                            <button type="button" className="th-sort" onClick={() => toggleSort(key)}>
                              {label}
                              {sortMark(key)}
                            </button>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classifiedRows.map((c) => (
                        <tr key={c.id}>
                          <td>
                            {c.name}
                            <div className="muted">
                              {[c.city, c.state].filter(Boolean).join("/") || "—"}
                            </div>
                          </td>
                          <td>
                            <mark>{segmentLabel[c.segment] || c.segment}</mark>
                          </td>
                          <td>{potentialLabel[c.potential] || c.potential}</td>
                          <td>{num(c.orders)}</td>
                          <td>{moneyExact(c.revenue)}</td>
                          <td>{moneyExact(c.ticketAverage)}</td>
                          <td>
                            {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td>{c.daysSinceLastOrder ?? "—"}</td>
                          <td>{c.email || c.phone || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!classifiedRows.length && !intelLoading && (
                    <p className="empty pad">
                      {segmentFilter === "ativo"
                        ? "Nenhum ativo nos últimos 3 meses — sincronize pedidos recentes."
                        : segmentFilter === "em_risco"
                          ? "Nenhum cliente sem compra há 3+ meses nesta base."
                          : segmentFilter === "lead_novo"
                            ? "Nenhum lead novo encontrado."
                            : "Sem clientes classificados — sincronize pedidos."}
                    </p>
                  )}
                </div>
              </article>
            </>
          )}

          {active === "Leads a recuperar" && (
            <article className="card table">
              <h2>Leads a recuperar</h2>
              <p>
                Clientes em risco ou parados — priorizados por faturamento histórico ({leads?.count || 0}{" "}
                oportunidades)
              </p>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      {[
                        "Cliente",
                        "Segmento",
                        "Potencial",
                        "Pedidos",
                        "Histórico R$",
                        "Dias sem compra",
                        "E-mail",
                        "Telefone",
                      ].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {leadRows.map((c: ClassifiedCustomer) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>
                          <mark>{segmentLabel[c.segment] || c.segment}</mark>
                        </td>
                        <td>{potentialLabel[c.potential] || c.potential}</td>
                        <td>{num(c.orders)}</td>
                        <td>{moneyExact(c.revenue)}</td>
                        <td>{c.daysSinceLastOrder ?? "—"}</td>
                        <td>{c.email || "—"}</td>
                        <td>{c.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!leadRows.length && (
                  <p className="empty pad">Nenhum lead para recuperar com os pedidos atuais.</p>
                )}
              </div>
            </article>
          )}

          {active === "Estoque parado" && (
            <>
              <section className="kpis">
                <K
                  n="SKUs parados"
                  v={num(deadStock?.count || 0)}
                  d={`sem venda em ${deadStock?.noSaleDays || 90}d`}
                  c="red"
                />
                <K
                  n="Capital parado"
                  v={money(deadStock?.totalStockValue || 0)}
                  d="estoque × preço lista"
                  c="orange"
                />
              </section>
              <article className="card table">
                <h2>Estoque sem giro</h2>
                <p>Produtos com saldo e sem venda no período de análise</p>
                <div className="scroll">
                  <table>
                    <thead>
                      <tr>
                        {["Código", "Produto", "Saldo", "Preço", "Valor parado", "Última venda", "Status"].map(
                          (x) => (
                            <th key={x}>{x}</th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {(deadStock?.products || []).map((p) => (
                        <tr key={p.id}>
                          <td>{p.code || "—"}</td>
                          <td>{p.name}</td>
                          <td>{num(p.stock)}</td>
                          <td>{moneyExact(p.price)}</td>
                          <td>{moneyExact(p.stockValue)}</td>
                          <td>
                            {p.lastSaleAt ? new Date(p.lastSaleAt).toLocaleDateString("pt-BR") : "—"}
                          </td>
                          <td>
                            <mark>{p.neverSold ? "Nunca vendeu" : `${p.daysSinceLastSale} dias`}</mark>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!deadStock?.products?.length && (
                    <p className="empty pad">Sem estoque parado — ou ainda faltam pedidos/itens sincronizados.</p>
                  )}
                </div>
              </article>
            </>
          )}

          {active === "Vendedores" && (
            <article className="card">
              <h2>Vendedores</h2>
              <p>Performance no período</p>
              <Rank rows={sellerRank} />
              <div className="scroll" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      {["Nome", "Ativo"].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sellers.map((s) => (
                      <tr key={s.id}>
                        <td>{s.name}</td>
                        <td>{s.active ? "Sim" : "Não"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          )}

          {active === "Sincronização" && (
            <article className="card">
              <h2>Status da sincronização</h2>
              <p>Origem: Mercos Adaptor → BI Backend → Supabase</p>
              <div className="scroll" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      {["Recurso", "Status", "Registros", "Último sucesso", "Erro"].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {syncStates.map((s) => (
                      <tr key={s.resource}>
                        <td>{s.resource}</td>
                        <td>{s.status}</td>
                        <td>{num(s.records || 0)}</td>
                        <td>{relativeTime(s.lastSuccessAt)}</td>
                        <td>{s.error || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!syncStates.length && (
                  <p className="empty pad">Nenhuma sincronização registrada ainda.</p>
                )}
              </div>
              <div className="sync-actions">
                <button disabled={syncing} onClick={() => void runSync(true)}>
                  Primeira carga (completa)
                </button>
                <button disabled={syncing} onClick={() => void runSync(false)}>
                  Sync incremental (só o novo)
                </button>
              </div>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
