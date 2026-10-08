import { useState } from "react";
import { useErp } from "../auth/context";
import { Badge, PageHeader } from "../components/ui";
import { formatInstant } from "../format";

const ACCESS_LABEL = { unknown: "Desconhecido", allowed: "Permitido", denied: "Negado" } as const;

/**
 * Matriz de capacidades. "Desabilitado" nunca aparece como "sincronizado", e
 * implementado ≠ habilitado ≠ liberado na conta.
 */
export function CapabilitiesPage() {
  const { capabilities } = useErp();
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const rows = onlyBlocked ? capabilities.filter((item) => !item.enabled) : capabilities;
  return (
    <>
      <PageHeader
        title="Capacidades"
        subtitle="Cada linha mostra o que o Adaptor suporta, o que o provedor documenta, o acesso confirmado da conta, o que o ERP implementou e o que está habilitado."
        actions={
          <label className="erp-field">
            <span>
              <input
                type="checkbox"
                checked={onlyBlocked}
                onChange={(event) => setOnlyBlocked(event.target.checked)}
              />{" "}
              Somente indisponíveis
            </span>
          </label>
        }
      />
      <section className="erp-card" aria-label="Matriz de capacidades">
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th scope="col">Capacidade</th>
                <th scope="col">Situação</th>
                <th scope="col">Adaptor</th>
                <th scope="col">Provedor</th>
                <th scope="col">Conta</th>
                <th scope="col">ERP</th>
                <th scope="col">Habilitada</th>
                <th scope="col">Validada em</th>
                <th scope="col">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.key}>
                  <td>
                    {item.label}
                    <div className="erp-muted">
                      <code>{item.key}</code>
                      {item.source ? ` · ${item.source}` : ""}
                    </div>
                  </td>
                  <td>{item.situation}</td>
                  <td>{item.supportedByAdaptor ? "Suporta" : "Não"}</td>
                  <td>{item.documentedByProvider ? "Documentado" : "—"}</td>
                  <td>
                    <Badge value={item.accountAccess === "unknown" ? "neutral" : item.accountAccess}
                           label={ACCESS_LABEL[item.accountAccess]} />
                  </td>
                  <td>{item.implementedInErp ? "Implementado" : "Pendente"}</td>
                  <td>
                    <Badge value={item.enabled ? "success" : "unavailable"} label={item.enabled ? "Sim" : "Não"} />
                  </td>
                  <td>{formatInstant(item.lastValidatedAt)}</td>
                  <td>{item.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
