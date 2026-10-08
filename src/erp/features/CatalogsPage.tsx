import { useState } from "react";
import type { ZodType } from "zod";
import {
  catalogEntrySchema,
  pageOf,
  productPriceRowSchema,
  type CatalogEntry,
  type Page,
} from "../api/schemas";
import { ServerList, type Column } from "../components/ServerList";
import { Badge, PageHeader, Tabs } from "../components/ui";
import { formatDay, formatMoney, formatQuantity } from "../format";
import type { z } from "zod";

const catalogSchema = pageOf(catalogEntrySchema) as unknown as ZodType<Page<CatalogEntry>>;
type PriceRow = z.infer<typeof productPriceRowSchema>;
const priceSchema = pageOf(productPriceRowSchema) as unknown as ZodType<Page<PriceRow>>;

const yesNo = (value: unknown) => (value === null || value === undefined ? "—" : value ? "Sim" : "Não");
const text = (value: unknown) => (value === null || value === undefined || value === "" ? "—" : String(value));
const active = (c: CatalogEntry) =>
  c.active === false ? <Badge value="cancelled" label="Inativo" /> : <Badge value="active" label="Ativo" />;

type Tab = {
  id: string;
  label: string;
  note?: string;
  columns: Column<CatalogEntry>[];
};

const NAME: Column<CatalogEntry> = {
  key: "name",
  header: "Nome",
  sortKey: "name",
  render: (c) => <strong>{c.name}</strong>,
};
const ACTIVE: Column<CatalogEntry> = { key: "active", header: "Situação", render: active };

const TABS: Tab[] = [
  {
    id: "price-tables",
    label: "Tabelas de preço",
    note: "O tipo (livre, acréscimo ou desconto) não pode ser alterado depois da criação na origem.",
    columns: [
      NAME,
      { key: "type", header: "Tipo", render: (c) => text(c.price_type) },
      { key: "sur", header: "Acréscimo (%)", render: (c) => formatQuantity((c.surcharge_percent ?? c.percentage) as string | null) },
      { key: "disc", header: "Desconto (%)", render: (c) => formatQuantity(c.discount_percent as string | null) },
      { key: "rep", header: "Representada", render: (c) => text(c.represented_external_id) },
      ACTIVE,
    ],
  },
  {
    id: "payment-conditions",
    label: "Condições de pagamento",
    columns: [
      NAME,
      { key: "min", header: "Pedido mínimo", render: (c) => formatMoney(c.minimum_order_value as string | null) },
      { key: "credit", header: "Considera limite de crédito", render: (c) => yesNo(c.consider_credit_limit) },
      { key: "b2b", header: "Disponível no B2B", render: (c) => yesNo(c.available_b2b) },
      { key: "rep", header: "Representada", render: (c) => text(c.represented_external_id) },
      ACTIVE,
    ],
  },
  {
    id: "carriers",
    label: "Transportadoras",
    columns: [
      NAME,
      { key: "doc", header: "Documento", render: (c) => text(c.document) },
      { key: "phone", header: "Telefone", render: (c) => text(c.phone) },
      { key: "email", header: "E-mail", render: (c) => text(c.email) },
      { key: "city", header: "Cidade/UF", render: (c) => [c.city, c.state].filter(Boolean).join(" / ") || "—" },
      ACTIVE,
    ],
  },
  {
    id: "commercial-policies",
    label: "Políticas comerciais",
    note: "Identidade por slug + conta: o ID pode mudar na origem, o histórico de IDs é mantido.",
    columns: [
      NAME,
      { key: "slug", header: "Slug", render: (c) => text(c.slug) },
      { key: "from", header: "Vigência inicial", render: (c) => formatDay(c.valid_from as string | null) },
      { key: "to", header: "Vigência final", render: (c) => formatDay(c.valid_to as string | null) },
      { key: "ids", header: "IDs anteriores", render: (c) => (Array.isArray(c.id_history) ? c.id_history.join(", ") : "—") },
      ACTIVE,
    ],
  },
  {
    id: "categories",
    label: "Categorias",
    columns: [
      NAME,
      { key: "parent", header: "Categoria pai", render: (c) => text(c.parent_external_id) },
      { key: "rep", header: "Representada", render: (c) => text(c.represented_external_id) },
      ACTIVE,
    ],
  },
  { id: "segments", label: "Segmentos de clientes", columns: [NAME, ACTIVE] },
  { id: "order-types", label: "Tipos de pedido", columns: [NAME, ACTIVE] },
  {
    id: "users",
    label: "Vendedores",
    note: "Vendedor externo do Mercos. Não é operador de login do ERP e não recebe permissão automaticamente.",
    columns: [
      NAME,
      { key: "email", header: "E-mail", render: (c) => text(c.email) },
      { key: "admin", header: "Administrador no Mercos", render: (c) => yesNo(c.is_admin) },
      { key: "blocked", header: "Acesso bloqueado", render: (c) => yesNo(c.access_blocked) },
      ACTIVE,
    ],
  },
];

const ALL_TABS = [...TABS.map((t) => ({ id: t.id, label: t.label })), { id: "product-prices", label: "Preços por produto/tabela" }];

export function CatalogsPage() {
  const [tab, setTab] = useState<string>(TABS[0].id);
  const current = TABS.find((t) => t.id === tab);
  return (
    <>
      <PageHeader
        title="Cadastros auxiliares"
        subtitle="Todos os cadastros de apoio recebidos do Mercos, com consulta paginada no servidor."
      />
      <Tabs tabs={ALL_TABS} value={tab} onChange={setTab} />
      {current?.note && <p className="erp-muted">{current.note}</p>}
      {current && (
        <ServerList<CatalogEntry>
          key={current.id}
          resource={`catalog-${current.id}`}
          path={`/catalogs/${current.id}`}
          schema={catalogSchema}
          caption={current.label}
          columns={current.columns}
          filters={[{ name: "search", label: "Buscar", type: "text", placeholder: "Nome" }]}
          defaultSort="name"
          rowKey={(c) => c.localId as number}
        />
      )}
      {tab === "product-prices" && (
        <ServerList<PriceRow>
          resource="product-prices"
          path="/product-prices"
          schema={priceSchema}
          caption="Preços por produto e tabela"
          columns={[
            { key: "product", header: "Produto", sortKey: "productId", render: (r) => r.productId },
            { key: "table", header: "Tabela", render: (r) => r.priceTableId },
            { key: "price", header: "Preço", sortKey: "price", render: (r) => formatMoney(r.price) },
          ]}
          filters={[
            { name: "productId", label: "Produto (ID)", type: "text" },
            { name: "priceTableId", label: "Tabela (ID)", type: "text" },
          ]}
          defaultSort="productId"
          rowKey={(r) => r.id}
        />
      )}
    </>
  );
}
