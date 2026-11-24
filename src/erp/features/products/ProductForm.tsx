import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useCommand, useInvalidateErp } from "../../api/hooks";
import { type ProductDetail, operationSchema, productDetailSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { OperationTracker } from "../../components/OperationTracker";
import { CapabilityNotice, CommandError, FieldError, PageHeader, useFocusInvalid } from "../../components/ui";
import { parseMoneyInput } from "../../format";

type FormState = {
  name: string;
  code: string;
  unit: string;
  listPrice: string;
  minimumPrice: string;
  externalStock: string;
  ncm: string;
  notes: string;
  imageUrl: string;
  active: boolean;
  onMercos: boolean;
};

const EMPTY: FormState = {
  name: "", code: "", unit: "", listPrice: "", minimumPrice: "", externalStock: "",
  ncm: "", notes: "", imageUrl: "", active: true, onMercos: false,
};

const publishSchema = operationSchema.extend({
  stockPublish: z.string().nullable().optional(),
});

function fromProduct(product: ProductDetail): FormState {
  return {
    name: product.name ?? "",
    code: product.code ?? "",
    unit: product.unit ?? "",
    listPrice: product.listPrice ?? "",
    minimumPrice: product.minimumPrice ?? "",
    externalStock: product.externalStock ?? "",
    ncm: product.ncm ?? "",
    notes: product.notes ?? "",
    imageUrl: product.imageUrl ?? "",
    active: product.active !== false,
    onMercos: product.onMercos === true,
  };
}

function parseStock(text: string): string | null {
  const raw = text.trim().replace(",", ".");
  if (!raw) return null;
  return /^\d+(\.\d{1,4})?$/.test(raw) ? raw : null;
}

export function validateProduct(state: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!state.name.trim()) errors.name = "Informe o nome.";
  else if (state.name.trim().length > 400) errors.name = "Nome com no máximo 400 caracteres.";
  if (!parseMoneyInput(state.listPrice)) errors.listPrice = "Informe o preço de tabela.";
  if (state.minimumPrice.trim() && !parseMoneyInput(state.minimumPrice)) {
    errors.minimumPrice = "Preço mínimo inválido.";
  }
  if (state.externalStock.trim() && parseStock(state.externalStock) === null) {
    errors.externalStock = "Estoque inválido. Use um número maior ou igual a zero.";
  }
  if (state.imageUrl.trim() && !/^https?:\/\//i.test(state.imageUrl.trim())) {
    errors.imageUrl = "A foto precisa ser um link http ou https.";
  }
  return errors;
}

export function ProductPhoto({ name, url }: { name: string; url?: string | null }) {
  const [broken, setBroken] = useState(false);
  if (url && !broken) {
    return <img className="erp-product-photo" src={url} alt="" onError={() => setBroken(true)} />;
  }
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  return <span className="erp-product-photo erp-product-fallback" aria-hidden="true">{initials}</span>;
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function ProductEditor({
  product,
  onSaved,
}: {
  product?: ProductDetail;
  onSaved?: (product: ProductDetail) => void;
}) {
  const [baseline, setBaseline] = useState<ProductDetail | undefined>(product);
  const initial = baseline ? fromProduct(baseline) : EMPTY;
  const [state, setState] = useState<FormState>(initial);
  const [touched, setTouched] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const [stockNote, setStockNote] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const save = useCommand<Record<string, unknown>, ProductDetail>(productDetailSchema);
  const publish = useCommand<undefined, z.infer<typeof publishSchema>>(publishSchema);
  const remove = useCommand<undefined, ProductDetail>(productDetailSchema);
  const invalidate = useInvalidateErp();
  const invalidFocus = useFocusInvalid();
  const navigate = useNavigate();
  const { capability } = useErp();
  const mercos = capability("write.products");
  const mercosBlocked = Boolean(mercos && !mercos.enabled);
  const errors = validateProduct(state);
  const show = (key: keyof FormState) => (touched ? errors[key] : undefined);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function buildBody(): Record<string, unknown> | null {
    const price = parseMoneyInput(state.listPrice);
    const minimum = state.minimumPrice.trim() ? parseMoneyInput(state.minimumPrice) : null;
    const stock = state.externalStock.trim() ? parseStock(state.externalStock) : null;
    const next: Record<string, unknown> = {
      name: state.name.trim(),
      code: textOrNull(state.code),
      unit: textOrNull(state.unit),
      listPrice: price,
      minimumPrice: minimum,
      externalStock: stock,
      ncm: textOrNull(state.ncm),
      notes: textOrNull(state.notes),
      imageUrl: textOrNull(state.imageUrl),
      active: state.active,
      onMercos: state.onMercos,
    };
    if (!baseline) {
      const body: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(next)) {
        if (value !== null && value !== "") body[key] = value;
      }
      body.name = next.name;
      body.listPrice = next.listPrice;
      body.active = state.active;
      body.onMercos = state.onMercos;
      return body;
    }
    const body: Record<string, unknown> = {};
    const comparable: Record<string, unknown> = {
      name: initial.name.trim(),
      code: textOrNull(initial.code),
      unit: textOrNull(initial.unit),
      listPrice: parseMoneyInput(initial.listPrice),
      minimumPrice: initial.minimumPrice.trim() ? parseMoneyInput(initial.minimumPrice) : null,
      externalStock: initial.externalStock.trim() ? parseStock(initial.externalStock) : null,
      ncm: textOrNull(initial.ncm),
      notes: textOrNull(initial.notes),
      imageUrl: textOrNull(initial.imageUrl),
      active: initial.active,
      onMercos: initial.onMercos,
    };
    for (const key of Object.keys(next)) {
      if (next[key] !== comparable[key]) body[key] = next[key];
    }
    if (Object.keys(body).length === 0) return null;
    body.expectedVersion = baseline.version;
    return body;
  }

  async function persist(): Promise<ProductDetail | null> {
    setTouched(true);
    if (Object.keys(errors).length > 0) {
      invalidFocus.focus();
      return null;
    }
    const body = buildBody();
    if (body === null) return baseline ?? null;
    const result = await save
      .mutateAsync({
        path: baseline ? `/products/${encodeURIComponent(baseline.id)}` : "/products",
        method: baseline ? "PATCH" : "POST",
        body,
      })
      .catch(() => null);
    if (!result) return null;
    setBaseline(result);
    setState(fromProduct(result));
    void invalidate("products");
    void invalidate("product", result.id);
    onSaved?.(result);
    return result;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const saved = await persist();
    if (saved && !product) navigate(`/erp/produtos/${encodeURIComponent(saved.id)}`);
  }

  async function subir() {
    const saved = await persist();
    if (!saved) return;
    if (!saved.onMercos) return;
    const result = await publish
      .mutateAsync({
        path: `/products/${encodeURIComponent(saved.id)}/publish`,
        method: "POST",
        idempotent: true,
      })
      .catch(() => null);
    if (!result) return;
    setOperationId(result.operationId);
    setStockNote(result.stockPublish && result.stockPublish !== "queued" ? result.stockPublish : null);
    if (!product) {
      navigate(`/erp/produtos/${encodeURIComponent(saved.id)}`, { state: { operationId: result.operationId } });
    }
  }

  async function excluir() {
    if (!product) return;
    const result = await remove
      .mutateAsync({ path: `/products/${encodeURIComponent(product.id)}`, method: "DELETE" })
      .catch(() => null);
    if (result) {
      void invalidate("products");
      navigate("/erp/produtos");
    }
  }

  const unchanged = Boolean(product) && buildBody() === null;
  const busy = save.isPending || publish.isPending || remove.isPending;

  return (
    <form ref={invalidFocus.ref} className="erp-card erp-form" onSubmit={onSubmit} noValidate aria-label={product ? "Editar produto" : "Novo produto"}>
      <h3 className="erp-wide">{product ? "Dados do produto" : "Novo produto"}</h3>
      <label className="erp-field erp-wide">
        <span>Nome *</span>
        <input value={state.name} onChange={(event) => set("name", event.target.value)} aria-invalid={Boolean(show("name"))} />
        <FieldError message={show("name")} />
      </label>
      <label className="erp-field">
        <span>Código</span>
        <input value={state.code} onChange={(event) => set("code", event.target.value)} />
      </label>
      <label className="erp-field">
        <span>Unidade</span>
        <input value={state.unit} onChange={(event) => set("unit", event.target.value)} placeholder="UN" />
      </label>
      <label className="erp-field">
        <span>Preço de tabela *</span>
        <input value={state.listPrice} onChange={(event) => set("listPrice", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("listPrice"))} />
        <FieldError message={show("listPrice")} />
      </label>
      <label className="erp-field">
        <span>Preço mínimo</span>
        <input value={state.minimumPrice} onChange={(event) => set("minimumPrice", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("minimumPrice"))} />
        <FieldError message={show("minimumPrice")} />
      </label>
      <label className="erp-field">
        <span>Estoque</span>
        <input value={state.externalStock} onChange={(event) => set("externalStock", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("externalStock"))} />
        <FieldError message={show("externalStock")} />
      </label>
      <label className="erp-field">
        <span>NCM</span>
        <input value={state.ncm} onChange={(event) => set("ncm", event.target.value)} />
      </label>
      <label className="erp-field erp-wide">
        <span>Link da foto</span>
        <input value={state.imageUrl} onChange={(event) => set("imageUrl", event.target.value)} placeholder="https://" aria-invalid={Boolean(show("imageUrl"))} />
        <FieldError message={show("imageUrl")} />
      </label>
      <label className="erp-field erp-wide">
        <span>Observações</span>
        <textarea value={state.notes} onChange={(event) => set("notes", event.target.value)} />
      </label>
      <label className="erp-check">
        <input type="checkbox" checked={state.active} onChange={(event) => set("active", event.target.checked)} />
        Ativo
      </label>
      <label className="erp-check">
        <input
          type="checkbox"
          checked={state.onMercos}
          onChange={(event) => set("onMercos", event.target.checked)}
        />
        Mercos
      </label>
      <div className="erp-form-actions">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={busy || unchanged}>
          Salvar
        </button>
        <button
          type="button"
          className="erp-btn"
          disabled={busy || !state.onMercos || mercosBlocked}
          title={mercosBlocked ? mercos?.reason ?? "Carga do Mercos indisponível" : "Enviar este produto ao Mercos"}
          onClick={() => void subir()}
        >
          Subir
        </button>
        {product && !confirmDelete && (
          <button type="button" className="erp-btn erp-btn-danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
            Excluir
          </button>
        )}
        {product && confirmDelete && (
          <button type="button" className="erp-btn erp-btn-danger" disabled={busy} onClick={() => void excluir()}>
            Confirmar exclusão
          </button>
        )}
        <Link className="erp-btn" to="/erp/produtos">Voltar à lista</Link>
      </div>
      <div className="erp-wide">
        <CommandError error={save.error} />
        <CommandError error={publish.error} />
        <CommandError error={remove.error} />
        {stockNote && <p className="erp-muted">Estoque no Mercos: {stockNote}</p>}
        {operationId && <OperationTracker operationId={operationId} />}
      </div>
    </form>
  );
}

export function ProductCreatePage() {
  const { can, capability } = useErp();
  if (!can("products:write")) {
    return (
      <>
        <PageHeader title="Novo produto" subtitle="Seu perfil não altera o cadastro de produtos." />
        <Link className="erp-btn" to="/erp/produtos">Voltar à lista</Link>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Novo produto"
        subtitle="O cadastro fica neste ERP. Marque Mercos e use Subir para enviar o produto e o estoque."
      />
      <CapabilityNotice capability={capability("write.products")} />
      <ProductEditor />
    </>
  );
}
