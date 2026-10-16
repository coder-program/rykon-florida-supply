import { createContext } from 'react'

interface Usuario {
  id: string
  nome: string
  email: string
  papel: string
}
export interface AuthCtx {
  usuario: Usuario | null
  login: (email: string, senha: string) => Promise<void>
  logout: () => void
  isAdmin: boolean
  isFinanceiro: boolean
  // Vendedor que faz as compras: só as telas de ROTAS_SUPERVISOR
  isSupervisor: boolean
}

export const AuthContext = createContext<AuthCtx>(null!)
