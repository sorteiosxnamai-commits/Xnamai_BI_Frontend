import { useState, type FormEvent } from "react";
import { useInvalidateErp, useCommand } from "../../api/hooks";
import { operationSchema, type CustomerDetail } from "../../api/schemas";
import { OperationTracker } from "../../components/OperationTracker";
import { CommandError, FieldError, useFocusInvalid } from "../../components/ui";
import { isValidDocument } from "../../format";

type FormState = {
  name: string;
  tradeName: string;
  personType: "" | "F" | "J";
  document: string;
  stateRegistration: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  zipCode: string;
  city: string;
  state: string;
  email: string;
  phone: string;
  mobile: string;
  notes: string;
};

const EMPTY: FormState = {
  name: "", tradeName: "", personType: "", document: "", stateRegistration: "", street: "",
  number: "", complement: "", district: "", zipCode: "", city: "", state: "", email: "",
  phone: "", mobile: "", notes: "",
};

function fromCustomer(customer: CustomerDetail): FormState {
  return {
    name: customer.name ?? "",
    tradeName: customer.tradeName ?? "",
    personType: (customer.personType as "F" | "J" | null) ?? "",
    document: customer.document ?? "",
    stateRegistration: customer.stateRegistration ?? "",
    street: customer.street ?? "",
    number: customer.number ?? "",
    complement: customer.complement ?? "",
    district: customer.district ?? "",
    zipCode: customer.zipCode ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    mobile: customer.mobile ?? "",
    notes: customer.notes ?? "",
  };
}

export function validateCustomer(state: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (!state.name.trim()) errors.name = "Informe o nome / razão social.";
  if (state.document.trim() && !isValidDocument(state.document)) {
    errors.document = "Documento inválido: use letras, números, ponto, barra, hífen (3 a 40 caracteres).";
  }
  if (state.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.email.trim())) {
    errors.email = "E-mail inválido.";
  }
  if (state.state.trim() && state.state.trim().length > 2) errors.state = "Use a sigla da UF (2 letras).";
  return errors;
}

/**
 * Cadastro/edição de cliente. O envio vira operação assíncrona (202): a tela
 * nunca diz "salvo no Mercos" antes da confirmação, e o formulário permanece
 * preenchido em caso de erro.
 */
export function CustomerForm({
  customer,
  onCancel,
}: {
  customer?: CustomerDetail;
  onCancel?: () => void;
}) {
  const initial = customer ? fromCustomer(customer) : EMPTY;
  const [state, setState] = useState<FormState>(initial);
  const [touched, setTouched] = useState(false);
  const [operationId, setOperationId] = useState<string | null>(null);
  const command = useCommand<Record<string, unknown>, ReturnType<typeof operationSchema.parse>>(operationSchema);
  const invalidate = useInvalidateErp();
  const errors = validateCustomer(state);
  const invalidFocus = useFocusInvalid();
  const piiLocked = Boolean(customer?.piiRestricted);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function buildBody(): Record<string, unknown> | null {
    const body: Record<string, unknown> = {};
    for (const key of Object.keys(state) as (keyof FormState)[]) {
      const value = state[key].trim();
      if (customer) {
        if (value !== initial[key].trim()) body[key] = value === "" ? null : value;
      } else if (value !== "") {
        body[key] = value;
      }
    }
    if (customer) {
      if (Object.keys(body).length === 0) return null;
      body.expectedVersion = customer.version;
    }
    return body;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0) {
      invalidFocus.focus();
      return;
    }
    const body = buildBody();
    if (body === null) {
      setTouched(true);
      return;
    }
    const result = await command
      .mutateAsync({
        path: customer ? `/customers/${encodeURIComponent(customer.id)}` : "/customers",
        method: customer ? "PATCH" : "POST",
        body,
        idempotent: true,
      })
      .catch(() => null);
    if (result) {
      setOperationId(result.operationId);
      void invalidate("customers");
    }
  }

  const unchanged = Boolean(customer) && buildBody() === null;
  const show = (key: keyof FormState) => (touched ? errors[key] : undefined);

  return (
    <form ref={invalidFocus.ref} className="erp-card erp-form" onSubmit={submit} noValidate aria-label={customer ? "Editar cliente" : "Novo cliente"}>
      <h3 className="erp-wide">{customer ? `Editar ${customer.name}` : "Novo cliente"}</h3>
      {piiLocked && (
        <div className="erp-notice erp-wide">
          <strong>Dados pessoais protegidos</strong>
          <span>Seu perfil não pode ver nem editar documento, contatos e endereço.</span>
        </div>
      )}
      <label className="erp-field erp-wide">
        <span>Nome / razão social *</span>
        <input value={state.name} onChange={(e) => set("name", e.target.value)} aria-invalid={Boolean(show("name"))} />
        <FieldError message={show("name")} />
      </label>
      <label className="erp-field">
        <span>Nome fantasia</span>
        <input value={state.tradeName} onChange={(e) => set("tradeName", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Tipo de pessoa</span>
        <select value={state.personType} onChange={(e) => set("personType", e.target.value as FormState["personType"])}>
          <option value="">Detectar pelo documento</option>
          <option value="F">Física</option>
          <option value="J">Jurídica</option>
        </select>
      </label>
      <label className="erp-field">
        <span>Documento (CPF/CNPJ, aceita letras)</span>
        <input
          value={state.document}
          disabled={piiLocked}
          onChange={(e) => set("document", e.target.value)}
          aria-invalid={Boolean(show("document"))}
        />
        <FieldError message={show("document")} />
      </label>
      <label className="erp-field">
        <span>Inscrição estadual</span>
        <input value={state.stateRegistration} disabled={piiLocked} onChange={(e) => set("stateRegistration", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>E-mail</span>
        <input type="email" value={state.email} disabled={piiLocked} onChange={(e) => set("email", e.target.value)} aria-invalid={Boolean(show("email"))} />
        <FieldError message={show("email")} />
      </label>
      <label className="erp-field">
        <span>Telefone</span>
        <input value={state.phone} disabled={piiLocked} onChange={(e) => set("phone", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Celular</span>
        <input value={state.mobile} disabled={piiLocked} onChange={(e) => set("mobile", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>CEP</span>
        <input value={state.zipCode} disabled={piiLocked} onChange={(e) => set("zipCode", e.target.value)} />
      </label>
      <label className="erp-field erp-wide">
        <span>Rua</span>
        <input value={state.street} disabled={piiLocked} onChange={(e) => set("street", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Número</span>
        <input value={state.number} disabled={piiLocked} onChange={(e) => set("number", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Complemento</span>
        <input value={state.complement} disabled={piiLocked} onChange={(e) => set("complement", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Bairro</span>
        <input value={state.district} disabled={piiLocked} onChange={(e) => set("district", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Cidade</span>
        <input value={state.city} onChange={(e) => set("city", e.target.value)} />
      </label>
      <label className="erp-field">
        <span>UF</span>
        <input maxLength={5} value={state.state} onChange={(e) => set("state", e.target.value.toUpperCase())} aria-invalid={Boolean(show("state"))} />
        <FieldError message={show("state")} />
      </label>
      <label className="erp-field erp-wide">
        <span>Observações</span>
        <textarea value={state.notes} disabled={piiLocked} onChange={(e) => set("notes", e.target.value)} />
      </label>
      {command.error && (
        <div className="erp-wide">
          <CommandError error={command.error} />
          <p className="erp-muted">Os dados continuam no formulário. Ao reenviar o mesmo conteúdo, a chave de idempotência é a mesma.</p>
        </div>
      )}
      {touched && unchanged && <FieldError message="Nenhum campo foi alterado." />}
      <div className="erp-form-actions">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={command.isPending}>
          {command.isPending ? "Enviando…" : customer ? "Enviar alterações" : "Cadastrar cliente"}
        </button>
        {onCancel && (
          <button type="button" className="erp-btn" onClick={onCancel}>
            Fechar
          </button>
        )}
        <span className="erp-muted">O envio ao Mercos é assíncrono e só é dado como sincronizado após confirmação.</span>
      </div>
      {operationId && (
        <div className="erp-wide">
          <OperationTracker operationId={operationId} />
        </div>
      )}
    </form>
  );
}
