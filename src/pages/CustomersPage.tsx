import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../api/client";
import { EntityDetailDrawer } from "../components/feedback/EntityDetailDrawer";
import { ExportButtons } from "../components/tables/ExportButtons";
import { ExpandableOrderHistory } from "../components/tables/ExpandableOrderHistory";
import {
  ServerEntityTable,
  type EntityColumn,
} from "../components/tables/ServerEntityTable";
import type {
  AnalyticsFilters,
  CustomerAnalyticsRow,
  CustomerCohortMember,
  CustomerCohortSummary,
  CustomersPageSummary,
} from "../types/analytics";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const percent = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const quantity = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function asCohort(value: unknown): CustomerCohortSummary {
  const cohort = (value && typeof value === "object" ? value : {}) as CustomerCohortSummary;
  const members = Array.isArray(cohort.members) ? cohort.members : [];
  return {
    customerCount: Number(cohort.customerCount || 0),
    orderCount: Number(cohort.orderCount || 0),
    revenue: Number(cohort.revenue || 0),
    revenueSharePct: Number(cohort.revenueSharePct || 0),
    orderSharePct: Number(cohort.orderSharePct || 0),
    averageMonthlyOrders: Number(cohort.averageMonthlyOrders || 0),
    averageRevenuePerCustomer: Number(cohort.averageRevenuePerCustomer || 0),
    averageOrderValue: Number(cohort.averageOrderValue || 0),
    members: members.map((member: CustomerCohortMember) => ({
      id: String(member.id || ""),
      name: String(member.name || member.id || "Cliente"),
      rank: Number(member.rank || 0),
      revenue: Number(member.revenue || 0),
      orderCount: Number(member.orderCount || 0),
      averageMonthlyOrders: Number(member.averageMonthlyOrders || 0),
    })),
    membersOmitted: Number(cohort.membersOmitted || 0),
  };
}

function CustomerCohortCards({
  summary,
  onSelectCustomer,
  onExcludeCustomer,
}: {
  summary: Record<string, unknown>;
  onSelectCustomer: (id: string) => void;
  onExcludeCustomer: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const data = summary as CustomersPageSummary & Record<string, unknown>;
  const cards = [
    { id: "top5", label: "Top 5", range: "1º ao 5º", cohort: asCohort(data.top5) },
    {
      id: "ranks6to10",
      label: "6º ao 10º",
      range: "próximos 5",
      cohort: asCohort(data.ranks6to10),
    },
    {
      id: "ranks11to20",
      label: "11º ao 20º",
      range: "próximos 10",
      cohort: asCohort(data.ranks11to20),
    },
    {
      id: "rest",
      label: "Demais clientes",
      range: "fora do Top 20",
      cohort: asCohort(data.rest),
    },
  ];
  const totalRevenue =
    Number(data.totalRevenue || 0) ||
    cards.reduce((sum, card) => sum + card.cohort.revenue, 0);
  const openCard = cards.find((card) => card.id === openId);
  return (
    <>
      <p className="cohort-heading">
        Faturamento do período: <strong>{money.format(totalRevenue)}</strong> dividido em
        4 faixas que somam 100%. Clique numa faixa para ver os clientes.
      </p>
      <section className="metric-grid cohorts" aria-label="Divisão de clientes por faturamento">
        {cards.map(({ id, label, range, cohort }) => {
          const expanded = openId === id;
          return (
            <article key={id} className={id === "rest" ? "rest" : undefined}>
              <button
                type="button"
                className="cohort-toggle"
                aria-expanded={expanded}
                onClick={() => setOpenId(expanded ? null : id)}
              >
                <span>
                  {label}
                  <em>{range}</em>
                </span>
                <strong>{percent.format(cohort.revenueSharePct)}%</strong>
                <b className="cohort-total">{money.format(cohort.revenue)}</b>
                <dl>
                  <div>
                    <dt>Por cliente</dt>
                    <dd>{money.format(cohort.averageRevenuePerCustomer)}</dd>
                  </div>
                  <div>
                    <dt>Ticket médio</dt>
                    <dd>{money.format(cohort.averageOrderValue)}</dd>
                  </div>
                  <div>
                    <dt>Pedidos/mês por cliente</dt>
                    <dd>{quantity.format(cohort.averageMonthlyOrders)}</dd>
                  </div>
                  <div>
                    <dt>Faixa</dt>
                    <dd>
                      {cohort.customerCount.toLocaleString("pt-BR")} cliente
                      {cohort.customerCount === 1 ? "" : "s"}
                      {cohort.orderCount
                        ? ` · ${cohort.orderCount.toLocaleString("pt-BR")} pedidos`
                        : ""}
                      {cohort.orderSharePct
                        ? ` · ${percent.format(cohort.orderSharePct)}% dos pedidos`
                        : ""}
                    </dd>
                  </div>
                </dl>
                <small>{expanded ? "Recolher lista" : "Ver clientes da faixa"}</small>
              </button>
            </article>
          );
        })}
      </section>
      {openCard ? (
        <section className="cohort-members-panel" aria-label={`Clientes da faixa ${openCard.label}`}>
          <h3>
            {openCard.label}: {openCard.cohort.customerCount.toLocaleString("pt-BR")} cliente
            {openCard.cohort.customerCount === 1 ? "" : "s"}
          </h3>
          {openCard.cohort.members?.length ? (
            <ol>
              {openCard.cohort.members.map((member) => (
                <li key={member.id}>
                  <div className="cohort-member-row">
                    <button
                      type="button"
                      onClick={() => onSelectCustomer(member.id)}
                      aria-label={`Abrir perfil do cliente ${member.name}`}
                    >
                      <span>
                        {member.rank}º {member.name}
                      </span>
                      <small>
                        {money.format(member.revenue)} · {member.orderCount} pedido
                        {member.orderCount === 1 ? "" : "s"} ·{" "}
                        {quantity.format(member.averageMonthlyOrders)} /mês
                      </small>
                    </button>
                    <button
                      type="button"
                      className="row-action"
                      onClick={() => onExcludeCustomer(member.id)}
                      aria-label={`Tirar ${member.name} da conta`}
                    >
                      Tirar da conta
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhum cliente nesta faixa no período.</p>
          )}
          {openCard.cohort.membersOmitted ? (
            <p>
              + {openCard.cohort.membersOmitted.toLocaleString("pt-BR")} clientes não listados.
              Use a tabela abaixo para ver o restante.
            </p>
          ) : null}
        </section>
      ) : null}
      <p className="cohort-note">
        As faixas não se sobrepõem: Top 5 + 6º ao 10º + 11º ao 20º + demais = 100% do
        faturamento. Por cliente é o faturamento da faixa dividido pelos clientes dela.
        Ticket médio é o valor médio de cada pedido desses clientes.
      </p>
    </>
  );
}

function customerColumns(
  onExcludeCustomer: (id: string) => void,
): EntityColumn<CustomerAnalyticsRow>[] {
  return [
    { id: "name", label: "Cliente", render: (row) => row.name },
    { id: "city", label: "Cidade", render: (row) => row.city || "—" },
    { id: "state", label: "UF", render: (row) => row.state || "—" },
    { id: "order_count", label: "Pedidos", render: (row) => row.orderCount },
    { id: "revenue", label: "Faturamento", render: (row) => money.format(row.revenue) },
    {
      id: "average_ticket",
      label: "Ticket médio",
      render: (row) => money.format(row.averageTicket),
    },
    {
      id: "first_order_at",
      label: "Primeira compra",
      render: (row) =>
        row.firstOrderAt ? new Date(row.firstOrderAt).toLocaleDateString("pt-BR") : "—",
    },
    {
      id: "last_order_at",
      label: "Última compra",
      render: (row) =>
        row.lastOrderAt ? new Date(row.lastOrderAt).toLocaleDateString("pt-BR") : "—",
    },
    {
      id: "days_since_last_order",
      label: "Dias sem comprar",
      render: (row) => row.daysSinceLastOrder ?? "Nunca comprou",
    },
    {
      id: "average_interval",
      label: "Intervalo médio",
      sortable: false,
      render: (row) =>
        row.averageOrderIntervalDays == null
          ? "—"
          : `${row.averageOrderIntervalDays.toLocaleString("pt-BR", {
              maximumFractionDigits: 0,
            })} dias`,
    },
    { id: "recency", label: "R", render: (row) => row.rfm.recency },
    { id: "frequency", label: "F", render: (row) => row.rfm.frequency },
    { id: "monetary", label: "M", render: (row) => row.rfm.monetary },
    {
      id: "rfm_segment",
      label: "Segmento RFM",
      sortable: false,
      render: (row) => row.rfm.segment,
    },
    { id: "abc", label: "ABC", sortable: false, render: (row) => row.abcClass || "—" },
    {
      id: "exclude",
      label: "Conta",
      sortable: false,
      render: (row) => (
        <button
          type="button"
          className="row-action"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onExcludeCustomer(row.id);
          }}
          aria-label={`Tirar ${row.name} da conta`}
        >
          Tirar
        </button>
      ),
    },
  ];
}

export function CustomersPage({
  filters,
  onExcludeCustomer,
}: {
  filters: AnalyticsFilters;
  onExcludeCustomer: (id: string) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useQuery({
    queryKey: ["analytics", "customer-detail", selectedId, filters],
    queryFn: () => analyticsApi.customerDetail(selectedId || "", filters),
    enabled: Boolean(selectedId),
  });
  return (
    <>
      <ServerEntityTable
        title="Clientes"
        description="RFM, curva ABC, frequência, ticket e recência."
        queryKey={["analytics", "customers", filters]}
        columns={customerColumns(onExcludeCustomer)}
        defaultSort="revenue"
        preferenceKey="customers"
        fetchPage={(options) => analyticsApi.customers(filters, options)}
        actions={<ExportButtons report="customers" filters={filters} />}
        renderSummary={(summary) => (
          <CustomerCohortCards
            summary={summary}
            onSelectCustomer={setSelectedId}
            onExcludeCustomer={onExcludeCustomer}
          />
        )}
        onRowClick={(row) => setSelectedId(row.id)}
        rowLabel={(row) => `Abrir perfil do cliente ${row.name}`}
      />
      {selectedId && (
        <EntityDetailDrawer
          title={detail.data?.customer.name || "Perfil do cliente"}
          loading={detail.isLoading}
          error={detail.error as Error | null}
          onRetry={() => void detail.refetch()}
          onClose={() => setSelectedId(null)}
        >
          {detail.data && (
            <>
              <button
                type="button"
                className="row-action drawer-exclude"
                onClick={() => {
                  onExcludeCustomer(selectedId);
                  setSelectedId(null);
                }}
              >
                Tirar este cliente da conta
              </button>
              <div className="metric-grid compact">
                <article><span>Faturamento</span><strong>{money.format(detail.data.customer.revenue)}</strong></article>
                <article><span>Pedidos</span><strong>{detail.data.customer.orderCount}</strong></article>
                <article><span>Ticket médio</span><strong>{money.format(detail.data.customer.averageTicket)}</strong></article>
                <article><span>Segmento RFM</span><strong>{detail.data.customer.rfm.segment}</strong></article>
              </div>
              <h3>Histórico recente</h3>
              <p className="table-note">
                Clique no número do pedido para ver os itens.
              </p>
              <ExpandableOrderHistory
                orders={detail.data.orders.items}
                filters={filters}
                extraColumn="seller"
              />
              <h3>Produtos principais</h3>
              <ul>
                {detail.data.products.items.map((product) => (
                  <li key={product.id}>{product.name} · {money.format(product.revenue)}</li>
                ))}
              </ul>
            </>
          )}
        </EntityDetailDrawer>
      )}
    </>
  );
}
