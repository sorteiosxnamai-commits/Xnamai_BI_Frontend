import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthUser } from "./session";
import { login, logout, refreshSession } from "./session";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const path = window.location.pathname;
    const publicRoute =
      path === "/" || path === "/home" || path.startsWith("/crm");
    if (publicRoute) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const session = await refreshSession();
        if (!cancelled) setUser(session?.user || null);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    const expired = () => setUser(null);
    window.addEventListener("bi-auth-expired", expired);
    return () => {
      cancelled = true;
      window.removeEventListener("bi-auth-expired", expired);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (username, password) => {
        const session = await login(username, password);
        setUser(session.user);
      },
      signOut: async () => {
        try {
          await logout();
        } finally {
          setUser(null);
        }
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return value;
}
