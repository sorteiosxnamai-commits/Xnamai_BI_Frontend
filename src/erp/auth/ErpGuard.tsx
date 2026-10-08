import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { refreshSession } from "../../auth/session";
import { LoginPage } from "../../pages/LoginPage";
import { ERP_AUTH_EXPIRED, ErpApiError, erpRequest } from "../api/client";
import { capabilitiesSchema, meSchema } from "../api/schemas";
import { StatePanel } from "../components/StatePanel";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ErpContext, type ErpContextValue } from "./context";
import { ErpLoginPage } from "./ErpLoginPage";
import { clearErpSession, erpAccessToken, erpLogout, erpRefresh } from "./erpSession";

type Phase = "checking" | "login" | "bi-login" | "ready";

/**
 * Guard local do ERP. Duas formas de entrar:
 *  1. login individual do ERP (sessão própria, cookie httpOnly rotativo);
 *  2. login do BI, só para o administrador de bootstrap criar os operadores.
 * Identidade autenticada não garante autorização: /me e /capabilities decidem.
 * O AuthProvider legado não é alterado (ele pula o refresh em rota pública).
 */
export function ErpGuard({ children }: { children: ReactNode }) {
  const { user, loading, signOut: biSignOut } = useAuth();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("checking");

  useEffect(() => {
    if (loading) return;
    if (phase === "bi-login" && user) {
      setPhase("ready");
      return;
    }
    if (phase !== "checking") return;
    let cancelled = false;
    (async () => {
      if (await erpRefresh()) return "ready" as Phase;
      if (user) return "ready" as Phase;
      try {
        return (await refreshSession()) ? ("ready" as Phase) : ("login" as Phase);
      } catch {
        return "login" as Phase;
      }
    })().then((next) => {
      if (!cancelled) setPhase(next);
    });
    return () => {
      cancelled = true;
    };
  }, [loading, user, phase]);

  const [notice, setNotice] = useState("");
  const goLogin = useCallback(() => {
    clearErpSession();
    queryClient.removeQueries({ queryKey: ["erp"] });
    setPhase("login");
  }, [queryClient]);

  // Qualquer chamada do ERP que perca a sessão (não só /me) leva ao login com aviso.
  useEffect(() => {
    const onExpired = () => {
      setNotice("Sua sessão expirou. Entre novamente para continuar.");
      goLogin();
    };
    window.addEventListener(ERP_AUTH_EXPIRED, onExpired);
    return () => window.removeEventListener(ERP_AUTH_EXPIRED, onExpired);
  }, [goLogin]);

  const me = useQuery({
    queryKey: ["erp", "me"],
    queryFn: () => erpRequest("/me", meSchema),
    enabled: phase === "ready",
    retry: false,
    staleTime: 60_000,
  });
  const connectionId = me.data?.connectionId;
  const pendingPassword = Boolean(me.data?.mustChangePassword);
  const capabilities = useQuery({
    queryKey: ["erp", connectionId, "capabilities"],
    queryFn: () => erpRequest("/capabilities", capabilitiesSchema),
    enabled: Boolean(connectionId) && !pendingPassword,
    staleTime: 30_000,
  });

  const unauthorized = me.error instanceof ErpApiError && me.error.status === 401;
  useEffect(() => {
    if (unauthorized) goLogin();
  }, [unauthorized, goLogin]);

  const signOut = useCallback(async () => {
    try {
      if (erpAccessToken()) await erpLogout();
      if (user) await biSignOut();
    } finally {
      queryClient.removeQueries({ queryKey: ["erp"] });
      clearErpSession();
      setPhase("login");
    }
  }, [user, biSignOut, queryClient]);

  const value = useMemo<ErpContextValue | null>(() => {
    if (!me.data || !capabilities.data) return null;
    const permissions = new Set(me.data.permissions);
    return {
      me: me.data,
      connectionId: me.data.connectionId,
      capabilities: capabilities.data.items,
      can: (permission) => permissions.has("*") || permissions.has(permission),
      capability: (key) => capabilities.data.items.find((item) => item.key === key),
      signOut,
    };
  }, [me.data, capabilities.data, signOut]);

  if (loading || phase === "checking") return <StatePanel kind="loading" />;
  if (phase === "login") {
    return (
      <ErpLoginPage
        notice={notice}
        onSuccess={() => {
          setNotice("");
          queryClient.removeQueries({ queryKey: ["erp"] });
          setPhase("ready");
        }}
        onUseBiLogin={() => setPhase("bi-login")}
      />
    );
  }
  if (phase === "bi-login") return user ? <StatePanel kind="loading" /> : <LoginPage />;
  if (me.isLoading || unauthorized) return <StatePanel kind="loading" />;
  if (me.error instanceof ErpApiError) {
    if (me.error.disabled) {
      return (
        <StatePanel
          kind="unavailable"
          title="Módulo ERP desativado"
          message="O ERP está desligado neste ambiente (ERP_ENABLED). Peça a um administrador para habilitá-lo."
          action={<Link to="/">Voltar ao início</Link>}
        />
      );
    }
    if (me.error.status === 403) {
      return (
        <StatePanel
          kind="forbidden"
          title="Sem acesso ao ERP"
          message={`${me.error.message}. O login do BI não identifica pessoas no ERP: entre com o seu usuário individual do ERP.`}
          action={
            <button type="button" className="erp-btn" onClick={() => void signOut()}>
              Entrar com usuário do ERP
            </button>
          }
        />
      );
    }
    return <StatePanel kind="error" message={me.error.message} onRetry={() => void me.refetch()} />;
  }
  if (me.error) {
    return <StatePanel kind="error" message={(me.error as Error).message} onRetry={() => void me.refetch()} />;
  }
  if (pendingPassword) {
    return (
      <main className="login-page">
        <div style={{ width: "min(520px, 100%)" }}>
          <ChangePasswordForm forced onDone={() => void me.refetch()} />
        </div>
      </main>
    );
  }
  if (capabilities.isLoading || !value) {
    if (capabilities.error) {
      return (
        <StatePanel
          kind="error"
          message={(capabilities.error as Error).message}
          onRetry={() => void capabilities.refetch()}
        />
      );
    }
    return <StatePanel kind="loading" />;
  }
  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}
