import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { analyticsApi } from "../../api/client";
import type { AnalyticsFilters, FilterOption } from "../../types/analytics";

type Props = {
  filters: AnalyticsFilters;
  activeCount: number;
  onChange: (patch: Partial<AnalyticsFilters>) => void;
  onClear: () => void;
};

type ArrayFilterKey =
  | "sellerIds"
  | "customerIds"
  | "excludedCustomerIds"
  | "productIds"
  | "categoryIds"
  | "states"
  | "cities"
  | "statuses"
  | "segmentIds"
  | "orderTypeIds"
  | "paymentConditionIds";

const ARRAY_FILTERS: [ArrayFilterKey, string][] = [
  ["statuses", "Status"],
  ["sellerIds", "Vendedores"],
  ["customerIds", "Clientes"],
  ["excludedCustomerIds", "Excluídos da conta"],
  ["productIds", "Produtos"],
  ["categoryIds", "Categorias"],
  ["states", "Estados"],
  ["cities", "Cidades"],
  ["segmentIds", "Segmentos"],
  ["orderTypeIds", "Tipos de pedido"],
  ["paymentConditionIds", "Condições de pagamento"],
];

const GRANULARITY_FOR_PERIOD: Record<
  AnalyticsFilters["period"],
  AnalyticsFilters["granularity"]
> = {
  "7d": "day",
  "30d": "day",
  "90d": "week",
  "365d": "month",
  ytd: "month",
  all: "month",
};

const PERIOD_LABELS: Record<AnalyticsFilters["period"], string> = {
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  "90d": "Últimos 90 dias",
  "365d": "Últimos 365 dias",
  ytd: "Ano atual",
  all: "Todo o histórico",
};

const GRANULARITY_LABELS: Record<AnalyticsFilters["granularity"], string> = {
  day: "Diária",
  week: "Semanal",
  month: "Mensal",
  quarter: "Trimestral",
  year: "Anual",
};

function SearchableCheckboxFilter({
  label,
  option,
  filterKey,
  values,
  states = [],
  onChange,
}: {
  label: string;
  option: string;
  filterKey: ArrayFilterKey;
  values: string[];
  states?: string[];
  onChange: Props["onChange"];
}) {
  const searchId = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const query = useQuery({
    queryKey: ["filter-options", option, debouncedSearch, states],
    queryFn: () => analyticsApi.filterOptions(option, debouncedSearch, 1, states),
    staleTime: 5 * 60_000,
    enabled: open,
  });
  const options: FilterOption[] = query.data?.items || [];
  const selected = useMemo(() => new Set(values), [values]);

  const toggle = (id: string) => {
    onChange({
      [filterKey]: selected.has(id)
        ? values.filter((value) => value !== id)
        : [...values, id],
    });
  };

  return (
    <details
      className="filter-picker"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary aria-label={`${label}: ${values.length ? `${values.length} selecionados` : "todos"}`}>
        <span>
          <strong>{label}</strong>
          <small>{values.length ? `${values.length} selecionado(s)` : "Todos"}</small>
        </span>
        <i aria-hidden="true">⌄</i>
      </summary>
      <div className="filter-picker-popover">
        <div className="filter-picker-search">
          <span aria-hidden="true">⌕</span>
          <label className="sr-only" htmlFor={searchId}>
            Buscar em {label}
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            placeholder={`Buscar em ${label.toLowerCase()}…`}
            onChange={(event) => setSearch(event.currentTarget.value)}
            autoComplete="off"
          />
        </div>

        <div className="filter-picker-actions">
          <span>{values.length ? `${values.length} marcado(s)` : "Nenhuma restrição"}</span>
          {values.length > 0 && (
            <button type="button" onClick={() => onChange({ [filterKey]: [] })}>
              Desmarcar todos
            </button>
          )}
        </div>

        <div className="filter-option-list" aria-live="polite">
          {query.isLoading && <p className="filter-option-state">Carregando opções…</p>}
          {query.isError && (
            <p className="filter-option-state error">Não foi possível carregar as opções.</p>
          )}
          {!query.isLoading && !query.isError && options.length === 0 && (
            <p className="filter-option-state">Nenhum resultado para essa busca.</p>
          )}
          {options.map((item) => (
            <label className="filter-option" key={item.id}>
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        {!!query.data?.totalItems && (
          <p className="filter-picker-footnote">
            {query.data.totalItems > options.length
              ? `${options.length} de ${query.data.totalItems} opções. Refine a busca para encontrar outras.`
              : `${query.data.totalItems} opção(ões) encontrada(s).`}
          </p>
        )}
      </div>
    </details>
  );
}

export function GlobalFilterBar({ filters, activeCount, onChange, onClear }: Props) {
  const advancedActiveCount = useMemo(() => {
    let count = ARRAY_FILTERS.filter(([key]) => filters[key].length > 0).length;
    if (filters.minValue != null || filters.maxValue != null) count += 1;
    if (filters.activeOnly) count += 1;
    return count;
  }, [filters]);
  const [showAdvanced, setShowAdvanced] = useState(advancedActiveCount > 0);

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.period !== "30d") {
    chips.push({
      key: "period",
      label: `Período: ${PERIOD_LABELS[filters.period]}`,
      clear: () =>
        onChange({ period: "30d", granularity: "day", dateFrom: undefined, dateTo: undefined }),
    });
  }
  if (filters.granularity !== GRANULARITY_FOR_PERIOD[filters.period]) {
    chips.push({
      key: "granularity",
      label: `Visualização: ${GRANULARITY_LABELS[filters.granularity]}`,
      clear: () => onChange({ granularity: GRANULARITY_FOR_PERIOD[filters.period] }),
    });
  }
  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      key: "dates",
      label: `${filters.dateFrom || "início"} → ${filters.dateTo || "hoje"}`,
      clear: () => onChange({ dateFrom: undefined, dateTo: undefined }),
    });
  }
  ARRAY_FILTERS.forEach(([key, label]) => {
    if (filters[key].length) {
      chips.push({
        key,
        label: `${label}: ${filters[key].length}`,
        clear: () => onChange({ [key]: [] }),
      });
    }
  });
  if (filters.minValue != null || filters.maxValue != null) {
    chips.push({
      key: "value",
      label: `Valor: ${filters.minValue ?? 0}–${filters.maxValue ?? "sem limite"}`,
      clear: () => onChange({ minValue: undefined, maxValue: undefined }),
    });
  }
  if (filters.activeOnly) {
    chips.push({
      key: "active",
      label: "Somente cadastros ativos",
      clear: () => onChange({ activeOnly: false }),
    });
  }

  return (
    <section className="global-filters" aria-label="Filtros da análise">
      <div className="filter-heading">
        <div>
          <strong>Filtros da análise</strong>
          <p>Escolha uma ou mais opções. Os resultados atualizam automaticamente.</p>
        </div>
        <div className="filter-heading-actions">
          {activeCount > 0 && <span>{activeCount} filtro(s) ativo(s)</span>}
          <button type="button" onClick={onClear} disabled={!activeCount}>
            Limpar tudo
          </button>
        </div>
      </div>

      <div className="filter-section filter-period-section">
        <div className="filter-section-title">
          <strong>Período analisado</strong>
          <small>Define quais pedidos entram nos números e como aparecem nos gráficos.</small>
        </div>
        <div className="filter-grid filter-period-grid">
          <label className="filter-field">
            <span>Atalho de período</span>
            <select
              aria-label="Período"
              value={filters.period}
              onChange={(event) => {
                const period = event.target.value as AnalyticsFilters["period"];
                onChange({
                  period,
                  dateFrom: undefined,
                  dateTo: undefined,
                  granularity: GRANULARITY_FOR_PERIOD[period],
                });
              }}
            >
              <option value="7d">Últimos 7 dias</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="90d">Últimos 90 dias</option>
              <option value="365d">Últimos 365 dias</option>
              <option value="ytd">Ano atual</option>
              <option value="all">Todo o histórico</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Data inicial</span>
            <input
              type="date"
              value={filters.dateFrom || ""}
              onChange={(event) => onChange({ dateFrom: event.target.value || undefined })}
            />
          </label>
          <label className="filter-field">
            <span>Data final</span>
            <input
              type="date"
              value={filters.dateTo || ""}
              onChange={(event) => onChange({ dateTo: event.target.value || undefined })}
            />
          </label>
          <label className="filter-field">
            <span>Agrupar gráfico por</span>
            <select
              aria-label="Granularidade"
              value={filters.granularity}
              onChange={(event) =>
                onChange({
                  granularity: event.target.value as AnalyticsFilters["granularity"],
                })
              }
            >
              <option value="day">Dia</option>
              <option value="week">Semana</option>
              <option value="month">Mês</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Ano</option>
            </select>
          </label>
        </div>
      </div>

      <button
        className="filter-expand-button"
        type="button"
        aria-label={
          showAdvanced ? "Ocultar filtros detalhados" : "Mostrar filtros detalhados"
        }
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced((current) => !current)}
      >
        <span>
          <strong>{showAdvanced ? "Ocultar filtros detalhados" : "Mostrar filtros detalhados"}</strong>
          <small>Clientes, localização, produtos, pedidos e valores</small>
        </span>
        <span className="filter-expand-meta">
          {advancedActiveCount > 0 && <b>{advancedActiveCount} em uso</b>}
          <i aria-hidden="true">{showAdvanced ? "⌃" : "⌄"}</i>
        </span>
      </button>

      {showAdvanced && (
        <div className="filter-advanced">
          <div className="filter-section">
            <div className="filter-section-title">
              <strong>Clientes e localização</strong>
              <small>Refine quem comprou e onde está.</small>
            </div>
            <div className="filter-picker-grid">
              <SearchableCheckboxFilter label="Vendedor" option="sellers" filterKey="sellerIds" values={filters.sellerIds} onChange={onChange} />
              <SearchableCheckboxFilter label="Cliente" option="customers" filterKey="customerIds" values={filters.customerIds} onChange={onChange} />
              <SearchableCheckboxFilter label="Excluir clientes" option="customers" filterKey="excludedCustomerIds" values={filters.excludedCustomerIds} onChange={onChange} />
              <SearchableCheckboxFilter label="Segmento" option="segments" filterKey="segmentIds" values={filters.segmentIds} onChange={onChange} />
              <SearchableCheckboxFilter label="Estado" option="states" filterKey="states" values={filters.states} onChange={onChange} />
              <SearchableCheckboxFilter label="Cidade" option="cities" filterKey="cities" values={filters.cities} states={filters.states} onChange={onChange} />
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-section-title">
              <strong>Pedidos e produtos</strong>
              <small>Combine características da venda; marcar várias opções amplia a seleção.</small>
            </div>
            <div className="filter-picker-grid">
              <SearchableCheckboxFilter label="Status" option="statuses" filterKey="statuses" values={filters.statuses} onChange={onChange} />
              <SearchableCheckboxFilter label="Produto" option="products" filterKey="productIds" values={filters.productIds} onChange={onChange} />
              <SearchableCheckboxFilter label="Categoria" option="categories" filterKey="categoryIds" values={filters.categoryIds} onChange={onChange} />
              <SearchableCheckboxFilter label="Tipo de pedido" option="order-types" filterKey="orderTypeIds" values={filters.orderTypeIds} onChange={onChange} />
              <SearchableCheckboxFilter label="Condição de pagamento" option="payment-conditions" filterKey="paymentConditionIds" values={filters.paymentConditionIds} onChange={onChange} />
            </div>
            <div className="filter-value-row">
              <label className="filter-field">
                <span>Valor mínimo do pedido</span>
                <div className="filter-money-input">
                  <b>R$</b>
                  <input
                    type="number"
                    min={0}
                    value={filters.minValue ?? ""}
                    placeholder="0,00"
                    onChange={(event) => onChange({ minValue: event.target.value ? Number(event.target.value) : undefined })}
                  />
                </div>
              </label>
              <label className="filter-field">
                <span>Valor máximo do pedido</span>
                <div className="filter-money-input">
                  <b>R$</b>
                  <input
                    type="number"
                    min={0}
                    value={filters.maxValue ?? ""}
                    placeholder="Sem limite"
                    onChange={(event) => onChange({ maxValue: event.target.value ? Number(event.target.value) : undefined })}
                  />
                </div>
              </label>
              <label className="filter-check filter-active-check">
                <input
                  type="checkbox"
                  checked={filters.activeOnly}
                  onChange={(event) => onChange({ activeOnly: event.target.checked })}
                />
                <span>
                  <strong>Somente cadastros ativos</strong>
                  <small>Ignora registros marcados como inativos no cadastro.</small>
                </span>
              </label>
            </div>
          </div>
        </div>
      )}

      {!!chips.length && (
        <fieldset className="filter-chips">
          <legend>Em uso:</legend>
          {chips.map((chip) => (
            <button
              type="button"
              key={chip.key}
              onClick={chip.clear}
              aria-label={`Remover filtro ${chip.label}`}
            >
              {chip.label} <span aria-hidden="true">×</span>
            </button>
          ))}
        </fieldset>
      )}
    </section>
  );
}
