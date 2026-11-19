import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from '../contexts/AuthProvider'
import { TOKEN_KEY, USUARIO_KEY } from '../lib/session'

export const USUARIO = { id: 'm1', nome: 'Zé Motorista', email: 'ze@x', papel: 'MOTORISTA' }

export function logar(usuario: object = USUARIO) {
  localStorage.setItem(TOKEN_KEY, 'token-teste')
  localStorage.setItem(USUARIO_KEY, JSON.stringify(usuario))
}

/** Mostra a rota atual na tela, para conferir navegação */
function OndeEstou() {
  const { pathname } = useLocation()
  return <output data-testid="rota">{pathname}</output>
}

/** Renderiza uma tela com rotas, React Query e login, como no app */
export function renderTela(tela: ReactElement, { rota = '/', caminho = '*' } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={[rota]}>
            <Routes>
              <Route path={caminho} element={tela} />
              <Route path="*" element={null} />
            </Routes>
            <OndeEstou />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>,
    ),
  }
}
