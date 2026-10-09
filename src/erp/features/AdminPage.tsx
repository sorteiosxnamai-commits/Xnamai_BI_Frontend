import { type FormEvent, useState } from "react";
import { type ZodType, z } from "zod";
import { useCommand, useErpQuery, useInvalidateErp } from "../api/hooks";
import { auditSchema, operatorSchema, operatorsSchema, type Page, pageOf, temporaryPasswordSchema } from "../api/schemas";
import { type Column, ServerList } from "../components/ServerList";
import { Badge, CommandError, PageHeader, Tabs } from "../components/ui";
import { formatInstant } from "../format";

type Audit = z.infer<typeof auditSchema>;
const auditPage = pageOf(auditSchema) as unknown as ZodType<Page<Audit>>;

const ROLE_HELP: Record<string, string> = {
  erp_admin: "Tudo, incluindo operadores, autoridade do estoque e snapshots",
  comercial: "Clientes e pedidos (com dados pessoais), integração e resolução de conflitos",
  estoque: "Saldos, ajustes e transferências",
  compras: "Fornecedores, pedidos de compra e recebimento",
  financeiro: "Financeiro local, baixas e estornos",
  consulta: "Somente leitura, com dados pessoais mascarados",
};

function OperatorForm({ roles }: { roles: string[] }) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [active, setActive] = useState(true);
  const [message, setMessage] = useState("");
  const command = useCommand<Record<string, unknown>, z.infer<typeof operatorSchema>>(operatorSchema);
  const invalidate = useInvalidateErp();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!username.trim()) return setMessage("Informe o login (mesmo e-mail do login BI).");
    if (active && selected.length === 0) return setMessage("Escolha ao menos um papel ou desative o operador.");
    setMessage("");
    const ok = await command
      .mutateAsync({ path: "/operators", method: "PUT", body: { username: username.trim(), displayName: displayName.trim() || null, roles: selected, active } })
      .then(() => true)
      .catch(() => false);
    if (ok) {
      setUsername("");
      setDisplayName("");
      setSelected([]);
      void invalidate("operators");
    }
  }
  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label="Vincular operador">
      <h3 className="erp-wide">Vincular login a operador ERP</h3>
      <p className="erp-muted erp-wide">
        A permissão ERP é independente do papel no BI e do vendedor Mercos: sem vínculo explícito, o acesso é negado.
      </p>
      <label className="erp-field"><span>Login (e-mail)</span><input value={username} onChange={(e) => setUsername(e.target.value)} /></label>
      <label className="erp-field"><span>Nome de exibição</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></label>
      <fieldset className="erp-field erp-wide">
        <legend>Papéis</legend>
        {roles.map((role) => (
          <label key={role} style={{ display: "block" }}>
            <input type="checkbox" checked={selected.includes(role)}
              onChange={(e) => setSelected((cur) => (e.target.checked ? [...cur, role] : cur.filter((r) => r !== role)))} />{" "}
            <b>{role}</b> <span className="erp-muted">— {ROLE_HELP[role]}</span>
          </label>
        ))}
      </fieldset>
      <label className="erp-field"><span><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo</span></label>
      <CommandError error={command.error} local={message} />
      <div className="erp-form-actions"><button className="erp-btn erp-btn-primary" type="submit" disabled={command.isPending}>Salvar operador</button></div>
    </form>
  );
}

function OperatorsTable() {
  const operators = useErpQuery(["operators"], "/operators", operatorsSchema);
  const invalidate = useInvalidateErp();
  const password = useCommand<Record<string, never>, z.infer<typeof temporaryPasswordSchema>>(temporaryPasswordSchema);
  const revoke = useCommand<Record<string, never>, unknown>(z.unknown());
  const [issued, setIssued] = useState<z.infer<typeof temporaryPasswordSchema> | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const data = operators.data;
  return (
    <section className="erp-card" aria-label="Operadores">
      {issued && (
        <div className="erp-notice" role="alert">
          <strong>Senha temporária de {issued.username} (exibida uma única vez)</strong>
          <code style={{ fontSize: 16 }}>{issued.temporaryPassword}</code>
          <span>{issued.note} O operador precisará trocá-la no primeiro acesso.</span>
          <div>
            <button type="button" className="erp-btn" onClick={() => setIssued(null)}>
              Já anotei, fechar
            </button>
          </div>
        </div>
      )}
      <div className="erp-table-wrap">
        <table className="erp-table">
          <thead>
            <tr>
              <th>Login</th>
              <th>Nome</th>
              <th>Papéis</th>
              <th>Acesso individual</th>
              <th>Último login</th>
              <th>Sessões</th>
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data?.items.map((o) => (
              <tr key={o.username}>
                <td>{o.username}</td>
                <td>{o.displayName ?? "—"}</td>
                <td>{o.roles.join(", ") || "—"}</td>
                <td>
                  {o.hasPassword ? (
                    o.mustChangePassword ? <Badge value="partial" label="Senha temporária" /> : <Badge value="active" label="Com senha" />
                  ) : (
                    <Badge value="cancelled" label="Sem senha" />
                  )}
                  {o.locked && <Badge value="forbidden" label="Bloqueado" />}
                </td>
                <td>{formatInstant(o.lastLoginAt)}</td>
                <td>{o.activeSessions ?? 0}</td>
                <td>{o.active ? <Badge value="active" label="Ativo" /> : <Badge value="cancelled" label="Inativo" />}</td>
                <td>
                  <div className="erp-toolbar-actions">
                    {confirm === o.username ? (
                      <>
                        <span>Gerar nova senha e encerrar as sessões?</span>
                        <button
                          type="button"
                          className="erp-btn erp-btn-primary"
                          disabled={password.isPending}
                          onClick={() =>
                            void password
                              .mutateAsync({ path: `/operators/${encodeURIComponent(o.username)}/password`, body: {} })
                              .then((res) => {
                                setIssued(res);
                                setConfirm(null);
                                void invalidate("operators");
                              })
                              .catch(() => null)
                          }
                        >
                          Confirmar
                        </button>
                        <button type="button" className="erp-btn" onClick={() => setConfirm(null)}>
                          Voltar
                        </button>
                      </>
                    ) : (
                      <button type="button" className="erp-btn" onClick={() => setConfirm(o.username)}>
                        {o.hasPassword ? "Redefinir senha" : "Criar senha"}
                      </button>
                    )}
                    {(o.activeSessions ?? 0) > 0 && (
                      <button
                        type="button"
                        className="erp-btn erp-btn-danger"
                        disabled={revoke.isPending}
                        onClick={() =>
                          void revoke
                            .mutateAsync({ path: `/operators/${encodeURIComponent(o.username)}/revoke-sessions`, body: {} })
                            .then(() => invalidate("operators"))
                            .catch(() => null)
                        }
                      >
                        Encerrar sessões
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CommandError error={password.error ?? revoke.error} />
      {data?.items.length === 0 && (
        <p className="erp-muted">Nenhum operador cadastrado. O administrador de bootstrap entra pelo login do BI.</p>
      )}
    </section>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState<"operators" | "audit">("operators");
  const operators = useErpQuery(["operators"], "/operators", operatorsSchema, { enabled: tab === "operators" });
  const columns: Column<Audit>[] = [
    { key: "at", header: "Quando", sortKey: "at", render: (a) => formatInstant(a.at) },
    { key: "by", header: "Operador", render: (a) => a.operator },
    { key: "action", header: "Ação", render: (a) => a.action },
    { key: "res", header: "Recurso", render: (a) => [a.resource, a.resourceId].filter(Boolean).join(" ") || "—" },
    { key: "result", header: "Resultado", render: (a) => a.result ?? "—" },
    { key: "reason", header: "Motivo", render: (a) => a.reason ?? "—" },
  ];
  return (
    <>
      <PageHeader title="Administração do ERP" subtitle="Operadores, permissões e auditoria. Registros sem credenciais nem dados pessoais desnecessários." />
      <Tabs tabs={[{ id: "operators", label: "Operadores e permissões" }, { id: "audit", label: "Auditoria" }]} value={tab} onChange={setTab} />
      {tab === "operators" && (
        <>
          <OperatorForm roles={operators.data?.roles ?? Object.keys(ROLE_HELP)} />
          <OperatorsTable />
        </>
      )}
      {tab === "audit" && (
        <ServerList<Audit> resource="audit" path="/audit-events" schema={auditPage} caption="Eventos de auditoria" columns={columns}
          filters={[{ name: "action", label: "Ação", type: "text" }, { name: "operator", label: "Operador", type: "text" }]}
          defaultSort="at" defaultOrder="desc" pageSize={50} rowKey={(a) => a.id} emptyMessage="Nenhum evento." />
      )}
    </>
  );
}
