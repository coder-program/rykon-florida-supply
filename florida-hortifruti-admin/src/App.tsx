import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { MetasPage } from './pages/MetasPage'
import { RelatoriosPage } from './pages/RelatoriosPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { EtiquetaPage } from './pages/EtiquetaPage'
import { FinanceiroPage } from './pages/FinanceiroPage'
import { SolicitacoesAlteracaoPage } from './pages/SolicitacoesAlteracaoPage'
import { DevolucoesPage } from './pages/DevolucoesPage'
import { ROUTER_BASENAME } from './lib/session'
import { ROTAS_SUPERVISOR } from './lib/permissoes'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

function UsuariosAccessRoute({ children }: { children: ReactNode }) {
  const { isFinanceiro } = useAuth()
  if (!isFinanceiro) return <Navigate to="/" replace />
  return <>{children}</>
}

// Supervisor só abre as telas liberadas para ele; o resto volta para o dashboard
function SupervisorRoute({ path, children }: { path: string; children: ReactNode }) {
  const { isSupervisor } = useAuth()
  if (isSupervisor && !ROTAS_SUPERVISOR.includes(path)) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/metas" element={<MetasPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
              <Route
                path="/clientes"
                element={
                  <SupervisorRoute path="/clientes">
                    <ClientesPage />
                  </SupervisorRoute>
                }
              />
              <Route
                path="/produtos"
                element={
                  <SupervisorRoute path="/produtos">
                    <ProdutosPage />
                  </SupervisorRoute>
                }
              />
              <Route path="/estoque" element={<EstoquePage />} />
              <Route path="/lotes" element={<LotesPage />} />
              <Route
                path="/relatorios"
                element={
                  <SupervisorRoute path="/relatorios">
                    <RelatoriosPage />
                  </SupervisorRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <SupervisorRoute path="/financeiro">
                    <FinanceiroPage />
                  </SupervisorRoute>
                }
              />
              <Route path="/solicitacoes" element={<SolicitacoesAlteracaoPage />} />
              <Route path="/devolucoes" element={<DevolucoesPage />} />
              <Route
                path="/usuarios"
                element={
                  <UsuariosAccessRoute>
                    <UsuariosPage />
                  </UsuariosAccessRoute>
                }
              />
            </Route>
            {/* Página de etiqueta fora do AppLayout — layout limpo para impressão */}
            <Route path="/etiqueta/:id" element={<EtiquetaPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
