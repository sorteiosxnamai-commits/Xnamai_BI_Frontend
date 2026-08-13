import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  login,
  logout,
  refreshSession,
  type AuthUser,
} from "./session";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const expire = () => setUser(null);
    window.addEventListener("bi-auth-expired", expire);
    void refreshSession()
      .then((session) => {
        if (active) setUser(session?.user || null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("bi-auth-expired", expire);
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
        await logout();
        setUser(null);
      },
    }),
    [loading, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return value;
}
