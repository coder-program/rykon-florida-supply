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
import { RelatoriosPage } from './pages/RelatoriosPage'
import { UsuariosPage } from './pages/UsuariosPage'
import { EtiquetaPage } from './pages/EtiquetaPage'
import { FinanceiroPage } from './pages/FinanceiroPage'
import { SolicitacoesAlteracaoPage } from './pages/SolicitacoesAlteracaoPage'
import { DevolucoesPage } from './pages/DevolucoesPage'

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

function UsuariosAccessRoute({ children }: { children: ReactNode }) {
  const { isFinanceiro } = useAuth()
  if (!isFinanceiro) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<AppLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/pedidos" element={<PedidosPage />} />
              <Route path="/clientes" element={<ClientesPage />} />
              <Route path="/produtos" element={<ProdutosPage />} />
              <Route path="/estoque" element={<EstoquePage />} />
              <Route path="/relatorios" element={<RelatoriosPage />} />
              <Route path="/financeiro" element={<FinanceiroPage />} />
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
