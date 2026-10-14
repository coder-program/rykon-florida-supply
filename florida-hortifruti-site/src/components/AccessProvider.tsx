import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AccessContext } from '../lib/access'
import { AccessModal } from './AccessModal'

/** A janela de perfis abre pelo botão ou direto pela rota /acessar */
export function AccessProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [manualOpen, setManualOpen] = useState(false)
  const isOpen = manualOpen || location.pathname === '/acessar'

  const open = useCallback(() => setManualOpen(true), [])
  const close = useCallback(() => {
    setManualOpen(false)
    if (location.pathname === '/acessar') navigate('/', { replace: true })
  }, [location.pathname, navigate])

  const value = useMemo(() => ({ open, close, isOpen }), [open, close, isOpen])

  return (
    <AccessContext.Provider value={value}>
      {children}
      <AccessModal open={isOpen} onClose={close} />
    </AccessContext.Provider>
  )
}
