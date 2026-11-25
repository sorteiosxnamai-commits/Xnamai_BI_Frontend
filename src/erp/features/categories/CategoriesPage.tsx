import { type FormEvent, useState } from "react";
import { useCommand, useErpQuery, useInvalidateErp } from "../../api/hooks";
import { categoryListSchema, categorySchema, type Category } from "../../api/schemas";
import { useErp } from "../../auth/context";
import { StatePanel } from "../../components/StatePanel";
import { CommandError, FieldError, PageHeader, useFocusInvalid } from "../../components/ui";

type Draft = { id: string | null; name: string; parentId: string; active: boolean; version: number };

const emptyDraft = (): Draft => ({ id: null, name: "", parentId: "", active: true, version: 1 });

export function CategoriesPage() {
  const { can } = useErp();
  const writable = can("products:write");
  const query = useErpQuery(["categories"], "/categories", categoryListSchema);
  const save = useCommand<Record<string, unknown>, Category>(categorySchema);
  const remove = useCommand<undefined, Category>(categorySchema);
  const invalidate = useInvalidateErp();
  const invalidFocus = useFocusInvalid();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [touched, setTouched] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const items = query.data?.items ?? [];
  const nameError = touched && !draft.name.trim() ? "Informe o nome da categoria." : undefined;

  function edit(item: Category) {
    setDraft({
      id: item.id,
      name: item.name,
      parentId: item.parentId ?? "",
      active: item.active !== false,
      version: item.version,
    });
    setTouched(false);
    setConfirmId(null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!draft.name.trim()) {
      invalidFocus.focus();
      return;
    }
    const fields = {
      name: draft.name.trim(),
      parentId: draft.parentId || null,
      active: draft.active,
    };
    const result = await save
      .mutateAsync({
        path: draft.id ? `/categories/${encodeURIComponent(draft.id)}` : "/categories",
        method: draft.id ? "PATCH" : "POST",
        body: draft.id ? { ...fields, expectedVersion: draft.version } : fields,
      })
      .catch(() => null);
    if (!result) return;
    setDraft(emptyDraft());
    setTouched(false);
    void invalidate("categories");
  }

  async function excluir(item: Category) {
    const result = await remove
      .mutateAsync({ path: `/categories/${encodeURIComponent(item.id)}`, method: "DELETE" })
      .catch(() => null);
    if (!result) return;
    if (draft.id === item.id) setDraft(emptyDraft());
    setConfirmId(null);
    void invalidate("categories");
  }

  const children = new Set(items.map((item) => item.parentId).filter(Boolean));

  return (
    <>
      <PageHeader
        title="Categoria"
        subtitle="Categorias já cadastradas, inclusive as que vieram do Mercos. Uma subcategoria escolhe a categoria pai."
      />
      {query.isLoading && <StatePanel kind="loading" />}
      {query.error && <StatePanel kind="error" message={(query.error as Error).message} onRetry={() => void query.refetch()} />}
      {query.data && items.length === 0 && <StatePanel kind="empty" message="Nenhuma categoria cadastrada." />}
      {items.length > 0 && (
        <div className="erp-table-wrap">
          <table className="erp-table">
            <thead>
              <tr><th>Nome</th><th>Categoria pai</th><th>Origem</th>{writable && <th>Ações</th>}</tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const parent = items.find((candidate) => candidate.id === item.parentId);
                return (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{parent?.name ?? "—"}</td>
                    <td>{item.localOnly ? "ERP" : "Mercos"}</td>
                    {writable && (
                      <td>
                        <button type="button" className="erp-btn" onClick={() => edit(item)}>Alterar</button>
                        {confirmId === item.id ? (
                          <button type="button" className="erp-btn erp-btn-danger" onClick={() => void excluir(item)}>
                            Confirmar exclusão
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="erp-btn erp-btn-danger"
                            disabled={children.has(item.id)}
                            title={children.has(item.id) ? "Exclua as subcategorias antes" : "Excluir categoria"}
                            onClick={() => setConfirmId(item.id)}
                          >
                            Excluir
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {writable && (
        <form ref={invalidFocus.ref} className="erp-card erp-form" onSubmit={onSubmit} noValidate aria-label={draft.id ? "Alterar categoria" : "Nova categoria"}>
          <h3 className="erp-wide">{draft.id ? "Alterar categoria" : "Nova categoria ou subcategoria"}</h3>
          <label className="erp-field erp-wide">
            <span>Nome *</span>
            <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} aria-invalid={Boolean(nameError)} />
            <FieldError message={nameError} />
          </label>
          <label className="erp-field">
            <span>Categoria pai</span>
            <select value={draft.parentId} onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}>
              <option value="">Nenhuma (categoria principal)</option>
              {items.filter((item) => item.id !== draft.id).map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="erp-check">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft({ ...draft, active: event.target.checked })} />
            Ativa
          </label>
          <div className="erp-form-actions">
            <button type="submit" className="erp-btn erp-btn-primary" disabled={save.isPending}>
              {draft.id ? "Salvar categoria" : "Criar categoria"}
            </button>
            {draft.id && (
              <button type="button" className="erp-btn" onClick={() => { setDraft(emptyDraft()); setTouched(false); }}>
                Cancelar edição
              </button>
            )}
          </div>
          <div className="erp-wide">
            <CommandError error={save.error ?? remove.error} />
          </div>
        </form>
      )}
    </>
  );
}
