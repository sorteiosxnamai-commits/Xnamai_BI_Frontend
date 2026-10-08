import { createContext, useContext } from "react";
import type { Capability, Me } from "../api/schemas";

export type ErpContextValue = {
  me: Me;
  connectionId: string;
  capabilities: Capability[];
  /** `*` (administrador ERP) ou permissão exata. A autoridade final é o backend. */
  can: (permission: string) => boolean;
  capability: (key: string) => Capability | undefined;
  signOut: () => Promise<void>;
};

export const ErpContext = createContext<ErpContextValue | null>(null);

export function useErp(): ErpContextValue {
  const value = useContext(ErpContext);
  if (!value) throw new Error("useErp deve ser usado dentro do ErpGuard");
  return value;
}
