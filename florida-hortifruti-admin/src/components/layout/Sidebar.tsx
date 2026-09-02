import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Warehouse,
  BarChart3,
  UserCog,
  LogOut,
  Leaf,
  Banknote,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/useAuth'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/estoque', icon: Warehouse, label: 'Estoque' },
  { to: '/financeiro', icon: Banknote, label: 'Financeiro' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/usuarios', icon: UserCog, label: 'Usuários' },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout, usuario, isFinanceiro } = useAuth()
  const location = useLocation()

  useEffect(() => {
    onClose()
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-green-700 text-white transition-transform duration-200',
          'md:static md:z-auto md:w-60 md:max-w-none md:min-h-screen md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-start justify-between border-b border-green-600 px-5 py-5">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Leaf className="h-5 w-5 text-green-300" />
              <span className="text-sm font-bold uppercase tracking-wide text-green-100">
                Flórida Hortifruti
              </span>
            </div>
            <p className="text-xs text-green-300">Painel Administrativo</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-lg p-2 text-green-100 hover:bg-green-600 md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems
            .filter((item) => (item.to === '/usuarios' ? isFinanceiro : true))
            .map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-green-600 text-white' : 'text-green-100 hover:bg-green-600/60',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-green-600 px-4 py-4">
          <p className="mb-1 truncate text-xs text-green-300">{usuario?.nome}</p>
          <p className="mb-3 truncate text-xs text-green-400">{usuario?.papel}</p>
          <button
            type="button"
            onClick={logout}
            className="flex min-h-11 items-center gap-2 text-sm text-green-200 transition-colors hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </aside>
    </>
  )
}
