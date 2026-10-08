import { useState, type FormEvent } from "react";
import { CommandError, FieldError, useFocusInvalid } from "../components/ui";
import { erpChangePassword } from "./erpSession";

export const MIN_PASSWORD = 12;

export function validateNewPassword(current: string, next: string, confirm: string): string | null {
  if (next.length < MIN_PASSWORD) return `A nova senha precisa de ao menos ${MIN_PASSWORD} caracteres.`;
  if (next === current) return "A nova senha deve ser diferente da atual.";
  if (next !== confirm) return "A confirmação não confere com a nova senha.";
  return null;
}

/** Troca de senha própria. Encerra as outras sessões do operador no servidor. */
export function ChangePasswordForm({
  forced = false,
  onDone,
}: {
  forced?: boolean;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [local, setLocal] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [done, setDone] = useState(false);
  const focus = useFocusInvalid();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = validateNewPassword(current, next, confirm);
    setLocal(problem);
    setError(null);
    if (problem) {
      focus.focus();
      return;
    }
    setPending(true);
    try {
      await erpChangePassword(current, next);
      setDone(true);
      setCurrent("");
      setNext("");
      setConfirm("");
      onDone();
    } catch (cause) {
      setError(cause as Error);
    } finally {
      setPending(false);
    }
  }

  return (
    <form ref={focus.ref} className="erp-card erp-form" onSubmit={submit} noValidate aria-label="Trocar senha">
      <h3 className="erp-wide">{forced ? "Defina a sua senha" : "Trocar senha"}</h3>
      {forced && (
        <div className="erp-notice erp-wide" role="note">
          <strong>Senha temporária</strong>
          <span>Por segurança, troque a senha temporária antes de usar o ERP.</span>
        </div>
      )}
      <label className="erp-field">
        <span>Senha atual</span>
        <input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </label>
      <label className="erp-field">
        <span>Nova senha (mínimo {MIN_PASSWORD} caracteres)</span>
        <input
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          aria-invalid={Boolean(local)}
        />
      </label>
      <label className="erp-field">
        <span>Confirmar nova senha</span>
        <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <FieldError message={local} />
      <CommandError error={error} />
      {done && !forced && <span role="status">Senha alterada. As outras sessões foram encerradas.</span>}
      <div className="erp-form-actions">
        <button type="submit" className="erp-btn erp-btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar nova senha"}
        </button>
      </div>
    </form>
  );
}
