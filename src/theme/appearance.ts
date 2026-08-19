export const APPEARANCE_KEY = "bi-appearance";
export const APPEARANCE_OPTIONS = ["system", "light", "dark"] as const;

export type Appearance = (typeof APPEARANCE_OPTIONS)[number];
export type ResolvedAppearance = "light" | "dark";

export function isAppearance(value: unknown): value is Appearance {
  return value === "system" || value === "light" || value === "dark";
}

export function readAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(APPEARANCE_KEY);
    if (isAppearance(stored)) return stored;
  } catch {
    // private mode / blocked storage
  }
  return "system";
}

export function persistAppearance(preference: Appearance) {
  try {
    localStorage.setItem(APPEARANCE_KEY, preference);
  } catch {
    // ignore
  }
}

export function prefersDarkScheme(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveAppearance(preference: Appearance): ResolvedAppearance {
  if (preference === "light" || preference === "dark") return preference;
  return prefersDarkScheme() ? "dark" : "light";
}

export function applyAppearance(preference: Appearance): ResolvedAppearance {
  const resolved = resolveAppearance(preference);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  return resolved;
}
