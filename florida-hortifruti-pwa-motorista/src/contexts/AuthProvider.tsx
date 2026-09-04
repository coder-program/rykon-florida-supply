import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from '../lib/api'
import { AuthContext } from './auth-context'

interface Usuario {
  id: string
  nome: string
  email: string
  papel: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem('usuario')
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback(async (email: string, senha: string) => {
    const { data } = await api.post('/auth/login', { email, senha })
    if (data.usuario?.papel !== 'MOTORISTA') {
      throw new Error('Este acesso não é de motorista')
    }
    localStorage.setItem('token', data.access_token)
    localStorage.setItem('usuario', JSON.stringify(data.usuario))
    setUsuario(data.usuario)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    setUsuario(null)
  }, [])

  return <AuthContext.Provider value={{ usuario, login, logout }}>{children}</AuthContext.Provider>
}
