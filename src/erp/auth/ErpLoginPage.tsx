import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AppearanceSelect } from "../../theme/AppearanceSelect";
import { erpLogin } from "./erpSession";

/**
 * Login individual do ERP. Cada pessoa tem credencial, sessão e auditoria
 * próprias; não depende das contas compartilhadas do BI.
 */
export function ErpLoginPage({
  onSuccess,
  onUseBiLogin,
}: {
  onSuccess: () => void;
  onUseBiLogin: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await erpLogin(username.trim(), password);
      setPassword("");
      onSuccess();
    } catch (cause) {
      setPassword("");
      setError(cause instanceof Error ? cause.message : "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit} aria-label="Entrar no ERP">
        <small>XNAMAI ERP</small>
        <h1>Acesso ao ERP</h1>
        <p>Use o seu usuário individual do ERP. Em caso de bloqueio ou esquecimento, peça ao administrador.</p>
        <label>
          Usuário
          <input
            type="email"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label>
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
        <button type="button" className="erp-link-button" onClick={onUseBiLogin}>
          Sou administrador: entrar com o login do BI
        </button>
        <Link className="login-back" to="/">
          Voltar ao início
        </Link>
        <AppearanceSelect />
      </form>
    </main>
  );
}
