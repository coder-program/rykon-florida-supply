import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import { Layout } from './components/Layout'
import { LoginPage } from './pages/LoginPage'
import { DefinirSenhaPage } from './pages/DefinirSenhaPage'
import { ProdutosPage } from './pages/ProdutosPage'
import { CarrinhoPage } from './pages/CarrinhoPage'
import { PedidosPage } from './pages/PedidosPage'
import { PedidoDetalhePage } from './pages/PedidoDetalhePage'
import { ContaPage } from './pages/ContaPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function PrivateRoute({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  return usuario ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/definir-senha" element={<DefinirSenhaPage />} />
      <Route
        path="/produtos"
        element={
          <PrivateRoute>
            <Layout>
              <ProdutosPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/carrinho"
        element={
          <PrivateRoute>
            <Layout>
              <CarrinhoPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/pedidos"
        element={
          <PrivateRoute>
            <Layout>
              <PedidosPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/pedidos/:id"
        element={
          <PrivateRoute>
            <Layout>
              <PedidoDetalhePage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/conta"
        element={
          <PrivateRoute>
            <Layout>
              <ContaPage />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/produtos" replace />} />
      <Route path="*" element={<Navigate to="/produtos" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
