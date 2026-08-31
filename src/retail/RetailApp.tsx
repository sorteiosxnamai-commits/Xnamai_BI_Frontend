import { NavLink, Route, Routes } from "react-router-dom";
import { AppearanceSelect } from "../theme/AppearanceSelect";
import { RetailRecommendedPage } from "./RetailRecommendedPage";

export function RetailApp() {
  return (
    <div className="new-app retail-app">
      <a className="skip-link" href="#retail-content">
        Ir para o conteudo
      </a>
      <aside className="app-sidebar">
        <div className="brand-block">
          <strong>XNAMAI</strong>
          <span>Analise Varejo</span>
        </div>
        <nav aria-label="Analise Varejo">
          <NavLink to="/analise-varejo" end className={({ isActive }) => (isActive ? "active" : "")}>
            <i>?</i>
            Top 100
          </NavLink>
          <NavLink to="/">
            <i>&lt;</i>
            Inicio
          </NavLink>
        </nav>
      </aside>
      <main id="retail-content" className="app-content">
        <header className="app-header">
          <div>
            <small>VAREJO B2C</small>
            <h1>Analise Varejo</h1>
            <p>Top 100 mais indicados para vender no varejo - acesso aberto, sem login.</p>
          </div>
          <AppearanceSelect />
        </header>
        <div className="route-content">
          <Routes>
            <Route path="/analise-varejo" element={<RetailRecommendedPage />} />
            <Route path="/analise-varejo/*" element={<RetailRecommendedPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
