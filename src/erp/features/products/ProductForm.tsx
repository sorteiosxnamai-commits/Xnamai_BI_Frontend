import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import { categoryListSchema, type ProductDetail, operationSchema, productDetailSchema } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { OperationTracker } from "../../components/OperationTracker";
import { CapabilityNotice, CommandError, FieldError, PageHeader, useFocusInvalid } from "../../components/ui";
import { parseMoneyInput } from "../../format";

type VariantDraft = { code: string; name: string; stock: string; price: string };

type FormState = {
  name: string;
  code: string;
  unit: string;
  categoryId: string;
  listPrice: string;
  minimumPrice: string;
  cost: string;
  externalStock: string;
  packKind: string;
  ncm: string;
  notes: string;
  description: string;
  imageUrl: string;
  photos: string;
  videos: string;
  grossWeight: string;
  width: string;
  height: string;
  length: string;
  supplierCode: string;
  barcode: string;
  lot: string;
  receivedAt: string;
  stockLocation: string;
  variants: VariantDraft[];
  active: boolean;
  onMercos: boolean;
};

const emptyVariant = (): VariantDraft => ({ code: "", name: "", stock: "", price: "" });

const EMPTY: FormState = {
  name: "", code: "", unit: "", categoryId: "", listPrice: "", minimumPrice: "", cost: "",
  externalStock: "", packKind: "", ncm: "", notes: "", description: "", imageUrl: "",
  photos: "", videos: "", grossWeight: "", width: "", height: "", length: "",
  supplierCode: "", barcode: "", lot: "", receivedAt: "", stockLocation: "",
  variants: [], active: true, onMercos: false,
};

const publishSchema = operationSchema.extend({
  stockPublish: z.string().nullable().optional(),
});

function fromProduct(product: ProductDetail): FormState {
  return {
    name: product.name ?? "",
    code: product.code ?? "",
    unit: product.unit ?? "",
    categoryId: product.categoryId ?? "",
    listPrice: product.listPrice ?? "",
    minimumPrice: product.minimumPrice ?? "",
    cost: product.cost ?? "",
    externalStock: product.externalStock ?? "",
    packKind: product.packKind ?? "",
    ncm: product.ncm ?? "",
    notes: product.notes ?? "",
    description: product.description ?? "",
    imageUrl: product.imageUrl ?? "",
    photos: (product.photos ?? []).join("\n"),
    videos: (product.videos ?? []).join("\n"),
    grossWeight: product.grossWeight ?? "",
    width: product.width ?? "",
    height: product.height ?? "",
    length: product.length ?? "",
    supplierCode: product.supplierCode ?? "",
    barcode: product.barcode ?? "",
    lot: product.lot ?? "",
    receivedAt: (product.receivedAt ?? "").slice(0, 10),
    stockLocation: product.stockLocation ?? "",
    variants: (product.variants ?? []).map((item) => ({
      code: item.code ?? "",
      name: item.name ?? "",
      stock: item.externalStock ?? "",
      price: item.price ?? "",
    })),
    active: product.active !== false,
    onMercos: product.onMercos === true,
  };
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function variantsBody(items: VariantDraft[]) {
  return items
    .filter((item) => item.code || item.name || item.stock || item.price)
    .map((item) => ({
      code: item.code.trim() || null,
      name: item.name.trim() || null,
      externalStock: item.stock.trim() ? parseStock(item.stock) : null,
      price: item.price.trim() ? parseMoneyInput(item.price) : null,
    }));
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
  if (state.cost.trim() && !parseMoneyInput(state.cost)) errors.cost = "Preço de compra inválido.";
  (["grossWeight", "width", "height", "length"] as const).forEach((key) => {
    if (state[key].trim() && parseStock(state[key]) === null) errors[key] = "Informe um número maior ou igual a zero.";
  });
  if (state.imageUrl.trim() && !/^https?:\/\//i.test(state.imageUrl.trim())) {
    errors.imageUrl = "A foto precisa ser um link http ou https.";
  }
  if (lines(state.photos).some((item) => !/^https?:\/\//i.test(item))) {
    errors.photos = "Cada foto precisa ser um link http ou https, uma por linha.";
  }
  if (lines(state.videos).some((item) => !/^https?:\/\//i.test(item))) {
    errors.videos = "Cada vídeo precisa ser um link http ou https, um por linha.";
  }
  if (state.variants.some((item) => item.stock.trim() && parseStock(item.stock) === null)) {
    errors.variants = "Estoque da variação inválido.";
  }
  if (state.variants.some((item) => item.price.trim() && !parseMoneyInput(item.price))) {
    errors.variants = "Preço da variação inválido.";
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
  onClose,
}: {
  product?: ProductDetail;
  onSaved?: (product: ProductDetail) => void;
  /** Cadastro aberto na modal da lista: fecha em vez de ir para a página do produto. */
  onClose?: () => void;
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
  const categories = useErpQuery(["categories"], "/categories", categoryListSchema);
  const mercos = capability("write.products");
  const mercosBlocked = Boolean(mercos && !mercos.enabled);
  const errors = validateProduct(state);
  const show = (key: keyof FormState) => (touched ? errors[key] : undefined);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function updateVariant(index: number, key: keyof VariantDraft, value: string) {
    set("variants", state.variants.map((item, itemIndex) => (
      itemIndex === index ? { ...item, [key]: value } : item
    )));
  }

  function snapshot(current: FormState): Record<string, unknown> {
    const measure = (value: string) => (value.trim() ? parseStock(value) : null);
    return {
      name: current.name.trim(),
      code: textOrNull(current.code),
      unit: textOrNull(current.unit),
      categoryId: textOrNull(current.categoryId),
      listPrice: parseMoneyInput(current.listPrice),
      minimumPrice: current.minimumPrice.trim() ? parseMoneyInput(current.minimumPrice) : null,
      cost: current.cost.trim() ? parseMoneyInput(current.cost) : null,
      externalStock: current.externalStock.trim() ? parseStock(current.externalStock) : null,
      packKind: current.packKind || null,
      ncm: textOrNull(current.ncm),
      notes: textOrNull(current.notes),
      description: textOrNull(current.description),
      imageUrl: textOrNull(current.imageUrl),
      photos: lines(current.photos),
      videos: lines(current.videos),
      grossWeight: measure(current.grossWeight),
      width: measure(current.width),
      height: measure(current.height),
      length: measure(current.length),
      supplierCode: textOrNull(current.supplierCode),
      barcode: textOrNull(current.barcode),
      lot: textOrNull(current.lot),
      receivedAt: current.receivedAt || null,
      stockLocation: textOrNull(current.stockLocation),
      variants: variantsBody(current.variants),
      active: current.active,
      onMercos: current.onMercos,
    };
  }

  function buildBody(): Record<string, unknown> | null {
    const next = snapshot(state);
    if (!baseline) {
      const body: Record<string, unknown> = {
        name: next.name,
        listPrice: next.listPrice,
        active: state.active,
        onMercos: state.onMercos,
      };
      for (const [key, value] of Object.entries(next)) {
        if (key in body) continue;
        if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
        body[key] = value;
      }
      return body;
    }
    const previous = snapshot(initial);
    const body: Record<string, unknown> = {};
    for (const key of Object.keys(next)) {
      if (JSON.stringify(next[key]) !== JSON.stringify(previous[key])) body[key] = next[key];
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
    if (saved && !product) {
      if (onClose) onClose();
      else navigate(`/erp/produtos/${encodeURIComponent(saved.id)}`);
    }
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
    if (!product && !onClose) {
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
      {!onClose && <h3 className="erp-wide">{product ? "Dados do produto" : "Novo produto"}</h3>}
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
        <span>Quantidade</span>
        <select value={state.packKind} onChange={(event) => set("packKind", event.target.value)}>
          <option value="">Não informada</option>
          <option value="unit">Unitário</option>
          <option value="box">Caixa</option>
        </select>
      </label>
      <label className="erp-field">
        <span>Categoria</span>
        <select value={state.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
          <option value="">Sem categoria</option>
          {(categories.data?.items ?? []).map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      <label className="erp-field">
        <span>Preço de tabela *</span>
        <input value={state.listPrice} onChange={(event) => set("listPrice", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("listPrice"))} />
        <FieldError message={show("listPrice")} />
      </label>
      <label className="erp-field">
        <span>Preço de compra/custo</span>
        <input value={state.cost} onChange={(event) => set("cost", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("cost"))} />
        <FieldError message={show("cost")} />
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
      <label className="erp-field">
        <span>Código do fornecedor</span>
        <input value={state.supplierCode} onChange={(event) => set("supplierCode", event.target.value)} />
      </label>
      <label className="erp-field">
        <span>Código de barras</span>
        <input value={state.barcode} onChange={(event) => set("barcode", event.target.value)} />
      </label>
      <label className="erp-field">
        <span>Lote</span>
        <input value={state.lot} onChange={(event) => set("lot", event.target.value)} />
      </label>
      <label className="erp-field">
        <span>Data de entrada</span>
        <input type="date" value={state.receivedAt} onChange={(event) => set("receivedAt", event.target.value)} />
      </label>
      <label className="erp-field erp-wide">
        <span>Local no estoque</span>
        <input value={state.stockLocation} onChange={(event) => set("stockLocation", event.target.value)} placeholder="Corredor, prateleira ou endereço" />
        <span className="erp-muted">O cadastro de produto do Mercos não tem geolocalização. Este local fica neste ERP.</span>
      </label>
      <label className="erp-field">
        <span>Peso bruto</span>
        <input value={state.grossWeight} onChange={(event) => set("grossWeight", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("grossWeight"))} />
        <FieldError message={show("grossWeight")} />
      </label>
      <label className="erp-field">
        <span>Largura</span>
        <input value={state.width} onChange={(event) => set("width", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("width"))} />
        <FieldError message={show("width")} />
      </label>
      <label className="erp-field">
        <span>Altura</span>
        <input value={state.height} onChange={(event) => set("height", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("height"))} />
        <FieldError message={show("height")} />
      </label>
      <label className="erp-field">
        <span>Comprimento</span>
        <input value={state.length} onChange={(event) => set("length", event.target.value)} inputMode="decimal" aria-invalid={Boolean(show("length"))} />
        <FieldError message={show("length")} />
      </label>
      <p className="erp-muted erp-wide">Peso e dimensões vêm do espelho do Mercos. Este ERP não consulta a Tray. Os valores podem ser corrigidos aqui.</p>
      <label className="erp-field erp-wide">
        <span>Foto de capa</span>
        <input value={state.imageUrl} onChange={(event) => set("imageUrl", event.target.value)} placeholder="https://" aria-invalid={Boolean(show("imageUrl"))} />
        <FieldError message={show("imageUrl")} />
      </label>
      <label className="erp-field erp-wide">
        <span>Fotos</span>
        <textarea value={state.photos} onChange={(event) => set("photos", event.target.value)} placeholder="Um link http ou https por linha" aria-invalid={Boolean(show("photos"))} />
        <FieldError message={show("photos")} />
      </label>
      <label className="erp-field erp-wide">
        <span>Vídeos</span>
        <textarea value={state.videos} onChange={(event) => set("videos", event.target.value)} placeholder="Um link http ou https por linha" aria-invalid={Boolean(show("videos"))} />
        <FieldError message={show("videos")} />
      </label>
      <label className="erp-field erp-wide">
        <span>Descrição</span>
        <textarea value={state.description} onChange={(event) => set("description", event.target.value)} placeholder="Detalhe do produto. Pode incluir links de foto e vídeo." />
      </label>
      <label className="erp-field erp-wide">
        <span>Observações</span>
        <textarea value={state.notes} onChange={(event) => set("notes", event.target.value)} />
      </label>
      <div className="erp-wide">
        <h3>Variações</h3>
        {state.variants.map((item, index) => (
          <div className="erp-form" key={index}>
            <label className="erp-field">
              <span>Código</span>
              <input
                aria-label={`Código da variação ${index + 1}`}
                value={item.code}
                onChange={(event) => updateVariant(index, "code", event.target.value)}
              />
            </label>
            <label className="erp-field">
              <span>Nome</span>
              <input
                aria-label={`Nome da variação ${index + 1}`}
                value={item.name}
                onChange={(event) => updateVariant(index, "name", event.target.value)}
              />
            </label>
            <label className="erp-field">
              <span>Estoque</span>
              <input
                aria-label={`Estoque da variação ${index + 1}`}
                value={item.stock}
                onChange={(event) => updateVariant(index, "stock", event.target.value)}
              />
            </label>
            <label className="erp-field">
              <span>Preço</span>
              <input
                aria-label={`Preço da variação ${index + 1}`}
                value={item.price}
                onChange={(event) => updateVariant(index, "price", event.target.value)}
              />
            </label>
            <button type="button" className="erp-btn" onClick={() => set("variants", state.variants.filter((_, itemIndex) => itemIndex !== index))}>
              Remover variação
            </button>
          </div>
        ))}
        <FieldError message={show("variants")} />
        <button type="button" className="erp-btn" onClick={() => set("variants", [...state.variants, emptyVariant()])}>
          Adicionar variação
        </button>
      </div>
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
        {onClose ? (
          <button type="button" className="erp-btn" disabled={busy} onClick={onClose}>
            Cancelar
          </button>
        ) : (
          <Link className="erp-btn" to="/erp/produtos">Voltar à lista</Link>
        )}
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
