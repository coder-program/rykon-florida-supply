import { createContext, useContext } from 'react'

export type AccessContextValue = { open: () => void; close: () => void; isOpen: boolean }

export const AccessContext = createContext<AccessContextValue | null>(null)

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) throw new Error('useAccess precisa estar dentro de <AccessProvider>')
  return ctx
}
