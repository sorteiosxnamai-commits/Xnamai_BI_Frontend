import { NavLink, Route, Routes } from "react-router-dom";
import { AppearanceSelect } from "../theme/AppearanceSelect";
import { CrmDashboardPage } from "./CrmDashboardPage";
import { CrmLeadsPage } from "./CrmLeadsPage";

export function CrmApp() {
  return (
    <div className="new-app crm-app">
      <a className="skip-link" href="#crm-content">
        Ir para o conteudo
      </a>
      <aside className="app-sidebar">
        <div className="brand-block">
          <strong>XNAMAI</strong>
          <span>CRM de Vendas</span>
        </div>
        <nav aria-label="CRM">
          <NavLink to="/crm" end className={({ isActive }) => (isActive ? "active" : "")}>
            <i>⌂</i>
            Leads
          </NavLink>
          <NavLink to="/crm/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
            <i>◎</i>
            Dashboard
          </NavLink>
          <NavLink to="/">
            <i>&lt;</i>
            Inicio
          </NavLink>
        </nav>
      </aside>
      <main id="crm-content" className="app-content">
        <header className="app-header">
          <div>
            <small>ATENDIMENTO COMERCIAL</small>
            <h1>CRM XNamai</h1>
            <p>Fila aberta para o time de vendas - sem login.</p>
          </div>
          <AppearanceSelect />
        </header>
        <div className="route-content">
          <Routes>
            <Route path="/crm" element={<CrmLeadsPage />} />
            <Route path="/crm/dashboard" element={<CrmDashboardPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
