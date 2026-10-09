import { Suspense } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazyPage } from "../app/lazyPage";
import { ErpGuard } from "./auth/ErpGuard";
import { ErpShell } from "./components/ErpShell";
import { ErpErrorBoundary } from "./components/ErrorBoundary";
import { StatePanel } from "./components/StatePanel";
import "./erp.css";
import "./erp-panel.css";

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

const SettingsPage = lazyPage(() =>
  import("./features/settings/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const ShippingPage = lazyPage(() =>
  import("./features/shipping/ShippingPage").then((m) => ({ default: m.ShippingPage })),
);
const ShippingQuotePage = lazyPage(() =>
  import("./features/shipping/ShippingQuotePage").then((m) => ({ default: m.ShippingQuotePage })),
);
const InvoiceListPage = lazyPage(() =>
  import("./features/fiscal/InvoiceListPage").then((m) => ({ default: m.InvoiceListPage })),
);
const InvoiceDraftPage = lazyPage(() =>
  import("./features/fiscal/InvoiceDraftPage").then((m) => ({ default: m.InvoiceDraftPage })),
);
const OrderFinancePage = lazyPage(() =>
  import("./features/finance/OrderFinancePage").then((m) => ({ default: m.OrderFinancePage })),
);
const RefundsPage = lazyPage(() =>
  import("./features/refunds/RefundsPage").then((m) => ({ default: m.RefundsPage })),
);

const SETTINGS_PATHS = [
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

/** Páginas que passaram a viver em Configurações mantêm a URL e ganham o caminho de volta. */
function SettingsCrumb() {
  const { pathname } = useLocation();
  if (!SETTINGS_PATHS.some((prefix) => pathname.startsWith(prefix))) return null;
  return (
    <nav className="erp-crumb" aria-label="Você está em">
      <Link to="/erp/configuracoes">Configurações</Link>
      <span aria-hidden="true"> › </span>
    </nav>
  );
}

function Shell() {
  return (
    <ErpShell>
      <SettingsCrumb />
      <ErpErrorBoundary>
        <Suspense fallback={<StatePanel kind="loading" />}>
          <Routes>
            <Route path="/erp" element={<OverviewPage />} />
            <Route path="/erp/pedidos" element={<OrdersPage />} />
            <Route path="/erp/pedidos/novo" element={<OrderCreatePage />} />
            <Route path="/erp/pedidos/:id" element={<OrderDetailPage />} />
            <Route path="/erp/notas-fiscais" element={<InvoiceListPage />} />
            <Route path="/erp/notas-fiscais/pedidos/:id/montagem" element={<InvoiceDraftPage />} />
            <Route path="/erp/frete" element={<ShippingPage />} />
            <Route path="/erp/frete/pedidos/:id/cotacao" element={<ShippingQuotePage />} />
            <Route path="/erp/financeiro" element={<FinancePage />} />
            <Route path="/erp/financeiro/pedidos/:id" element={<OrderFinancePage />} />
            <Route path="/erp/reembolsos" element={<RefundsPage />} />
            <Route path="/erp/configuracoes" element={<SettingsPage />} />
            <Route path="/erp/clientes" element={<CustomersPage />} />
            <Route path="/erp/clientes/:id" element={<CustomerDetailPage />} />
            <Route path="/erp/produtos" element={<ProductsPage />} />
            <Route path="/erp/produtos/:id" element={<ProductDetailPage />} />
            <Route path="/erp/cadastros" element={<CatalogsPage />} />
            <Route path="/erp/externos" element={<ExternalPage />} />
            <Route path="/erp/compras" element={<PurchasingPage />} />
            <Route path="/erp/estoque" element={<InventoryPage />} />
            <Route path="/erp/integracoes" element={<IntegrationPage />} />
            <Route path="/erp/capacidades" element={<CapabilitiesPage />} />
            <Route path="/erp/admin" element={<AdminPage />} />
            <Route path="/erp/conta" element={<AccountPage />} />
            <Route path="/erp/*" element={<Navigate to="/erp" replace />} />
          </Routes>
        </Suspense>
      </ErpErrorBoundary>
    </ErpShell>
  );
}

export function ErpApp() {
  return (
    <ErpGuard>
      <Shell />
    </ErpGuard>
  );
}
