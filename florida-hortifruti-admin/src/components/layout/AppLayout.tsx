import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../../contexts/useAuth'
import { Sidebar } from './Sidebar'
import { PageTransition } from '../PageTransition'
import logo from '../../assets/logo.png'

export function AppLayout() {
  const { usuario } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)

  if (!usuario) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh min-h-screen bg-gray-50">
      <Sidebar open={menuAberto} onClose={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-forest-900 px-3 py-2.5 text-white md:hidden pt-[max(0.65rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream p-1">
            <img src={logo} alt="" className="h-full w-auto" />
          </span>
          <span className="truncate text-sm font-semibold">Florida Supply</span>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  )
}
