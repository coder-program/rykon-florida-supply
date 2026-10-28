import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import { LoginPage } from './pages/LoginPage'
import { EntregasPage } from './pages/EntregasPage'
import { EntregaDetalhePage } from './pages/EntregaDetalhePage'
import { ConfirmarPage } from './pages/ConfirmarPage'
import { ScannerPage } from './pages/ScannerPage'
import { DevolucoesPage } from './pages/DevolucoesPage'
import { ROUTER_BASENAME } from './lib/session'
import { PageTransition } from './components/PageTransition'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
})

function PrivateRoute({ children }: { children: ReactNode }) {
  const { usuario } = useAuth()
  return usuario ? <>{children}</> : <Navigate to="/login" replace />
}

function AppRoutes() {
  return (
    <PageTransition>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <EntregasPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entrega/:id"
          element={
            <PrivateRoute>
              <EntregaDetalhePage />
            </PrivateRoute>
          }
        />
        <Route
          path="/entrega/:id/confirmar"
          element={
            <PrivateRoute>
              <ConfirmarPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/scan"
          element={
            <PrivateRoute>
              <ScannerPage />
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
    </PageTransition>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter basename={ROUTER_BASENAME}>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
