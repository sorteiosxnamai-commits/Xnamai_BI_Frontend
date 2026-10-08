import { useState } from "react";
import { useErpQuery } from "../api/hooks";
import { externalListSchema } from "../api/schemas";
import { StatePanel } from "../components/StatePanel";
import { PageHeader, Tabs } from "../components/ui";

const TABS = [
  { id: "external-titles", label: "Títulos externos (Mercos)" },
  { id: "payments", label: "Pagamentos (Mercos Pay)" },
  { id: "commissions", label: "Comissões" },
  { id: "promotions", label: "Promoções" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const NOTES: Record<TabId, string> = {
  "external-titles":
    "Faturas do cliente no Mercos (parcelas e links). Não são todo o financeiro da empresa: contas a pagar e caixa ficam em Financeiro.",
  payments:
    "Confirmação de cartão não é repasse. Estados externos e estornos/chargebacks são preservados; a baixa local só ocorre por política conciliada.",
  commissions: "O cálculo de comissão precisa de um único responsável para não duplicar.",
  promotions: "Regras e validade; o ID pode mudar na origem.",
};

function ExternalTab({ id }: { id: TabId }) {
  const query = useErpQuery([id], `/${id}`, externalListSchema);
  if (query.isLoading) return <StatePanel kind="loading" />;
  if (query.error) {
    return <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;
  const { availability: a } = data;
  const columns = data.items.length ? Object.keys(data.items[0]) : [];
  return (
    <>
      {!a.enabled && (
        <StatePanel
          kind="unavailable"
          title="Recurso ainda não disponível"
          message={`${a.reason ?? "Sem motivo informado."} (Adaptor ${a.supportedByAdaptor ? "suporta" : "não suporta"}; ERP ${a.implementedInErp ? "implementado" : "pendente"}).`}
        />
      )}
      {a.enabled && data.items.length === 0 && <StatePanel kind="empty" message="Nenhum registro sincronizado ainda." />}
      {data.items.length > 0 && (
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead><tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {data.items.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {columns.map((c) => <td key={c}>{String(row[c] ?? "—")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function ExternalPage() {
  const [tab, setTab] = useState<TabId>("external-titles");
  return (
    <>
      <PageHeader
        title="Títulos, pagamentos e comissões"
        subtitle="Origem e estado conciliado. Título não é pagamento efetivo; recursos pendentes mostram o motivo, sem botão falso."
      />
      <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      <p className="erp-muted">{NOTES[tab]}</p>
      <section className="erp-card">
        <ExternalTab key={tab} id={tab} />
      </section>
    </>
  );
}
