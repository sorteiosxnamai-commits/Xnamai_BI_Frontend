import { lazy, type ComponentType } from "react";

const RELOAD_KEY = "bi-chunk-reload";

export function lazyPage(loader: () => Promise<{ default: ComponentType<any> }>) {
  return lazy(async () => {
    try {
      const module = await loader();
      sessionStorage.removeItem(RELOAD_KEY);
      return module;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const staleChunk = /Failed to fetch dynamically imported module|Loading chunk|404/i.test(
        message,
      );
      if (staleChunk && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        return new Promise(() => undefined);
      }
      sessionStorage.removeItem(RELOAD_KEY);
      throw error;
    }
  });
}
