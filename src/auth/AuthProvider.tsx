import { createContext, useContext } from "react";
import type { AuthUser } from "./session";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const directAccess: AuthContextValue = {
  user: { username: "acesso-direto", role: "admin" },
  loading: false,
  signIn: () => Promise.resolve(),
  signOut: () => Promise.resolve(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <AuthContext.Provider value={directAccess}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return value;
}
