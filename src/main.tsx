import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  api,
  type CustomerRow,
  type Dashboard,
  type OrderRow,
  type ProductRow,
  type Rankings,
  type SellerRow,
  type SyncState,
} from "./api";
import { chartPath, money, moneyExact, num, pct, relativeTime, statusLabel } from "./format";
import "./style.css";

const menu = ["Visão geral", "Vendas", "Pedidos", "Produtos", "Clientes", "Vendedores", "Estoque", "Sincronização"];

function needsFirstLoad(syncStates: SyncState[], orderCount: number, productCount: number, customerCount: number) {
  if (!syncStates.length) return true;
  if (syncStates.every((s) => !s.lastSuccessAt)) return true;
  return orderCount === 0 && productCount === 0 && customerCount === 0;
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
  const [syncing, setSyncing] = useState(false);
  const autoFirstLoadDone = useRef(false);

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
      const [d, r, o, p, c, s, st] = await Promise.all([
        api.dashboard(days),
        api.rankings(days),
        api.orders(80),
        api.products(80),
        api.customers(80),
        api.sellers(),
        api.syncStatus(),
      ]);
      setDashboard(d);
      setRankings(r);
      setOrders(o);
      setProducts(p);
      setCustomers(c);
      setSellers(s);
      setSyncStates(st);
      return { syncStates: st, orders: o.length, products: p.length, customers: c.length };
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar dados");
      return null;
    } finally {
      setLoading(false);
    }
  }, [days]);

  const runSync = useCallback(async (full = false, silent = false) => {
    if (!api.configured) return;
    setSyncing(true);
    try {
      if (!silent) notify(full ? "Primeira carga em andamento…" : "Sincronização incremental…");
      await api.sync("all", full);
      if (!silent) notify(full ? "Primeira carga concluída." : "Dados novos sincronizados.");
      await load();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Falha na sincronização");
    } finally {
      setSyncing(false);
    }
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await load();
      if (cancelled || !result || autoFirstLoadDone.current) return;
      if (needsFirstLoad(result.syncStates, result.orders, result.products, result.customers)) {
        autoFirstLoadDone.current = true;
        notify("Base vazia — iniciando primeira carga automática…");
        setSyncing(true);
        try {
          await api.sync("all", true);
          if (!cancelled) {
            notify("Primeira carga concluída.");
            await load();
          }
        } catch (e) {
          if (!cancelled) notify(e instanceof Error ? e.message : "Falha na primeira carga");
        } finally {
          if (!cancelled) setSyncing(false);
        }
      } else {
        autoFirstLoadDone.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((x) =>
        [x.number, x.customerName, x.sellerName, x.status].join(" ").toLowerCase().includes(q.toLowerCase())
      ),
    [orders, q]
  );

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
  const k = dashboard?.kpis;
  const productRank =
    rankings?.products.map((x) => [x.name, `${num(x.quantity)} un.`, money(x.revenue)]) || [];
  const customerRank =
    rankings?.customers.map((x) => [x.name, `${num(x.orders)} pedidos`, money(x.revenue)]) || [];
  const sellerRank =
    rankings?.sellers.map((x) => [x.name, `${num(x.orders)} pedidos`, money(x.revenue)]) || [];

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
              <i>{["⌂", "↗", "▣", "◇", "◎", "♙", "▤", "↻"][i]}</i>
              {x}
            </button>
          ))}
        </nav>
        <div className="foot">
          <p>
            <i />
            Mercos {error ? "offline" : "conectado"}
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
          {syncing && <div className="banner">Sincronizando com o Mercos Adaptor…</div>}
          {emptyBase && !syncing && !loading && (
            <div className="banner">
              Base ainda vazia. A primeira carga roda automaticamente; você também pode disparar manualmente.
              <button onClick={() => void runSync(true)}>Primeira carga</button>
            </div>
          )}

          <div className="toolbar">
            <div>
              {[7, 30, 90, 365].map((x) => (
                <button key={x} className={x === days ? "on" : ""} onClick={() => setDays(x)}>
                  {x === 365 ? "Este ano" : `${x} dias`}
                </button>
              ))}
            </div>
            <button className="export" onClick={() => notify("Use a API /api/v1/dashboard para exportar.")}>
              ⇩ Exportar
            </button>
          </div>

          {(active === "Visão geral" || active === "Vendas") && (
            <>
              <section className="kpis">
                <K n="Faturamento" v={money(k?.revenue || 0)} d={pct(k?.revenueChange || 0)} />
                <K n="Pedidos" v={num(k?.orders || 0)} d={pct(k?.ordersChange || 0)} c="blue" />
                <K n="Ticket médio" v={money(k?.ticketAverage || 0)} d="—" c="green" />
                <K n="Clientes ativos" v={num(k?.customers || 0)} d="—" c="orange" />
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
            <article className="card table">
              <h2>Pedidos</h2>
              <p>{num(filteredOrders.length)} registros</p>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      {["Pedido", "Cliente", "Vendedor", "Status", "Data", "Valor"].map((x) => (
                        <th key={x}>{x}</th>
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
              </div>
            </article>
          )}

          {active === "Produtos" && (
            <article className="card">
              <h2>Produtos</h2>
              <p>Por faturamento no período</p>
              <Rank rows={productRank} />
              <div className="scroll" style={{ marginTop: 16 }}>
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
          )}

          {active === "Clientes" && (
            <article className="card">
              <h2>Clientes</h2>
              <p>Ranking e cadastro</p>
              <Rank rows={customerRank} />
              <div className="scroll" style={{ marginTop: 16 }}>
                <table>
                  <thead>
                    <tr>
                      {["Nome", "Cidade", "UF", "E-mail", "Telefone"].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td>{c.city || "—"}</td>
                        <td>{c.state || "—"}</td>
                        <td>{c.email || "—"}</td>
                        <td>{c.phone || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
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

          {active === "Estoque" && (
            <article className="card table">
              <h2>Estoque</h2>
              <p>Saldo sincronizado do Mercos</p>
              <div className="scroll">
                <table>
                  <thead>
                    <tr>
                      {["Código", "Produto", "Saldo", "Preço lista"].map((x) => (
                        <th key={x}>{x}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...products]
                      .sort((a, b) => (a.stock || 0) - (b.stock || 0))
                      .map((p) => (
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
