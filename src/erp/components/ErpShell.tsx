import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AppearanceSelect } from "../../theme/AppearanceSelect";
import { useErpQuery } from "../api/hooks";
import { operationalSummarySchema } from "../api/schemas";
import { useErp } from "../auth/context";
import { periodLabel, periodSearch, presetPeriods, useScope } from "../scope";
import { Icon, type IconName } from "./icons";

type NavItem = { to: string; label: string; icon: IconName; permission?: string; end?: boolean };

/** Menu principal, na ordem do plano. Permissão ausente = visível a todo operador com acesso ao ERP. */
export const MAIN_NAV: NavItem[] = [
  { to: "/erp", label: "Visão Geral", icon: "home", end: true },
  { to: "/erp/pedidos", label: "Pedidos", icon: "orders" },
  { to: "/erp/notas-fiscais", label: "Nota Fiscal", icon: "invoice", permission: "invoices:read" },
  { to: "/erp/frete", label: "Frete", icon: "truck", permission: "shipping:read" },
  { to: "/erp/financeiro", label: "Financeiro", icon: "chart", permission: "finance:read" },
  { to: "/erp/reembolsos", label: "Reembolsos", icon: "refund", permission: "refunds:read" },
  { to: "/erp/configuracoes", label: "Configurações", icon: "settings" },
];

/** Rotas que continuam existindo e agora vivem dentro de Configurações (URLs preservadas). */
const SETTINGS_PREFIXES = [
  "/erp/integracoes",
  "/erp/capacidades",
  "/erp/admin",
  "/erp/clientes",
  "/erp/produtos",
  "/erp/cadastros",
  "/erp/compras",
  "/erp/estoque",
  "/erp/externos",
];

const BANNER_KEY = "erp-internal-banner-dismissed";

function bannerDismissed(): boolean {
  try {
    return window.localStorage.getItem(BANNER_KEY) === "1";
  } catch {
    return false;
  }
}

function PeriodPicker() {
  const { from, to, set } = useScope();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const panel = useId();
  const button = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const available = useErpQuery(
    ["overview-orders", { dateFrom: undefined, dateTo: undefined }],
    "/operational-summary",
    operationalSummarySchema,
    { enabled: open, staleTime: 60_000 },
  );
  const firstImported = available.data?.dates?.orderDate.min;
  const lastImported = available.data?.dates?.orderDate.max;

  useEffect(() => {
    setDraftFrom(from ?? "");
    setDraftTo(to ?? "");
  }, [from, to]);
  useEffect(() => {
    if (!open) return;
    dialog.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const invalid = Boolean(draftFrom && draftTo && draftTo < draftFrom);
  function apply(nextFrom?: string, nextTo?: string) {
    set({ from: nextFrom, to: nextTo });
    setOpen(false);
    button.current?.focus();
  }
  const shell = document.querySelector(".erp-shell");
  return (
    <div className="erp-period">
      <button
        ref={button}
        type="button"
        className="erp-period-button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="calendar" />
        <span>{periodLabel(from, to)}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open && shell && createPortal(
        <div className="erp-period-overlay">
        <button type="button" className="erp-period-backdrop" aria-label="Fechar seletor de período" onClick={() => {
          setOpen(false);
          button.current?.focus();
        }} />
        <div className="erp-period-panel" id={panel} role="dialog" aria-modal="true" aria-label="Escolher período" ref={dialog} tabIndex={-1}>
          <div className="erp-period-heading">
            <div>
              <h2>Escolher período</h2>
              <p>Filtre pela data do pedido no espelho Mercos.</p>
            </div>
            <button type="button" className="erp-period-close" aria-label="Fechar período" onClick={() => {
              setOpen(false);
              button.current?.focus();
            }}>
              <Icon name="close" />
            </button>
          </div>
          <div className="erp-period-presets">
            {presetPeriods().map((preset) => (
              <button key={preset.label} type="button" onClick={() => apply(preset.from, preset.to)}>
                {preset.label}
              </button>
            ))}
          </div>
          {firstImported && lastImported && (
            <div className="erp-period-coverage">
              <span>Pedidos importados de {periodLabel(firstImported, lastImported)}.</span>
              <button
                type="button"
                onClick={() => apply(`${lastImported.slice(0, 7)}-01`, lastImported)}
              >
                Ver último mês importado
              </button>
              {!available.data?.coverage.complete && <small>A carga ainda está em andamento; datas mais recentes podem estar vazias.</small>}
            </div>
          )}
          <div className="erp-period-fields">
            <label>
              De
              <input type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} />
            </label>
            <label>
              Até
              <input type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
            </label>
          </div>
          {invalid && (
            <small className="erp-period-error" role="alert">
              A data final não pode ser anterior à inicial.
            </small>
          )}
          <div className="erp-period-actions">
            <button type="button" onClick={() => apply(undefined, undefined)}>
              Todo o período
            </button>
            <button
              type="button"
              className="primary"
              disabled={invalid || (!draftFrom && !draftTo)}
              onClick={() => apply(draftFrom || undefined, draftTo || undefined)}
            >
              Aplicar período
            </button>
          </div>
        </div>
        </div>, shell,
      )}
    </div>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const { search, params } = useScope();
  const [text, setText] = useState(search);
  useEffect(() => setText(search), [search]);
  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(periodSearch(params));
    if (text.trim()) next.set("search", text.trim());
    const query = next.toString();
    // A busca do cabeçalho é a de Pedidos (número, cliente, produto/SKU): não é uma pesquisa decorativa.
    navigate({ pathname: "/erp/pedidos", search: query ? `?${query}` : "" });
  }
  return (
    <form className="erp-header-search" aria-label="Buscar pedidos" onSubmit={submit}>
      <Icon name="search" />
      <input
        type="search"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Buscar pedidos, clientes, produtos…"
        aria-label="Buscar pedidos por número, cliente ou produto"
      />
    </form>
  );
}

function UserMenu() {
  const { me, signOut } = useErp();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    const onClick = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  const initials = me.username.slice(0, 2).toUpperCase();
  return (
    <div className="erp-user" ref={root}>
      <button type="button" className="erp-user-button" aria-expanded={open} onClick={() => setOpen((c) => !c)}>
        <span className="erp-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="erp-user-text">
          <strong>{me.username}</strong>
          <small>{me.roles.join(", ") || "sem papel"}</small>
        </span>
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <div className="erp-user-menu" role="menu">
          <Link role="menuitem" to="/erp/conta" onClick={() => setOpen(false)}>
            Minha conta
          </Link>
          <Link role="menuitem" to="/" onClick={() => setOpen(false)}>
            Voltar ao início do portal
          </Link>
          <button type="button" role="menuitem" onClick={() => void signOut()}>
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

export function ErpShell({ children }: { children: ReactNode }) {
  const { can } = useErp();
  const location = useLocation();
  const { params } = useScope();
  const [navOpen, setNavOpen] = useState(false);
  const [banner, setBanner] = useState(() => !bannerDismissed());
  const items = MAIN_NAV.filter((item) => !item.permission || can(item.permission));
  const keepPeriod = periodSearch(params);

  function isActive(item: NavItem): boolean {
    if (item.end) return location.pathname === item.to;
    if (item.to === "/erp/configuracoes") {
      return (
        location.pathname.startsWith(item.to) || SETTINGS_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))
      );
    }
    return location.pathname.startsWith(item.to);
  }

  function dismissBanner() {
    setBanner(false);
    try {
      window.localStorage.setItem(BANNER_KEY, "1");
    } catch {
      /* sem armazenamento: o aviso apenas volta no próximo acesso */
    }
  }

  return (
    <div className={`erp-shell${navOpen ? " erp-nav-open" : ""}`}>
      <a className="erp-skip" href="#erp-content">
        Ir para o conteúdo
      </a>
      <aside className="erp-sidebar" aria-label="Menu do ERP">
        <div className="erp-brand">
          <strong>XNAMAI</strong>
          <span>ERP · operação</span>
        </div>
        <nav aria-label="Navegação principal">
          {items.map((item) => (
            <Link
              key={item.to}
              to={{ pathname: item.to, search: item.to === "/erp/configuracoes" ? "" : keepPeriod }}
              className={`erp-nav-link${isActive(item) ? " active" : ""}`}
              onClick={() => setNavOpen(false)}
              aria-current={isActive(item) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <AppearanceSelect />
        <p className="erp-sidebar-foot">Uso interno — cliente não acessa este painel.</p>
      </aside>
      {navOpen && <div className="erp-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />}
      <div className="erp-main">
        <header className="erp-topbar">
          <div className="erp-topbar-inner">
            <button
              type="button"
              className="erp-menu-toggle"
              aria-label={navOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((current) => !current)}
            >
              <Icon name={navOpen ? "close" : "menu"} />
            </button>
            <HeaderSearch />
            <PeriodPicker />
            <UserMenu />
          </div>
        </header>
        {banner && (
          <div className="erp-banner" role="note">
            <Icon name="info" />
            <div>
              <strong>Uso interno — cliente não acessa este painel.</strong>
              <span>Ambiente da equipe Xnamai para acompanhar pedidos, frete, notas fiscais e atualizações.</span>
            </div>
            <button type="button" aria-label="Dispensar aviso" onClick={dismissBanner}>
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
        <main id="erp-content" className="erp-page" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
