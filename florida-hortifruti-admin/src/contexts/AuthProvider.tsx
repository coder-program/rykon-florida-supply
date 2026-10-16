import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api'
import { TOKEN_KEY, USUARIO_KEY } from '../lib/session'
import { AuthContext } from './auth-context'

interface Usuario {
  id: string
  nome: string
  email: string
  papel: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem(USUARIO_KEY)
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback(async (email: string, senha: string) => {
    const { data } = await api.post('/auth/login', { email, senha })
    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(USUARIO_KEY, JSON.stringify(data.usuario))
    setUsuario(data.usuario)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USUARIO_KEY)
    setUsuario(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        usuario,
        login,
        logout,
        isAdmin: usuario?.papel === 'ADMINISTRADOR',
        isFinanceiro: ['ADMINISTRATIVO', 'ADMINISTRADOR'].includes(usuario?.papel ?? ''),
        isSupervisor: usuario?.papel === 'SUPERVISOR',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
