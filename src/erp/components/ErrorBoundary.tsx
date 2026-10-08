import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { StatePanel } from "./StatePanel";

/** Boundary de erro do ERP: uma tela quebrada não derruba o portal nem o BI. */
export class ErpErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Falha na tela ERP", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <StatePanel
          kind="error"
          title="Esta tela do ERP falhou"
          message={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
          action={<Link to="/">Voltar ao início</Link>}
        />
      );
    }
    return this.props.children;
  }
}
