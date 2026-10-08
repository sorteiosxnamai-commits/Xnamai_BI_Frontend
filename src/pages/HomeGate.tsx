import { Link } from "react-router-dom";
import { erpEnabled } from "../erp/config";
import { AppearanceSelect } from "../theme/AppearanceSelect";

export function HomeGate() {
  const showErp = erpEnabled();
  return (
    <main className="home-gate">
      <div className="home-gate-head">
        <span>XNAMAI</span>
        <h1>Escolha o ambiente</h1>
        <p>
          CRM e Analise Varejo sao abertos para o time. O BI permanece restrito a administracao.
        </p>
        <AppearanceSelect />
      </div>
      <div className={showErp ? "home-gate-grid has-erp" : "home-gate-grid"}>
        <article>
          <small>Equipe comercial</small>
          <h2>CRM de Vendas</h2>
          <p>Fila de leads, Top 20, historico de compras e acompanhamento de atendimentos - sem login.</p>
          <Link to="/crm">Abrir CRM</Link>
        </article>
        <article>
          <small>Varejo B2C</small>
          <h2>Analise Varejo</h2>
          <p>Top 100 produtos mais indicados para marketplaces e site proprio, com margem e canal.</p>
          <Link to="/analise-varejo">Abrir Analise Varejo</Link>
        </article>
        <article>
          <small>Acesso restrito</small>
          <h2>Business Intelligence</h2>
          <p>Indicadores, qualidade de dados e sincronizacao Mercos. Exige usuario e senha.</p>
          <Link to="/overview">Entrar no BI</Link>
        </article>
        {showErp && (
          <article>
            <small>Gestão operacional</small>
            <h2>ERP Xnamai</h2>
            <p>
              Clientes, produtos, pedidos, compras, estoque e financeiro conectados ao Mercos. Acesso por
              permissão individual.
            </p>
            <Link to="/erp">Entrar no ERP</Link>
          </article>
        )}
      </div>
    </main>
  );
}
