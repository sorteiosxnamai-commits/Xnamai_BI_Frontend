import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  applyAppearance,
  persistAppearance,
  readAppearance,
  resolveAppearance,
  type Appearance,
  type ResolvedAppearance,
} from "./appearance";

type AppearanceContextValue = {
  preference: Appearance;
  resolved: ResolvedAppearance;
  setPreference: (next: Appearance) => void;
};

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<Appearance>(readAppearance);
  const [resolved, setResolved] = useState<ResolvedAppearance>(() =>
    resolveAppearance(preference),
  );

  useEffect(() => {
    setResolved(applyAppearance(preference));
    persistAppearance(preference);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyAppearance(preference));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((next: Appearance) => {
    setPreferenceState(next);
  }, []);

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );

  return (
    <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
  );
}

export function useAppearance(): AppearanceContextValue {
  const value = useContext(AppearanceContext);
  if (!value) {
    throw new Error("useAppearance deve ser usado dentro de AppearanceProvider");
  }
  return value;
}
