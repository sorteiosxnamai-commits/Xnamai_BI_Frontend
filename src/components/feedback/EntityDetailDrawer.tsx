import { useEffect, useRef, type ReactNode } from "react";
import { QueryState } from "./QueryState";

type Props = {
  title: string;
  loading: boolean;
  error: Error | null;
  onClose: () => void;
  onRetry?: () => void;
  children: ReactNode;
};

export function EntityDetailDrawer({
  title,
  loading,
  error,
  onClose,
  onRetry,
  children,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <div className="drawer-backdrop">
      <aside
        className="detail-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="entity-detail-title"
      >
        <button
          ref={closeRef}
          type="button"
          className="drawer-close"
          onClick={onClose}
        >
          Fechar
        </button>
        <h2 id="entity-detail-title">{title}</h2>
        <QueryState loading={loading} error={error} onRetry={onRetry} />
        {!loading && !error && children}
      </aside>
    </div>
  );
}
