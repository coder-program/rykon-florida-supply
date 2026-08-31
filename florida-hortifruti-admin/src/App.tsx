import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthProvider'
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

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } })

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
              <Route path="/usuarios" element={<UsuariosPage />} />
            </Route>
            {/* Página de etiqueta fora do AppLayout — layout limpo para impressão */}
            <Route path="/etiqueta/:id" element={<EtiquetaPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
