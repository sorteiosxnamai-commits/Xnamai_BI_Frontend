import type { ReactNode } from "react";
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test } from "vitest";
import {
  APPEARANCE_KEY,
  applyAppearance,
  readAppearance,
  resolveAppearance,
} from "./appearance";
import { AppearanceProvider, useAppearance } from "./AppearanceProvider";
import { AppearanceSelect } from "./AppearanceSelect";

function mockMatchMedia(dark: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-color-scheme: dark") ? dark : false,
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

function wrapper({ children }: { children: ReactNode }) {
  return <AppearanceProvider>{children}</AppearanceProvider>;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
  mockMatchMedia(false);
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

test("defaults to the system appearance", () => {
  mockMatchMedia(true);
  expect(readAppearance()).toBe("system");
  expect(resolveAppearance("system")).toBe("dark");
  expect(applyAppearance("system")).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.documentElement.style.colorScheme).toBe("dark");
});

test("light preference wins over a dark system", () => {
  mockMatchMedia(true);
  expect(applyAppearance("light")).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("stores the chosen appearance and applies it", () => {
  mockMatchMedia(true);
  const { result } = renderHook(() => useAppearance(), { wrapper });

  expect(result.current.preference).toBe("system");
  expect(result.current.resolved).toBe("dark");

  act(() => result.current.setPreference("light"));

  expect(result.current.preference).toBe("light");
  expect(result.current.resolved).toBe("light");
  expect(localStorage.getItem(APPEARANCE_KEY)).toBe("light");
  expect(document.documentElement.dataset.theme).toBe("light");
});

test("restores a saved dark preference", () => {
  localStorage.setItem(APPEARANCE_KEY, "dark");
  mockMatchMedia(false);
  const { result } = renderHook(() => useAppearance(), { wrapper });
  expect(result.current.preference).toBe("dark");
  expect(result.current.resolved).toBe("dark");
});

test("appearance select exposes system, light and dark", async () => {
  const user = userEvent.setup();
  render(
    <AppearanceProvider>
      <AppearanceSelect />
    </AppearanceProvider>,
  );

  const select = screen.getByLabelText("Aparência");
  expect(select).toHaveDisplayValue("Sistema");
  await user.selectOptions(select, "dark");
  expect(localStorage.getItem(APPEARANCE_KEY)).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
});
