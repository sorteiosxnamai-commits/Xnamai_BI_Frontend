import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { AppearanceSelect } from "../theme/AppearanceSelect";

export function LoginPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signIn(username, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <small>XNAMAI BUSINESS INTELLIGENCE</small>
        <h1>Acesso ao BI</h1>
        <p>Ambiente restrito. O CRM de vendas permanece aberto, sem senha, na tela inicial.</p>
        <label>
          Usuário
          <input
            type="email"
            autoComplete="username"
            placeholder="admin@xnamai.com"
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
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
        <Link className="login-back" to="/">
          Voltar ao início
        </Link>
        <AppearanceSelect />
      </form>
    </main>
  );
}
