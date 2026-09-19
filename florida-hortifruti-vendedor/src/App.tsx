import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { NovoPedidoPage } from './pages/NovoPedidoPage'
import { DetalhePedidoPage } from './pages/DetalhePedidoPage'
import { AbrirPedidoPage } from './pages/AbrirPedidoPage'
import { DevolucoesPage } from './pages/DevolucoesPage'

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
      <Route path="/abrir-pedido/:token" element={<AbrirPedidoPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/pedido/novo"
        element={
          <PrivateRoute>
            <NovoPedidoPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/pedido/:id"
        element={
          <PrivateRoute>
            <DetalhePedidoPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/devolucoes"
        element={
          <PrivateRoute>
            <DevolucoesPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
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
