import { useContext } from 'react'
import { AuthContext, type AuthCtx } from './auth-context'

export function useAuth(): AuthCtx {
  return useContext(AuthContext)
}
