import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'

/** Suaviza a troca de tela (efeito definido em brand.css) */
export function PageTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <div key={pathname} className="brand-page">
      {children}
    </div>
  )
}
