import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../../api/client";
import { QueryState } from "../feedback/QueryState";
import type { AnalyticsFilters, OrderAnalyticsRow } from "../../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function OrderItems({
  orderId,
  filters,
}: {
  orderId: string;
  filters: AnalyticsFilters;
}) {
  const detail = useQuery({
    queryKey: ["analytics", "order-detail", orderId, filters],
    queryFn: () => analyticsApi.orderDetail(orderId, filters),
  });
  if (detail.isLoading || detail.error) {
    return (
      <QueryState
        loading={detail.isLoading}
        error={detail.error as Error | null}
        onRetry={() => void detail.refetch()}
      />
    );
  }
  const items = detail.data?.items ?? [];
  if (items.length === 0) {
    return <p className="table-note">Este pedido não tem itens persistidos.</p>;
  }
  return (
    <table className="data-table nested-order-items">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Qtd.</th>
          <th>Unitário do pedido</th>
          <th>Preço de tabela</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id || item.position}>
            <td>{item.name}</td>
            <td>{item.quantity.toLocaleString("pt-BR")}</td>
            <td>{money.format(item.sourceUnitPrice)}</td>
            <td>
              {item.unitPrice == null ? "Indisponível" : money.format(item.unitPrice)}
            </td>
            <td>{item.total == null ? "Indisponível" : money.format(item.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ExpandableOrderHistory({
  orders,
  filters,
  extraColumn = "seller",
}: {
  orders: OrderAnalyticsRow[];
  filters: AnalyticsFilters;
  extraColumn?: "seller" | "customer";
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const extraLabel = extraColumn === "seller" ? "Vendedor" : "Cliente";

  if (orders.length === 0) {
    return <p className="table-note">Nenhum pedido no período filtrado.</p>;
  }

  return (
    <div className="data-table-wrap">
      <table className="data-table order-history">
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Data</th>
            <th>{extraLabel}</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const expanded = expandedId === order.id;
            const extraName =
              extraColumn === "seller" ? order.sellerName : order.customerName;
            return (
              <Fragment key={order.id}>
                <tr className={expanded ? "is-expanded" : undefined}>
                  <td>
                    <button
                      type="button"
                      className="order-expand"
                      aria-expanded={expanded}
                      aria-controls={`order-items-${order.id}`}
                      onClick={() =>
                        setExpandedId(expanded ? null : order.id)
                      }
                    >
                      <span aria-hidden="true">{expanded ? "▾" : "▸"}</span>
                      {order.number}
                    </button>
                  </td>
                  <td>
                    {order.issuedAt
                      ? new Date(order.issuedAt).toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  <td>{extraName || "—"}</td>
                  <td>{money.format(order.total)}</td>
                </tr>
                {expanded && (
                  <tr className="order-items-row">
                    <td colSpan={4} id={`order-items-${order.id}`}>
                      <OrderItems orderId={order.id} filters={filters} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
