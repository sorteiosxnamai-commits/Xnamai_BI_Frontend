import { Suspense } from "react";
import { Navigate } from "react-router-dom";
import { lazyPage } from "../app/lazyPage";
import { ErpErrorBoundary } from "./components/ErrorBoundary";
import { StatePanel } from "./components/StatePanel";
import { erpEnabled } from "./config";

// O ERP só é baixado quando alguém abre /erp: BI, CRM e varejo não pagam o custo.
const ErpApp = lazyPage(() => import("./ErpApp").then((module) => ({ default: module.ErpApp })));

/**
 * Entrada do ERP no roteador do portal. Flag de build desativada impede a rota
 * direta (o backend também nega com 404 quando ERP_ENABLED está desligado).
 */
export function ErpEntry() {
  if (!erpEnabled()) return <Navigate to="/" replace />;
  return (
    <ErpErrorBoundary>
      <Suspense fallback={<StatePanel kind="loading" />}>
        <ErpApp />
      </Suspense>
    </ErpErrorBoundary>
  );
}
