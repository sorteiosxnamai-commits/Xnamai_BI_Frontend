import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { ZodType } from "zod";
import { buildQuery } from "../api/client";
import { useErpQuery } from "../api/hooks";
import { type Order, orderSchema, type Page, pageOf } from "../api/schemas";
import { formatMoney } from "../format";
import { StatePanel } from "./StatePanel";

const schema = pageOf(orderSchema) as unknown as ZodType<Page<Order>>;

/**
 * Botões globais (ex.: "Nova cotação de frete") dependem de um pedido. Em vez de agir sobre uma
 * linha implícita, o operador escolhe o pedido explicitamente aqui.
 */
export function OrderPicker({
  title,
  target,
  onClose,
}: {
  title: string;
  target: (order: Order) => string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const labelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => input.current?.focus(), []);
  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(text.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [text]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const query = useErpQuery<Page<Order>>(
    ["order-picker", term],
    `/sales-orders${buildQuery({ search: term, page_size: 8, sort: "issuedAt", order: "desc" })}`,
    schema,
  );
  return (
    <div className="erp-modal-scrim">
      <div className="erp-modal" role="dialog" aria-modal="true" aria-labelledby={labelId}>
        <header>
          <h3 id={labelId}>{title}</h3>
          <button type="button" className="erp-btn" onClick={onClose}>
            Fechar
          </button>
        </header>
        <label className="erp-field">
          <span>Escolha o pedido</span>
          <input
            ref={input}
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Número, cliente ou produto"
          />
        </label>
        {query.isLoading && <StatePanel kind="loading" />}
        {query.error && (
          <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />
        )}
        {query.data && query.data.items.length === 0 && (
          <StatePanel kind="empty" message="Nenhum pedido encontrado para essa busca." />
        )}
        {query.data && query.data.items.length > 0 && (
          <ul className="erp-picker-list">
            {query.data.items.map((order) => (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(target(order));
                  }}
                >
                  <strong>#{order.number ?? order.id}</strong>
                  <span>{order.customerName ?? order.customerId ?? "Cliente não informado"}</span>
                  <span>{formatMoney(order.netTotal)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
