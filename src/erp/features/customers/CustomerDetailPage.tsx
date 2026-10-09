import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useErpQuery } from "../../api/hooks";
import { customerDetailSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { StatePanel } from "../../components/StatePanel";
import { Badge, CapabilityNotice, Dl, PageHeader } from "../../components/ui";
import { formatInstant, formatMoney } from "../../format";
import { CustomerForm } from "./CustomerForm";

function hasExtras(extras: unknown): boolean {
  if (!extras || typeof extras !== "object") return false;
  return Object.values(extras as Record<string, unknown>).some((value) => value !== null && value !== undefined);
}

export function CustomerDetailPage() {
  const { id = "" } = useParams();
  const { can, capability } = useErp();
  const [editing, setEditing] = useState(false);
  const query = useErpQuery(["customer", id], `/customers/${encodeURIComponent(id)}`, customerDetailSchema);
  const cap = capability("write.customers");
  const canWrite = can("customers:write") && Boolean(cap?.enabled);

  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const c = query.data;
  if (!c) return null;

  const blockedBadge = c.blocked ? (
    <Badge value="forbidden" label="Bloqueado" />
  ) : c.blocked === false ? (
    <Badge value="active" label="Liberado" />
  ) : (
    "—"
  );

  return (
    <>
      <PageHeader
        title={c.name}
        subtitle={`Cliente ${c.id} · versão local ${c.version} · origem atualizada em ${formatInstant(c.sourceUpdatedAt)}`}
        actions={
          <>
            <Link className="erp-btn" to={`/erp/pedidos?customerId=${encodeURIComponent(c.id)}`}>
              Pedidos do cliente
            </Link>
            {canWrite && (
              <button type="button" className="erp-btn erp-btn-primary" onClick={() => setEditing((v) => !v)}>
                {editing ? "Fechar edição" : "Editar"}
              </button>
            )}
          </>
        }
      />
      {can("customers:write") && <CapabilityNotice capability={cap} />}
      {c.piiRestricted && (
        <div className="erp-notice">
          <strong>Dados pessoais protegidos</strong>
          <span>Documento, contatos e endereço aparecem mascarados para o seu perfil.</span>
        </div>
      )}
      {c.sourceDeleted && (
        <div className="erp-notice">
          <strong>Excluído na origem</strong>
          <span>O histórico e os vínculos locais foram preservados.</span>
        </div>
      )}
      {editing && canWrite && <CustomerForm customer={c} onCancel={() => setEditing(false)} />}
      <section className="erp-card">
        <h3>Cadastro</h3>
        <Dl
          items={[
            ["Razão social", c.name],
            ["Nome fantasia", c.tradeName],
            ["Tipo", c.personType === "F" ? "Pessoa física" : c.personType === "J" ? "Pessoa jurídica" : "—"],
            ["Documento", c.document],
            ["Inscrição estadual", c.stateRegistration],
            ["SUFRAMA", c.suframa],
            ["E-mail", c.email],
            ["Telefone", c.phone],
            ["Celular", c.mobile],
            ["Segmento", c.segmentId],
            ["Vendedor", c.sellerId],
            ["Criado na origem", formatInstant(c.sourceCreatedAt)],
          ]}
        />
      </section>
      <section className="erp-card">
        <h3>Crédito e bloqueio</h3>
        <Dl
          items={[
            ["Situação", blockedBadge],
            ["Motivo do bloqueio", c.blockReason],
            ["Limite de crédito", formatMoney(c.creditLimit)],
            ["Ativo", c.active === null || c.active === undefined ? "—" : c.active ? "Sim" : "Não"],
          ]}
        />
      </section>
      <section className="erp-card">
        <h3>Endereço principal</h3>
        <Dl
          items={[
            ["Rua", c.street],
            ["Número", c.number],
            ["Complemento", c.complement],
            ["Bairro", c.district],
            ["CEP", c.zipCode],
            ["Cidade/UF", [c.city, c.state].filter(Boolean).join(" / ") || "—"],
          ]}
        />
        {c.addresses.length > 0 && (
          <>
            <h3 style={{ marginTop: 16 }}>Endereços adicionais</h3>
            <ul>
              {c.addresses.map((a, index) => (
                <li key={a.id ?? index}>
                  {[a.kind, a.street, a.number, a.district, a.city, a.state, a.zipCode].filter(Boolean).join(" · ") || "—"}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section className="erp-card">
        <h3>Contatos</h3>
        {c.contacts.length === 0 ? (
          <StatePanel kind="empty" message="Nenhum contato recebido da origem." />
        ) : (
          <div className="erp-table-wrap">
            <table className="erp-table">
              <thead>
                <tr><th>Nome</th><th>Cargo</th><th>E-mail</th><th>Telefone</th><th>Celular</th></tr>
              </thead>
              <tbody>
                {c.contacts.map((contact, index) => (
                  <tr key={contact.id ?? index}>
                    <td>{contact.name ?? "—"}</td>
                    <td>{contact.role ?? "—"}</td>
                    <td>{contact.email ?? "—"}</td>
                    <td>{contact.phone ?? "—"}</td>
                    <td>{contact.mobile ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {hasExtras(c.extras) && (
        <section className="erp-card">
          <h3>Campos extras e contatos adicionais</h3>
          <p className="erp-muted">Dados restritos recebidos da origem (e-mails/telefones adicionais, campos extras, tags). Somente leitura.</p>
          <pre style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(c.extras, null, 2)}</pre>
        </section>
      )}
      {c.notes && (
        <section className="erp-card">
          <h3>Observações</h3>
          {/* texto puro: observações externas nunca são renderizadas como HTML */}
          <p style={{ whiteSpace: "pre-wrap" }}>{c.notes}</p>
        </section>
      )}
    </>
  );
}
