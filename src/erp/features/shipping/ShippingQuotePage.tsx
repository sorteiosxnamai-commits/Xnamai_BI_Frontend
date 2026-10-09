import { type FormEvent, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import {
  orderDetailSchema,
  orderHistorySchema,
  type ShippingOption,
  type ShippingQuote,
  shippingListSchema,
  shippingQuoteSchema,
} from "../../api/schemas";
import { useErp } from "../../auth/context";
import { Icon } from "../../components/icons";
import { Pill } from "../../components/Pill";
import { StatePanel } from "../../components/StatePanel";
import { CommandError } from "../../components/ui";
import { formatInstant, formatMoney, parseMoneyInput, parsePositiveDecimal } from "../../format";
import { StatePill, shippingSpec } from "../orders/orderUi";

type VolumeDraft = { key: number; weight: string; length: string; width: string; height: string };

const emptyVolume = (key: number): VolumeDraft => ({ key, weight: "", length: "", width: "", height: "" });

function deadline(option: ShippingOption): string {
  const low = option.deadlineMinDays;
  const high = option.deadlineMaxDays;
  if (low == null && high == null) return "—";
  if (low != null && high != null && low !== high) return `${low} a ${high} dias úteis`;
  return `${high ?? low} dias úteis`;
}

function QuoteForm({ orderId, onCreated }: { orderId: string; onCreated: () => void }) {
  const { can } = useErp();
  const command = useCommand<Record<string, unknown>, ShippingQuote>(shippingQuoteSchema);
  const [volumes, setVolumes] = useState<VolumeDraft[]>([emptyVolume(1)]);
  const [destinationZip, setDestinationZip] = useState("");
  const [originZip, setOriginZip] = useState("");
  const [declared, setDeclared] = useState("");
  const [notes, setNotes] = useState("");
  const [local, setLocal] = useState<string | null>(null);

  const totals = useMemo(() => {
    let weight = 0;
    let cubage = 0;
    for (const v of volumes) {
      const w = parsePositiveDecimal(v.weight, 3);
      const l = parsePositiveDecimal(v.length, 2);
      const wd = parsePositiveDecimal(v.width, 2);
      const h = parsePositiveDecimal(v.height, 2);
      if (w) weight += Number(w);
      if (l && wd && h) cubage += (Number(l) * Number(wd) * Number(h)) / 1_000_000;
    }
    return { weight, cubage };
  }, [volumes]);

  function update(key: number, field: keyof Omit<VolumeDraft, "key">, value: string) {
    setVolumes((current) => current.map((v) => (v.key === key ? { ...v, [field]: value } : v)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal(null);
    const parsed = [];
    for (const [index, v] of volumes.entries()) {
      const weightKg = parsePositiveDecimal(v.weight, 3);
      const lengthCm = parsePositiveDecimal(v.length, 2);
      const widthCm = parsePositiveDecimal(v.width, 2);
      const heightCm = parsePositiveDecimal(v.height, 2);
      if (!weightKg || !lengthCm || !widthCm || !heightCm) {
        setLocal(`Volume ${index + 1}: informe peso e as três dimensões com valores positivos.`);
        return;
      }
      parsed.push({ weightKg, lengthCm, widthCm, heightCm });
    }
    let declaredValue: string | undefined;
    if (declared.trim()) {
      const money = parseMoneyInput(declared);
      if (money === null) {
        setLocal("Valor declarado inválido.");
        return;
      }
      declaredValue = money;
    }
    try {
      await command.mutateAsync({
        path: `/sales-orders/${encodeURIComponent(orderId)}/shipping-quotes`,
        idempotent: true,
        body: {
          volumes: parsed,
          originZip: originZip.trim() || undefined,
          destinationZip: destinationZip.trim() || undefined,
          declaredValue,
          notes: notes.trim() || undefined,
        },
      });
      onCreated();
    } catch {
      /* o erro aparece em CommandError; o formulário permanece */
    }
  }

  if (!can("shipping:write")) {
    return (
      <section className="erp-card">
        <h3>Dados para cotação</h3>
        <p className="erp-muted">Seu perfil só consulta cotações; criar cotação exige permissão de frete.</p>
      </section>
    );
  }
  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label="Dados para cotação">
      <h3 className="erp-wide">Dados para cotação</h3>
      <label className="erp-field">
        <span>CEP de destino</span>
        <input value={destinationZip} onChange={(e) => setDestinationZip(e.target.value)} placeholder="Opcional: usa o do pedido" />
      </label>
      <label className="erp-field">
        <span>CEP de origem</span>
        <input value={originZip} onChange={(e) => setOriginZip(e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Valor declarado (R$)</span>
        <input inputMode="decimal" value={declared} onChange={(e) => setDeclared(e.target.value)} placeholder="Opcional: usa o valor do pedido" />
      </label>
      <label className="erp-field erp-wide">
        <span>Observações</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <fieldset className="erp-wide erp-volumes">
        <legend>Volumes</legend>
        {volumes.map((v, index) => (
          <div className="erp-volume-row" key={v.key}>
            <strong>Volume {index + 1}</strong>
            <label className="erp-field">
              <span>Peso (kg)</span>
              <input inputMode="decimal" value={v.weight} onChange={(e) => update(v.key, "weight", e.target.value)} />
            </label>
            <label className="erp-field">
              <span>Comprimento (cm)</span>
              <input inputMode="decimal" value={v.length} onChange={(e) => update(v.key, "length", e.target.value)} />
            </label>
            <label className="erp-field">
              <span>Largura (cm)</span>
              <input inputMode="decimal" value={v.width} onChange={(e) => update(v.key, "width", e.target.value)} />
            </label>
            <label className="erp-field">
              <span>Altura (cm)</span>
              <input inputMode="decimal" value={v.height} onChange={(e) => update(v.key, "height", e.target.value)} />
            </label>
            {volumes.length > 1 && (
              <button type="button" className="erp-btn" onClick={() => setVolumes((c) => c.filter((x) => x.key !== v.key))}>
                Remover volume {index + 1}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="erp-btn"
          onClick={() => setVolumes((c) => [...c, emptyVolume(Math.max(...c.map((x) => x.key)) + 1)])}
        >
          <Icon name="plus" /> Adicionar volume
        </button>
        <p className="erp-muted">
          Total informado: {totals.weight.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg · cubagem{" "}
          {totals.cubage.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} m³
        </p>
      </fieldset>
      <CommandError error={command.error} local={local} />
      <div className="erp-form-actions erp-wide">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>
          Criar cotação (rascunho)
        </button>
      </div>
    </form>
  );
}

function ManualOptionForm({ quote, onSaved }: { quote: ShippingQuote; onSaved: () => void }) {
  const command = useCommand<Record<string, unknown>, ShippingQuote>(shippingQuoteSchema);
  const [carrier, setCarrier] = useState("");
  const [service, setService] = useState("");
  const [price, setPrice] = useState("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [tracking, setTracking] = useState(false);
  const [pickup, setPickup] = useState("");
  const [notes, setNotes] = useState("");
  const [local, setLocal] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLocal(null);
    const money = parseMoneyInput(price);
    if (!carrier.trim() || !service.trim()) return setLocal("Informe transportadora e serviço.");
    if (money === null) return setLocal("Informe o valor do frete (ex.: 23,90).");
    const low = min.trim() ? Number(min) : undefined;
    const high = max.trim() ? Number(max) : undefined;
    if ((low !== undefined && !Number.isInteger(low)) || (high !== undefined && !Number.isInteger(high))) {
      return setLocal("Prazos devem ser números inteiros de dias.");
    }
    if (low !== undefined && high !== undefined && high < low) return setLocal("Prazo máximo menor que o mínimo.");
    try {
      await command.mutateAsync({
        path: `/shipping-quotes/${quote.id}/options`,
        idempotent: true,
        body: {
          carrier: carrier.trim(),
          service: service.trim(),
          price: money,
          deadlineMinDays: low,
          deadlineMaxDays: high,
          validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
          tracking,
          pickupMode: pickup.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      setCarrier("");
      setService("");
      setPrice("");
      onSaved();
    } catch {
      /* erro em CommandError */
    }
  }
  return (
    <form className="erp-card erp-form" onSubmit={submit} aria-label="Registrar cotação obtida fora do sistema">
      <h3 className="erp-wide">Registrar cotação obtida fora do sistema</h3>
      <p className="erp-muted erp-wide">
        Cadastro manual e auditado: o sistema não consulta transportadoras nem inventa preços. Quem registrou e quando
        ficam no histórico.
      </p>
      <label className="erp-field"><span>Transportadora</span><input value={carrier} onChange={(e) => setCarrier(e.target.value)} /></label>
      <label className="erp-field"><span>Serviço</span><input value={service} onChange={(e) => setService(e.target.value)} /></label>
      <label className="erp-field"><span>Valor do frete (R$)</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      <label className="erp-field"><span>Prazo mínimo (dias úteis)</span><input inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></label>
      <label className="erp-field"><span>Prazo máximo (dias úteis)</span><input inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value)} /></label>
      <label className="erp-field"><span>Válida até</span><input type="datetime-local" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} /></label>
      <label className="erp-field"><span>Coleta / postagem</span><input value={pickup} onChange={(e) => setPickup(e.target.value)} /></label>
      <label className="erp-field"><span><input type="checkbox" checked={tracking} onChange={(e) => setTracking(e.target.checked)} /> Possui rastreamento</span></label>
      <label className="erp-field erp-wide"><span>Observações</span><input value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      <CommandError error={command.error} local={local} />
      <div className="erp-form-actions erp-wide">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>Registrar opção</button>
      </div>
    </form>
  );
}

function OptionsTable({ quote, onSelected }: { quote: ShippingQuote; onSelected: () => void }) {
  const { can } = useErp();
  const command = useCommand<Record<string, unknown>, ShippingQuote>(shippingQuoteSchema);
  const [chosen, setChosen] = useState<number | null>(quote.selectedOptionId ?? null);
  const [reason, setReason] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const already = quote.stored_status === "selected";
  const writable = can("shipping:write") && !quote.stale;

  async function select() {
    setLocal(null);
    if (chosen === null) return setLocal("Escolha uma opção antes de selecionar.");
    if (already && chosen !== quote.selectedOptionId && !reason.trim()) {
      return setLocal("Informe o motivo para trocar o frete já selecionado.");
    }
    try {
      await command.mutateAsync({
        path: `/shipping-quotes/${quote.id}/select`,
        idempotent: true,
        body: { optionId: chosen, expectedVersion: quote.version, reason: reason.trim() || undefined },
      });
      setReason("");
      onSelected();
    } catch {
      /* erro em CommandError */
    }
  }

  return (
    <section className="erp-card" aria-label="Opções de frete">
      <h3>Opções de frete</h3>
      {quote.options.length === 0 ? (
        <StatePanel
          kind="empty"
          title="Nenhuma opção registrada"
          message="Registre abaixo a cotação obtida fora do sistema. A cotação automática depende de um conector de frete ainda não configurado."
        />
      ) : (
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Escolha</span></th>
                <th scope="col">Transportadora</th>
                <th scope="col">Serviço</th>
                <th scope="col">Prazo</th>
                <th scope="col">Valor do frete</th>
                <th scope="col">Coleta / postagem</th>
                <th scope="col">Rastreamento</th>
                <th scope="col">Validade</th>
                <th scope="col">Origem</th>
              </tr>
            </thead>
            <tbody>
              {quote.options.map((option) => (
                <tr key={option.id} className={quote.selectedOptionId === option.id ? "erp-row-selected" : undefined}>
                  <td>
                    <input
                      type="radio"
                      name="shipping-option"
                      aria-label={`Escolher ${option.carrier} ${option.service}`}
                      checked={chosen === option.id}
                      disabled={!writable || option.expired}
                      onChange={() => setChosen(option.id)}
                    />
                  </td>
                  <td>{option.carrier}</td>
                  <td>{option.service}</td>
                  <td>{deadline(option)}</td>
                  <td><strong>{formatMoney(option.price)}</strong></td>
                  <td>{option.pickupMode ?? "—"}</td>
                  <td>{option.tracking == null ? "—" : option.tracking ? "Sim" : "Não"}</td>
                  <td>
                    {option.expired ? <Pill tone="bad">Vencida</Pill> : option.validUntil ? formatInstant(option.validUntil) : "—"}
                  </td>
                  <td>
                    <Pill tone="neutral">Manual</Pill>
                    {quote.selectedOptionId === option.id && <Pill tone="ok">Selecionada localmente</Pill>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {quote.options.length > 0 && writable && (
        <div className="erp-form">
          {already && (
            <label className="erp-field erp-wide">
              <span>Motivo (obrigatório ao trocar a opção selecionada)</span>
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
          )}
          <CommandError error={command.error} local={local} />
          <div className="erp-form-actions erp-wide">
            <button type="button" className="erp-btn erp-btn-primary" disabled={command.isPending} onClick={() => void select()}>
              Selecionar frete (local)
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export function ShippingQuotePage() {
  const { id = "" } = useParams();
  const enc = encodeURIComponent(id);
  const { can } = useErp();
  const invalidate = useInvalidateErp();
  const order = useErpQuery(["order", id], `/sales-orders/${enc}`, orderDetailSchema);
  const quotes = useErpQuery(["shipping-quotes", id], `/sales-orders/${enc}/shipping-quotes`, shippingListSchema);
  const history = useErpQuery(["order-history", id], `/sales-orders/${enc}/history`, orderHistorySchema);

  function refresh() {
    void invalidate("shipping-quotes", id);
    void invalidate("order", id);
    void invalidate("order-history", id);
    void invalidate("orders");
  }

  if (order.isLoading || quotes.isLoading) return <StatePanel kind="loading" />;
  const error = order.error ?? quotes.error;
  if (error) {
    return <StatePanel kind="error" message={(error as Error).message} onRetry={() => { void order.refetch(); void quotes.refetch(); }} />;
  }
  const o = order.data;
  const list = quotes.data;
  if (!o || !list) return null;
  const current = list.items.find((q) => q.stored_status === "selected") ?? list.items.find((q) => q.stored_status === "draft");
  const selectedOption = current?.options.find((x) => x.id === current.selectedOptionId);
  const events = (history.data?.items ?? []).filter((e) => e.action.startsWith("shipping."));

  return (
    <>
      <nav className="erp-crumb" aria-label="Você está em">
        <Link to="/erp/frete">Frete</Link>
        <span aria-hidden="true"> › </span>Cotação de Frete
      </nav>
      <div className="erp-pagehead">
        <div>
          <h1>Cotação de Frete</h1>
          <p>Registre as opções de envio, selecione a melhor cotação e vincule-a ao pedido (seleção local).</p>
        </div>
        <div className="erp-pagehead-actions">
          <Link className="erp-btn" to={`/erp/pedidos/${enc}`}>← Voltar para o pedido</Link>
        </div>
      </div>
      <section className="erp-card erp-order-strip" aria-label="Pedido">
        <h2>
          Pedido #{o.number ?? o.id} <StatePill spec={shippingSpec(o.operational?.shipping)} />
        </h2>
        <dl className="erp-strip-grid">
          <div><dt>Cliente</dt><dd>{o.customerName ?? o.customerId ?? "—"}</dd></div>
          <div><dt>Destino</dt><dd>{[current?.destination.city, current?.destination.state].filter(Boolean).join(" - ") || "—"}</dd></div>
          <div><dt>CEP</dt><dd>{current?.destination.zip ?? "—"}</dd></div>
          <div><dt>Total de itens</dt><dd>{o.itemCount ?? "—"}</dd></div>
          <div><dt>Peso total</dt><dd>{current ? `${current.totals.weightKg} kg` : "—"}</dd></div>
          <div><dt>Volumes</dt><dd>{current ? current.totals.volumes : "—"}</dd></div>
          <div><dt>Valor do pedido</dt><dd>{formatMoney(o.netTotal)}</dd></div>
        </dl>
      </section>
      {!o.itemsComplete && (
        <div className="erp-notice" role="status">
          <strong>Pedido incompleto</strong>
          <span>Os itens ainda não foram sincronizados; não é possível criar cotação até a lista estar completa.</span>
        </div>
      )}
      {current?.stale && (
        <div className="erp-notice" role="alert">
          <strong>Cotação desatualizada</strong>
          <span>{current.staleReason} Crie uma nova cotação para poder selecionar o frete.</span>
        </div>
      )}
      {!list.provider.available && (
        <div className="erp-notice" role="status">
          <strong>Cotação automática indisponível</strong>
          <span>{list.provider.reason}</span>
        </div>
      )}
      <div className="erp-two-col">
        <div className="erp-stack">
          <QuoteForm orderId={id} onCreated={refresh} />
          <div className="erp-form-actions">
            <button type="button" className="erp-btn" disabled aria-describedby="auto-quote-why">
              <Icon name="truck" /> Cotar automaticamente
            </button>
            <small id="auto-quote-why" className="erp-muted">
              Indisponível: {list.provider.reason}
            </small>
          </div>
          {current ? (
            <>
              <OptionsTable key={`${current.id}-${current.version}`} quote={current} onSelected={refresh} />
              {can("shipping:write") && !current.stale && <ManualOptionForm quote={current} onSaved={refresh} />}
            </>
          ) : (
            <StatePanel kind="empty" title="Sem cotação para este pedido" message="Crie uma cotação com os volumes para registrar opções de frete." />
          )}
        </div>
        <aside className="erp-stack" aria-label="Resumo e histórico">
          <section className="erp-card">
            <h3>Resumo da cotação</h3>
            {selectedOption ? (
              <>
                <p><strong>{selectedOption.carrier}</strong> · {selectedOption.service}</p>
                <p>Valor do frete: <strong>{formatMoney(selectedOption.price)}</strong></p>
                <p>Prazo estimado: {deadline(selectedOption)}</p>
                <Pill tone="ok">Frete selecionado localmente</Pill>
                <p className="erp-muted">{current?.statement}</p>
              </>
            ) : (
              <p className="erp-muted">Nenhuma opção selecionada para este pedido.</p>
            )}
          </section>
          <section className="erp-card" aria-label="Histórico de atividades">
            <h3>Histórico de atividades</h3>
            {events.length === 0 ? (
              <p className="erp-muted">Nenhuma atividade de frete registrada.</p>
            ) : (
              <ol className="erp-timeline">
                {events.map((e) => (
                  <li key={`${e.at}-${e.action}`}>
                    <strong>{e.action.replace("shipping.", "")}</strong>
                    <span>
                      {formatInstant(e.at)} · por {e.operator}
                      {e.reason ? ` · ${e.reason}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
