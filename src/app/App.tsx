import { Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthProvider";
import { GlobalFilterBar } from "../components/filters/GlobalFilterBar";
import { QueryState } from "../components/feedback/QueryState";
import { useAnalyticsFilters } from "../hooks/useAnalyticsFilters";
import { DataQualityPage } from "../pages/DataQualityPage";
import { lazyPage } from "./lazyPage";

const LegacyDashboard = lazyPage(() =>
  import("../main").then((module) => ({ default: module.LegacyDashboard }))
);
const OverviewPage = lazyPage(() =>
  import("../pages/OverviewPage").then((module) => ({ default: module.OverviewPage }))
);
const OrdersPage = lazyPage(() =>
  import("../pages/OrdersPage").then((module) => ({ default: module.OrdersPage }))
);
const ProductsPage = lazyPage(() =>
  import("../pages/ProductsPage").then((module) => ({ default: module.ProductsPage }))
);
const CustomersPage = lazyPage(() =>
  import("../pages/CustomersPage").then((module) => ({ default: module.CustomersPage }))
);
const SellersPage = lazyPage(() =>
  import("../pages/SellersPage").then((module) => ({ default: module.SellersPage }))
);
const InventoryPage = lazyPage(() =>
  import("../pages/InventoryPage").then((module) => ({ default: module.InventoryPage }))
);
const InsightsPage = lazyPage(() =>
  import("../pages/InsightsPage").then((module) => ({ default: module.InsightsPage }))
);
const SyncPage = lazyPage(() =>
  import("../pages/SyncPage").then((module) => ({ default: module.SyncPage }))
);

const navigation: {
  path: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
}[] = [
  { path: "/overview", label: "Visão geral", icon: "⌂" },
  { path: "/orders", label: "Pedidos", icon: "▣" },
  { path: "/products", label: "Produtos", icon: "◇" },
  { path: "/customers", label: "Clientes", icon: "◎" },
  { path: "/sellers", label: "Vendedores", icon: "♙" },
  { path: "/inventory", label: "Estoque", icon: "▤" },
  { path: "/insights", label: "Geografia e coortes", icon: "◫" },
  { path: "/data-quality", label: "Qualidade dos dados", icon: "✓", adminOnly: true },
  { path: "/sync", label: "Sincronização", icon: "↻", adminOnly: true },
];

function QualityRoute() {
  const query = useQuery({
    queryKey: ["data-quality"],
    queryFn: api.dataQuality,
  });
  return (
    <DataQualityPage
      data={query.data || null}
      loading={query.isLoading || query.isFetching}
      error={query.error instanceof Error ? query.error.message : ""}
      onRetry={() => void query.refetch()}
    />
  );
}

export function App() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const syncStatus = useQuery({
    queryKey: ["sync-status"],
    queryFn: api.syncStatus,
    enabled: Boolean(user),
    refetchInterval: (query) =>
      query.state.data?.some((item) => item.status === "running") ? 5_000 : false,
  });
  const { filters, updateFilters, clearFilters, activeCount } = useAnalyticsFilters();
  const isAnalyticsRoute = [
    "/overview",
    "/orders",
    "/products",
    "/customers",
    "/sellers",
    "/inventory",
    "/insights",
  ].includes(location.pathname);
  const periodLabel =
    filters.dateFrom || filters.dateTo
      ? `${filters.dateFrom || "início"} até ${filters.dateTo || "hoje"}`
      : filters.period === "all"
        ? "Todo o histórico"
        : filters.period.toUpperCase();

  if (loading) return <QueryState loading error={null} />;
  if (!user) return <QueryState loading error={null} />;

  if (location.pathname === "/legacy") {
    return (
      <Suspense fallback={<QueryState loading error={null} />}>
        <LegacyDashboard />
      </Suspense>
    );
  }

  return (
    <div className="new-app">
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <aside className="app-sidebar">
        <div className="brand-block">
          <strong>XNAMAI</strong>
          <span>Business Intelligence</span>
        </div>
        <nav aria-label="Navegação principal">
          {navigation
            .filter((item) => !item.adminOnly || user.role === "admin")
            .map((item) => (
            <NavLink
              key={item.path}
              to={{ pathname: item.path, search: location.search }}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <i>{item.icon}</i>
              {item.label}
            </NavLink>
            ))}
        </nav>
      </aside>
      <main id="main-content" className="app-content">
        <header className="app-header">
          <div>
            <small>RAIO X COMERCIAL E OPERACIONAL</small>
            <h1>
              {navigation.find((item) => item.path === location.pathname)?.label ||
                "Business Intelligence"}
            </h1>
            {isAnalyticsRoute && <p>Período atual: {periodLabel}</p>}
          </div>
          <div className="user-menu">
            <span>
              {user.username} · {user.role}
            </span>
          </div>
        </header>
        {isAnalyticsRoute && (
          <GlobalFilterBar
            filters={filters}
            activeCount={activeCount}
            onChange={updateFilters}
            onClear={clearFilters}
          />
        )}
        {syncStatus.data?.some((item) => item.status === "running") && (
          <div className="sync-banner" role="status">
            Sincronização em andamento. Os indicadores podem mudar até a conclusão.
          </div>
        )}
        <div className="route-content">
          <Suspense fallback={<QueryState loading error={null} />}>
            <Routes>
              <Route path="/overview" element={<OverviewPage filters={filters} />} />
              <Route path="/orders" element={<OrdersPage filters={filters} />} />
              <Route path="/products" element={<ProductsPage filters={filters} />} />
              <Route
                path="/customers"
                element={
                  <CustomersPage
                    filters={filters}
                    onExcludeCustomer={(id) =>
                      updateFilters({
                        excludedCustomerIds: filters.excludedCustomerIds.includes(id)
                          ? filters.excludedCustomerIds
                          : [...filters.excludedCustomerIds, id],
                        customerIds: filters.customerIds.filter((value) => value !== id),
                      })
                    }
                  />
                }
              />
              <Route path="/sellers" element={<SellersPage filters={filters} />} />
              <Route path="/inventory" element={<InventoryPage filters={filters} />} />
              <Route path="/insights" element={<InsightsPage filters={filters} />} />
              <Route
                path="/data-quality"
                element={
                  user.role === "admin" ? (
                    <QualityRoute />
                  ) : (
                    <Navigate to="/overview" replace />
                  )
                }
              />
              <Route
                path="/sync"
                element={
                  user.role === "admin" ? (
                    <SyncPage />
                  ) : (
                    <Navigate to="/overview" replace />
                  )
                }
              />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
