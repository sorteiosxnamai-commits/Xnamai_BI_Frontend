import { useNavigate } from "react-router-dom";
import type { ZodType } from "zod";
import { type Page, type Product, pageOf, productSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { type Column, type FilterDef, ServerList } from "../../components/ServerList";
import { Badge, CapabilityNotice, PageHeader } from "../../components/ui";
import { formatMoney, formatQuantity } from "../../format";

const schema = pageOf(productSchema) as unknown as ZodType<Page<Product>>;

const COLUMNS: Column<Product>[] = [
  { key: "code", header: "Código", sortKey: "code", render: (p) => p.code ?? "—" },
  { key: "name", header: "Produto", sortKey: "name", render: (p) => <strong>{p.name}</strong> },
  {
    key: "kind",
    header: "Tipo",
    render: (p) =>
      p.kind === "aggregator" ? (
        <Badge value="partial" label="Agregador de grade (não vendável)" />
      ) : (
        <Badge value="active" label="SKU vendável" />
      ),
  },
  { key: "unit", header: "Un.", render: (p) => p.unit ?? "—" },
  { key: "price", header: "Preço de tabela", sortKey: "listPrice", render: (p) => formatMoney(p.listPrice) },
  { key: "min", header: "Preço mínimo", render: (p) => formatMoney(p.minimumPrice) },
  { key: "stock", header: "Saldo Mercos", sortKey: "externalStock", render: (p) => formatQuantity(p.externalStock) },
  {
    key: "active",
    header: "Situação",
    render: (p) => (p.active === false ? <Badge value="cancelled" label="Inativo" /> : <Badge value="active" label="Ativo" />),
  },
];

const FILTERS: FilterDef[] = [
  { name: "search", label: "Buscar", type: "text", placeholder: "Nome ou código" },
  {
    name: "kind",
    label: "Tipo",
    type: "select",
    options: [
      { value: "simple", label: "SKU vendável" },
      { value: "aggregator", label: "Agregador de grade" },
    ],
  },
  {
    name: "active",
    label: "Situação",
    type: "select",
    options: [
      { value: "true", label: "Ativos" },
      { value: "false", label: "Inativos" },
    ],
  },
];

export function ProductsPage() {
  const navigate = useNavigate();
  const { capability } = useErp();
  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Catálogo espelhado do Mercos. O saldo mostrado é o saldo externo; o saldo operacional do ERP fica em Estoque."
      />
      <CapabilityNotice capability={capability("write.products")} />
      <ServerList<Product>
        resource="products"
        path="/products"
        schema={schema}
        caption="Produtos"
        columns={COLUMNS}
        filters={FILTERS}
        defaultSort="name"
        rowKey={(p) => p.id}
        onRowOpen={(p) => navigate(`/erp/produtos/${encodeURIComponent(p.id)}`)}
        emptyMessage="Nenhum produto no espelho. Se a sincronização ainda não rodou, veja Integrações."
      />
    </>
  );
}
