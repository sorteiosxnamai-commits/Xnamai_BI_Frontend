import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useErp } from "../../auth/context";
import { customerSchema, pageOf, type Customer, type Page } from "../../api/schemas";
import { ServerList, type Column, type FilterDef } from "../../components/ServerList";
import { Badge, CapabilityNotice, PageHeader } from "../../components/ui";
import { formatInstant } from "../../format";
import { CustomerForm } from "./CustomerForm";

const schema = pageOf(customerSchema) as unknown as import("zod").ZodType<Page<Customer>>;

const COLUMNS: Column<Customer>[] = [
  { key: "name", header: "Cliente", sortKey: "name", render: (c) => <strong>{c.name}</strong> },
  { key: "document", header: "Documento", render: (c) => c.document ?? "—" },
  { key: "city", header: "Cidade", sortKey: "city", render: (c) => c.city ?? "—" },
  { key: "state", header: "UF", sortKey: "state", render: (c) => c.state ?? "—" },
  { key: "email", header: "E-mail", render: (c) => c.email ?? "—" },
  {
    key: "flags",
    header: "Situação",
    render: (c) => (
      <>
        {c.blocked ? <Badge value="forbidden" label="Bloqueado" /> : c.active === false ? <Badge value="cancelled" label="Inativo" /> : <Badge value="active" label="Ativo" />}
        {c.piiRestricted && <div className="erp-muted">dados pessoais protegidos</div>}
      </>
    ),
  },
  { key: "updated", header: "Atualizado na origem", sortKey: "updatedAt", render: (c) => formatInstant(c.sourceUpdatedAt) },
];

const FILTERS: FilterDef[] = [
  { name: "search", label: "Buscar", type: "text", placeholder: "Nome, fantasia ou documento" },
  { name: "state", label: "UF", type: "text", placeholder: "SP" },
  {
    name: "blocked",
    label: "Bloqueio",
    type: "select",
    options: [
      { value: "true", label: "Bloqueados" },
      { value: "false", label: "Não bloqueados" },
    ],
  },
];

export function CustomersPage() {
  const navigate = useNavigate();
  const { can, capability } = useErp();
  const [creating, setCreating] = useState(false);
  const cap = capability("write.customers");
  const canWrite = can("customers:write") && Boolean(cap?.enabled);

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Espelho local dos clientes do Mercos. Edições viram operações assíncronas com confirmação."
        actions={
          canWrite ? (
            <button type="button" className="erp-btn erp-btn-primary" onClick={() => setCreating((v) => !v)}>
              {creating ? "Fechar cadastro" : "Novo cliente"}
            </button>
          ) : null
        }
      />
      {can("customers:write") && <CapabilityNotice capability={cap} />}
      {creating && canWrite && <CustomerForm onCancel={() => setCreating(false)} />}
      <ServerList<Customer>
        resource="customers"
        path="/customers"
        schema={schema}
        caption="Clientes"
        columns={COLUMNS}
        filters={FILTERS}
        defaultSort="name"
        rowKey={(c) => c.id}
        onRowOpen={(c) => navigate(`/erp/clientes/${encodeURIComponent(c.id)}`)}
        emptyMessage="Nenhum cliente no espelho. Se a sincronização ainda não rodou, veja Integrações."
      />
    </>
  );
}
