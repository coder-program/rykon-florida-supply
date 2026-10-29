import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import { AppLayout } from './components/layout/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { PedidosPage } from './pages/PedidosPage'
import { ClientesPage } from './pages/ClientesPage'
import { ProdutosPage } from './pages/ProdutosPage'
import { EstoquePage } from './pages/EstoquePage'
import { LotesPage } from './pages/LotesPage'
import { FornecedoresPage } from './pages/FornecedoresPage'
import { MetasPage } from './pages/MetasPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { EtiquetaPage } from './pages/EtiquetaPage'
import { FinanceiroPage } from './pages/FinanceiroPage'
import { SolicitacoesAlteracaoPage } from './pages/SolicitacoesAlteracaoPage'
import { DevolucoesPage } from './pages/DevolucoesPage'
import { AbrirPedidoPage } from './pages/AbrirPedidoPage'
import { InvestimentosPage } from './pages/InvestimentosPage'
import { AcompanhamentoEntregasPage } from './pages/AcompanhamentoEntregasPage'
import { ROUTER_BASENAME } from './lib/session'
import { rotasPermitidas } from './lib/permissoes'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

// Telas só do administrador e do administrativo/financeiro
function SomenteFinanceiroRoute({ children }: { children: ReactNode }) {
  const { isFinanceiro } = useAuth()
  if (!isFinanceiro) return <Navigate to="/" replace />
  return <>{children}</>
}

// Supervisor e Visão geral só abrem as telas liberadas para o papel; o resto volta para o dashboard
function RotasDoPapel() {
  const { usuario } = useAuth()
  const { pathname } = useLocation()
  const permitidas = rotasPermitidas(usuario?.papel)
  if (permitidas && !permitidas.includes(pathname)) return <Navigate to="/" replace />
  return <Outlet />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              {/* QR da etiqueta: abre o pedido em Pedidos (que confere o papel) */}
              <Route path="/abrir-pedido/:token" element={<AbrirPedidoPage />} />
              <Route element={<RotasDoPapel />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/metas" element={<MetasPage />} />
                <Route path="/pedidos" element={<PedidosPage />} />
                <Route path="/clientes" element={<ClientesPage />} />
                <Route path="/produtos" element={<ProdutosPage />} />
                <Route path="/estoque" element={<EstoquePage />} />
                <Route path="/lotes" element={<LotesPage />} />
                <Route path="/fornecedores" element={<FornecedoresPage />} />
                <Route path="/relatorios" element={<RelatoriosPage />} />
                <Route path="/financeiro" element={<FinanceiroPage />} />
                <Route path="/solicitacoes" element={<SolicitacoesAlteracaoPage />} />
                <Route path="/devolucoes" element={<DevolucoesPage />} />
                <Route path="/entregas" element={<AcompanhamentoEntregasPage />} />
                <Route
                  path="/usuarios"
                  element={
                    <SomenteFinanceiroRoute>
                      <UsuariosPage />
                    </SomenteFinanceiroRoute>
                  }
                />
                <Route
                  path="/investimentos"
                  element={
                    <SomenteFinanceiroRoute>
                      <InvestimentosPage />
                    </SomenteFinanceiroRoute>
                  }
                />
              </Route>
            </Route>
            {/* Página de etiqueta fora do AppLayout — layout limpo para impressão */}
            <Route path="/etiqueta/:id" element={<EtiquetaPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
