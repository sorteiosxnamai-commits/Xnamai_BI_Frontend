import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useCommand, useErpQuery } from "../api/hooks";
import { sessionsSchema } from "../api/schemas";
import { ChangePasswordForm } from "../auth/ChangePasswordForm";
import { useErp } from "../auth/context";
import { StatePanel } from "../components/StatePanel";
import { CommandError, PageHeader } from "../components/ui";
import { formatInstant } from "../format";

export function AccountPage() {
  const { me } = useErp();
  const client = useQueryClient();
  const individual = me.authMethod === "erp_session";
  const sessions = useErpQuery(["my-sessions"], "/auth/sessions", sessionsSchema, { enabled: individual });
  const revoke = useCommand<undefined, null>(z.null());

  return (
    <>
      <PageHeader
        title="Minha conta"
        subtitle={`${me.username} · papéis: ${me.roles.join(", ") || "nenhum"}`}
      />
      {!individual && (
        <div className="erp-notice" role="note">
          <strong>Você entrou com o login do BI (administrador)</strong>
          <span>
            Este acesso serve para criar os operadores. Usuários do dia a dia entram com credencial
            individual do ERP; senha e sessões são gerenciadas por pessoa.
          </span>
        </div>
      )}
      {individual && (
        <>
          <ChangePasswordForm onDone={() => void sessions.refetch()} />
          <section className="erp-card" aria-label="Sessões ativas">
            <h3>Sessões ativas</h3>
            {sessions.isLoading && <StatePanel kind="loading" />}
            {sessions.data && (
              <div className="erp-table-wrap">
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Iniciada</th>
                      <th>Último uso</th>
                      <th>IP</th>
                      <th>Navegador</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.data.items.map((s) => (
                      <tr key={s.id}>
                        <td>{formatInstant(s.createdAt)}</td>
                        <td>{formatInstant(s.lastUsedAt)}</td>
                        <td>{s.ip ?? "—"}</td>
                        <td>{s.userAgent ?? "—"}</td>
                        <td>
                          {s.current ? (
                            <span className="erp-badge erp-badge-ok">Esta sessão</span>
                          ) : (
                            <button
                              type="button"
                              className="erp-btn"
                              disabled={revoke.isPending}
                              onClick={() =>
                                void revoke
                                  .mutateAsync({ path: `/auth/sessions/${s.id}`, method: "DELETE" })
                                  .then(() => client.invalidateQueries({ queryKey: ["erp"] }))
                                  .catch(() => null)
                              }
                            >
                              Encerrar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <CommandError error={revoke.error} />
          </section>
        </>
      )}
    </>
  );
}
