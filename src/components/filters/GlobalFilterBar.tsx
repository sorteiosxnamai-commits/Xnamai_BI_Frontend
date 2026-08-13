import { useQuery } from "@tanstack/react-query";
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
  | "productIds"
  | "categoryIds"
  | "states"
  | "cities"
  | "statuses"
  | "segmentIds"
  | "orderTypeIds"
  | "paymentConditionIds";

function OptionSelect({
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
  const query = useQuery({
    queryKey: ["filter-options", option, states],
    queryFn: () => analyticsApi.filterOptions(option, "", 1, states),
    staleTime: 5 * 60_000,
  });
  const options: FilterOption[] = query.data?.items || [];
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select
        multiple
        value={values}
        aria-label={`${label}; seleção múltipla`}
        onChange={(event) =>
          onChange({
            [filterKey]: Array.from(event.currentTarget.selectedOptions).map(
              (selected) => selected.value
            ),
          })
        }
      >
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
      {query.isLoading && <small>Carregando opções…</small>}
      {query.isError && <small>Falha nas opções</small>}
    </label>
  );
}

export function GlobalFilterBar({ filters, activeCount, onChange, onClear }: Props) {
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.period !== "30d") {
    chips.push({
      key: "period",
      label: `Período: ${filters.period}`,
      clear: () => onChange({ period: "30d" }),
    });
  }
  if (filters.granularity !== "day") {
    chips.push({
      key: "granularity",
      label: `Granularidade: ${filters.granularity}`,
      clear: () => onChange({ granularity: "day" }),
    });
  }
  if (filters.dateFrom || filters.dateTo) {
    chips.push({
      key: "dates",
      label: `${filters.dateFrom || "início"} → ${filters.dateTo || "hoje"}`,
      clear: () => onChange({ dateFrom: undefined, dateTo: undefined }),
    });
  }
  (
    [
      ["statuses", "Status"],
      ["sellerIds", "Vendedores"],
      ["customerIds", "Clientes"],
      ["productIds", "Produtos"],
      ["categoryIds", "Categorias"],
      ["states", "Estados"],
      ["cities", "Cidades"],
      ["segmentIds", "Segmentos"],
      ["orderTypeIds", "Tipos de pedido"],
      ["paymentConditionIds", "Condições de pagamento"],
    ] as [ArrayFilterKey, string][]
  ).forEach(([key, label]) => {
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
      label: `Valor: ${filters.minValue ?? 0}–${filters.maxValue ?? "∞"}`,
      clear: () => onChange({ minValue: undefined, maxValue: undefined }),
    });
  }
  if (filters.activeOnly) {
    chips.push({
      key: "active",
      label: "Somente ativos",
      clear: () => onChange({ activeOnly: false }),
    });
  }

  return (
    <section className="global-filters" aria-label="Filtros globais">
      <div className="filter-heading">
        <div>
          <strong>Filtros globais</strong>
          <span>{activeCount} ativo(s)</span>
        </div>
        <button type="button" onClick={onClear} disabled={!activeCount}>
          Limpar tudo
        </button>
      </div>
      <div className="filter-grid">
        <label className="filter-field">
          <span>Período</span>
          <select
            value={filters.period}
            onChange={(event) =>
              onChange({
                period: event.target.value as AnalyticsFilters["period"],
                dateFrom: undefined,
                dateTo: undefined,
              })
            }
          >
            <option value="7d">7 dias</option>
            <option value="30d">30 dias</option>
            <option value="90d">90 dias</option>
            <option value="365d">365 dias</option>
            <option value="ytd">Ano atual</option>
            <option value="all">Todo o histórico</option>
          </select>
        </label>
        <label className="filter-field">
          <span>Granularidade</span>
          <select
            value={filters.granularity}
            onChange={(event) =>
              onChange({
                granularity: event.target.value as AnalyticsFilters["granularity"],
              })
            }
          >
            <option value="day">Diária</option>
            <option value="week">Semanal</option>
            <option value="month">Mensal</option>
            <option value="quarter">Trimestral</option>
            <option value="year">Anual</option>
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
        <OptionSelect
          label="Vendedor"
          option="sellers"
          filterKey="sellerIds"
          values={filters.sellerIds}
          onChange={onChange}
        />
        <OptionSelect
          label="Cliente"
          option="customers"
          filterKey="customerIds"
          values={filters.customerIds}
          onChange={onChange}
        />
        <OptionSelect
          label="Produto"
          option="products"
          filterKey="productIds"
          values={filters.productIds}
          onChange={onChange}
        />
        <OptionSelect
          label="Categoria"
          option="categories"
          filterKey="categoryIds"
          values={filters.categoryIds}
          onChange={onChange}
        />
        <OptionSelect
          label="Estado"
          option="states"
          filterKey="states"
          values={filters.states}
          onChange={onChange}
        />
        <OptionSelect
          label="Cidade"
          option="cities"
          filterKey="cities"
          values={filters.cities}
          states={filters.states}
          onChange={onChange}
        />
        <OptionSelect
          label="Status"
          option="statuses"
          filterKey="statuses"
          values={filters.statuses}
          onChange={onChange}
        />
        <OptionSelect
          label="Segmento"
          option="segments"
          filterKey="segmentIds"
          values={filters.segmentIds}
          onChange={onChange}
        />
        <OptionSelect
          label="Tipo de pedido"
          option="order-types"
          filterKey="orderTypeIds"
          values={filters.orderTypeIds}
          onChange={onChange}
        />
        <OptionSelect
          label="Condição de pagamento"
          option="payment-conditions"
          filterKey="paymentConditionIds"
          values={filters.paymentConditionIds}
          onChange={onChange}
        />
        <label className="filter-field">
          <span>Valor mínimo</span>
          <input
            type="number"
            min={0}
            value={filters.minValue ?? ""}
            onChange={(event) =>
              onChange({
                minValue: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
        </label>
        <label className="filter-field">
          <span>Valor máximo</span>
          <input
            type="number"
            min={0}
            value={filters.maxValue ?? ""}
            onChange={(event) =>
              onChange({
                maxValue: event.target.value ? Number(event.target.value) : undefined,
              })
            }
          />
        </label>
        <label className="filter-check">
          <input
            type="checkbox"
            checked={filters.activeOnly}
            onChange={(event) => onChange({ activeOnly: event.target.checked })}
          />
          Somente cadastros ativos
        </label>
      </div>
      {!!chips.length && (
        <div className="filter-chips">
          {chips.map((chip) => (
            <button
              type="button"
              key={chip.key}
              onClick={chip.clear}
              aria-label={`Remover filtro ${chip.label}`}
            >
              {chip.label} ×
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
