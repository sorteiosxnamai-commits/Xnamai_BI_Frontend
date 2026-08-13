import type { DataQuality } from "../api";

type Props = {
  data: DataQuality | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
};

const labels: Record<string, string> = {
  customers: "Clientes",
  products: "Produtos",
  sellers: "Vendedores",
  orders: "Pedidos",
  orderItems: "Itens de pedido",
  ordersWithoutItems: "Pedidos sem itens",
  ordersWithoutCustomer: "Pedidos sem cliente identificado",
  ordersWithoutSeller: "Pedidos sem vendedor identificado",
  itemsWithoutProduct: "Itens sem produto identificado",
  orderTotalDivergences: "Divergências pedido × itens",
  ordersWithZeroTotal: "Pedidos com total zero",
  itemsWithZeroQuantity: "Itens com quantidade zero",
  itemsWithZeroTotal: "Itens com total zero",
  customerDocumentGroups: "Documentos de cliente duplicados",
  productCodeGroups: "Códigos de produto duplicados",
  productsWithoutCategory: "Produtos sem categoria",
};

const number = (value: number | null | undefined) =>
  value == null ? "Indisponível" : value.toLocaleString("pt-BR");

function Coverage({
  label,
  value,
  threshold = 95,
}: {
  label: string;
  value: number;
  threshold?: number;
}) {
  const ok = value >= threshold;
  return (
    <article className="quality-coverage">
      <span>{label}</span>
      <strong>{value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</strong>
      <div
        className="quality-progress"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${value}%`}
      >
        <i className={ok ? "ok" : "warn"} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <small>{ok ? "Cobertura adequada" : `Abaixo do mínimo de ${threshold}%`}</small>
    </article>
  );
}

function MetricList({
  values,
}: {
  values: Record<string, number | null | undefined>;
}) {
  return (
    <div className="quality-metrics">
      {Object.entries(values).map(([key, value]) => (
        <div key={key}>
          <span>{labels[key] || key}</span>
          <strong>{number(value)}</strong>
        </div>
      ))}
    </div>
  );
}

export function DataQualityPage({ data, loading, error, onRetry }: Props) {
  if (loading && !data) {
    return <div className="banner">Auditando cobertura e integridade da base…</div>;
  }
  if (error && !data) {
    return (
      <div className="banner error">
        Falha ao carregar qualidade dos dados: {error}
        <button type="button" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    );
  }
  if (!data) return null;

  const productRankingsReliable = data.coverage.ordersWithItemsPct >= 95;
  return (
    <>
      <section className={`quality-status ${data.metadata.isPartial ? "partial" : "healthy"}`}>
        <div>
          <small>CONFIABILIDADE DA BASE</small>
          <h2>{data.metadata.isPartial ? "Dados parciais" : "Cobertura adequada"}</h2>
          <p>
            Gerado em {new Date(data.metadata.generatedAt).toLocaleString("pt-BR")} · dados até{" "}
            {data.metadata.dataThrough
              ? new Date(data.metadata.dataThrough).toLocaleString("pt-BR")
              : "sem pedidos"}
          </p>
        </div>
        <button type="button" onClick={onRetry} disabled={loading}>
          {loading ? "Atualizando…" : "Atualizar auditoria"}
        </button>
      </section>

      {!productRankingsReliable && (
        <div className="banner error">
          Rankings de produtos estão marcados como não confiáveis: somente{" "}
          {data.coverage.ordersWithItemsPct.toLocaleString("pt-BR")}% dos pedidos possuem itens.
        </div>
      )}

      {!!data.warnings.length && (
        <article className="card quality-warnings">
          <h2>Avisos</h2>
          <ul>
            {data.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </article>
      )}

      <section className="quality-grid">
        <Coverage label="Pedidos com itens" value={data.coverage.ordersWithItemsPct} />
        <Coverage label="Pedidos com cliente" value={data.coverage.ordersWithCustomerPct} />
        <Coverage label="Pedidos com vendedor" value={data.coverage.ordersWithSellerPct} />
        <Coverage label="Itens com produto" value={data.coverage.itemsWithProductPct} />
        <Coverage label="Status reconhecido" value={data.coverage.recognizedStatusPct} />
      </section>

      <section className="grid lower three">
        <article className="card">
          <h2>Volume persistido</h2>
          <p>Quantidade total por tabela</p>
          <MetricList values={data.counts} />
        </article>
        <article className="card">
          <h2>Integridade</h2>
          <p>Relacionamentos ausentes e divergências</p>
          <MetricList values={data.integrity} />
        </article>
        <article className="card">
          <h2>Valores suspeitos</h2>
          <p>Zeros, duplicidades e dimensões ausentes</p>
          <MetricList
            values={{
              ...data.zeroValues,
              ...data.duplicates,
              ...data.missingDimensions,
            }}
          />
        </article>
        <article className="card">
          <h2>JSON raw vazios</h2>
          <p>Registros sem payload original auditável</p>
          <MetricList values={data.emptyRaw} />
        </article>
      </section>

      <article className="card table">
        <h2>Cobertura da sincronização</h2>
        <p>
          Período no banco:{" "}
          {data.dateRange.min ? new Date(data.dateRange.min).toLocaleDateString("pt-BR") : "—"} até{" "}
          {data.dateRange.max ? new Date(data.dateRange.max).toLocaleDateString("pt-BR") : "—"}
        </p>
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {["Recurso", "Status", "Cursor", "Último sucesso", "Registros", "Erro"].map(
                  (column) => (
                    <th key={column}>{column}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {data.sync.map((state) => (
                <tr key={state.resource}>
                  <td>{state.resource}</td>
                  <td>
                    <mark>{state.status}</mark>
                  </td>
                  <td>{state.cursor || "—"}</td>
                  <td>
                    {state.lastSuccessAt
                      ? new Date(state.lastSuccessAt).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td>{number(state.records || 0)}</td>
                  <td>{state.error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </>
  );
}
