import { Link } from "react-router-dom";
import { useErp } from "../../auth/context";

type Entry = { to: string; title: string; text: string; permission?: string };

/** URLs e telas existentes preservadas; este índice só as agrupa por permissão. */
export const SETTINGS_ENTRIES: Entry[] = [
  { to: "/erp/integracoes", title: "Integrações", text: "Sincronização com o Mercos, execuções, fila, quarentena e conflitos.", permission: "integration:read" },
  { to: "/erp/capacidades", title: "Capacidades", text: "O que está liberado, bloqueado ou pendente nesta conta e neste ambiente." },
  { to: "/erp/admin", title: "Operadores e permissões", text: "Usuários do ERP, papéis, senhas temporárias e auditoria.", permission: "*" },
  { to: "/erp/clientes", title: "Clientes", text: "Cadastro espelhado do Mercos e dados locais." },
  { to: "/erp/produtos", title: "Produtos", text: "Catálogo, preços por tabela e variantes." },
  { to: "/erp/cadastros", title: "Cadastros auxiliares", text: "Tabelas de preço, condições de pagamento, categorias, vendedores e outros." },
  { to: "/erp/compras", title: "Compras e fornecedores", text: "Pedidos de compra, recebimentos e estornos.", permission: "purchases:read" },
  { to: "/erp/estoque", title: "Estoque", text: "Saldos, movimentos, reservas e autoridade do estoque.", permission: "inventory:read" },
  { to: "/erp/externos", title: "Títulos e pagamentos do Mercos", text: "Títulos, pagamentos e comissões lidos do Mercos.", permission: "financial_links:read" },
];

export function SettingsPage() {
  const { can } = useErp();
  const entries = SETTINGS_ENTRIES.filter((entry) => !entry.permission || can(entry.permission));
  return (
    <>
      <div className="erp-pagehead">
        <div>
          <h1>Configurações</h1>
          <p>Integrações, permissões e cadastros do ERP. Cada área abaixo mantém o endereço e as funções que já existiam.</p>
        </div>
      </div>
      <ul className="erp-settings-grid">
        {entries.map((entry) => (
          <li key={entry.to}>
            <Link to={entry.to}>
              <strong>{entry.title}</strong>
              <span>{entry.text}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
