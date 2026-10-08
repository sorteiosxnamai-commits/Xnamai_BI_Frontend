import { Suspense } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazyPage } from "../app/lazyPage";
import { AppearanceSelect } from "../theme/AppearanceSelect";
import { ErpGuard } from "./auth/ErpGuard";
import { useErp } from "./auth/context";
import { ErpErrorBoundary } from "./components/ErrorBoundary";
import { StatePanel } from "./components/StatePanel";
import "./erp.css";

const OverviewPage = lazyPage(() =>
  import("./features/OverviewPage").then((m) => ({ default: m.OverviewPage })),
);
const CustomersPage = lazyPage(() =>
  import("./features/customers/CustomersPage").then((m) => ({ default: m.CustomersPage })),
);
const CustomerDetailPage = lazyPage(() =>
  import("./features/customers/CustomerDetailPage").then((m) => ({ default: m.CustomerDetailPage })),
);
const ProductsPage = lazyPage(() =>
  import("./features/products/ProductsPage").then((m) => ({ default: m.ProductsPage })),
);
const ProductDetailPage = lazyPage(() =>
  import("./features/products/ProductDetailPage").then((m) => ({ default: m.ProductDetailPage })),
);
const OrdersPage = lazyPage(() =>
  import("./features/orders/OrdersPage").then((m) => ({ default: m.OrdersPage })),
);
const OrderDetailPage = lazyPage(() =>
  import("./features/orders/OrderDetailPage").then((m) => ({ default: m.OrderDetailPage })),
);
const OrderCreatePage = lazyPage(() =>
  import("./features/orders/OrderCreatePage").then((m) => ({ default: m.OrderCreatePage })),
);
const CatalogsPage = lazyPage(() =>
  import("./features/CatalogsPage").then((m) => ({ default: m.CatalogsPage })),
);
const ExternalPage = lazyPage(() =>
  import("./features/ExternalPage").then((m) => ({ default: m.ExternalPage })),
);
const PurchasingPage = lazyPage(() =>
  import("./features/purchasing/PurchasingPage").then((m) => ({ default: m.PurchasingPage })),
);
const InventoryPage = lazyPage(() =>
  import("./features/inventory/InventoryPage").then((m) => ({ default: m.InventoryPage })),
);
const FinancePage = lazyPage(() =>
  import("./features/finance/FinancePage").then((m) => ({ default: m.FinancePage })),
);
const IntegrationPage = lazyPage(() =>
  import("./features/integration/IntegrationPage").then((m) => ({ default: m.IntegrationPage })),
);
const CapabilitiesPage = lazyPage(() =>
  import("./features/CapabilitiesPage").then((m) => ({ default: m.CapabilitiesPage })),
);
const AccountPage = lazyPage(() =>
  import("./features/AccountPage").then((m) => ({ default: m.AccountPage })),
);
const AdminPage = lazyPage(() =>
  import("./features/AdminPage").then((m) => ({ default: m.AdminPage })),
);

type NavItem = { to: string; label: string; icon: string; permission?: string; end?: boolean };

const NAV: NavItem[] = [
  { to: "/erp", label: "Visão operacional", icon: "⌂", end: true },
  { to: "/erp/clientes", label: "Clientes", icon: "◎" },
  { to: "/erp/produtos", label: "Produtos", icon: "◇" },
  { to: "/erp/pedidos", label: "Pedidos e orçamentos", icon: "▣" },
  { to: "/erp/cadastros", label: "Cadastros auxiliares", icon: "▤" },
  { to: "/erp/externos", label: "Títulos, pagamentos, comissões", icon: "$", permission: "financial_links:read" },
  { to: "/erp/compras", label: "Compras e fornecedores", icon: "⇩", permission: "purchases:read" },
  { to: "/erp/estoque", label: "Estoque", icon: "▥", permission: "inventory:read" },
  { to: "/erp/financeiro", label: "Financeiro", icon: "₢", permission: "finance:read" },
  { to: "/erp/integracoes", label: "Integrações", icon: "↻", permission: "integration:read" },
  { to: "/erp/capacidades", label: "Capacidades", icon: "✓" },
  { to: "/erp/admin", label: "Administração", icon: "♙", permission: "*" },
  { to: "/erp/conta", label: "Minha conta", icon: "☺" },
];

function Shell() {
  const { me, can, signOut } = useErp();
  const location = useLocation();
  const items = NAV.filter((item) => !item.permission || can(item.permission));
  const current =
    items.find((item) => (item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)))
      ?.label ?? "ERP Xnamai";
  return (
    <div className="new-app erp-app">
      <a className="skip-link" href="#erp-content">
        Ir para o conteúdo
      </a>
      <aside className="app-sidebar">
        <div className="brand-block">
          <strong>XNAMAI</strong>
          <span>ERP · Gestão operacional</span>
        </div>
        <nav aria-label="ERP">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <i>{item.icon}</i>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/">
            <i>&lt;</i>
            Início
          </NavLink>
        </nav>
      </aside>
      <main id="erp-content" className="app-content">
        <header className="app-header">
          <div>
            <small>ERP · CONEXÃO {me.connectionId.toUpperCase()}</small>
            <h1>{current}</h1>
            <p>Dados espelhados do Mercos via Adaptor; escritas só após confirmação.</p>
          </div>
          <div className="user-menu">
            <AppearanceSelect />
            <span>
              {me.username} · {me.roles.join(", ") || "sem papel"}
            </span>
            <button type="button" onClick={() => void signOut()}>
              Sair
            </button>
          </div>
        </header>
        <div className="route-content erp-content">
          <ErpErrorBoundary>
            <Suspense fallback={<StatePanel kind="loading" />}>
              <Routes>
                <Route path="/erp" element={<OverviewPage />} />
                <Route path="/erp/clientes" element={<CustomersPage />} />
                <Route path="/erp/clientes/:id" element={<CustomerDetailPage />} />
                <Route path="/erp/produtos" element={<ProductsPage />} />
                <Route path="/erp/produtos/:id" element={<ProductDetailPage />} />
                <Route path="/erp/pedidos" element={<OrdersPage />} />
                <Route path="/erp/pedidos/novo" element={<OrderCreatePage />} />
                <Route path="/erp/pedidos/:id" element={<OrderDetailPage />} />
                <Route path="/erp/cadastros" element={<CatalogsPage />} />
                <Route path="/erp/externos" element={<ExternalPage />} />
                <Route path="/erp/compras" element={<PurchasingPage />} />
                <Route path="/erp/estoque" element={<InventoryPage />} />
                <Route path="/erp/financeiro" element={<FinancePage />} />
                <Route path="/erp/integracoes" element={<IntegrationPage />} />
                <Route path="/erp/capacidades" element={<CapabilitiesPage />} />
                <Route path="/erp/admin" element={<AdminPage />} />
                <Route path="/erp/conta" element={<AccountPage />} />
                <Route path="/erp/*" element={<Navigate to="/erp" replace />} />
              </Routes>
            </Suspense>
          </ErpErrorBoundary>
        </div>
      </main>
    </div>
  );
}

export function ErpApp() {
  return (
    <ErpGuard>
      <Shell />
    </ErpGuard>
  );
}
