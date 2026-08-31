import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '../../contexts/useAuth'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { usuario } = useAuth()
  const [menuAberto, setMenuAberto] = useState(false)

  if (!usuario) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh min-h-screen bg-gray-50">
      <Sidebar open={menuAberto} onClose={() => setMenuAberto(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-green-800 bg-green-700 px-3 py-2.5 text-white md:hidden pt-[max(0.65rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            className="rounded-lg p-2 hover:bg-green-600"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="truncate text-sm font-semibold">Flórida Hortifruti</span>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
