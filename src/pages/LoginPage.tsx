import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";

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
        <p>Entre com sua conta administrativa ou de visualização.</p>
        <label>
          Usuário
          <input
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
        {error && <div className="login-error">{error}</div>}
        <button type="submit" disabled={submitting}>
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
