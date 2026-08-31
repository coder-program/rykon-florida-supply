import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Users, Package, Warehouse,
  BarChart3, UserCog, LogOut, Leaf, Banknote,
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
]

export function Sidebar() {
  const { logout, usuario, isAdmin } = useAuth()

  return (
    <aside className="w-60 bg-green-700 text-white flex flex-col min-h-screen shrink-0">
      <div className="px-5 py-6 border-b border-green-600">
        <div className="flex items-center gap-2 mb-1">
          <Leaf className="w-5 h-5 text-green-300" />
          <span className="font-bold text-sm tracking-wide uppercase text-green-100">Flórida Hortifruti</span>
        </div>
        <p className="text-xs text-green-300">Painel Administrativo</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-green-600 text-white'
                  : 'text-green-100 hover:bg-green-600/60')
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}

        {isAdmin && (
          <NavLink
            to="/usuarios"
            className={({ isActive }) =>
              cn('flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-green-600 text-white' : 'text-green-100 hover:bg-green-600/60')
            }
          >
            <UserCog className="w-4 h-4" />
            Usuários
          </NavLink>
        )}
      </nav>

      <div className="px-4 py-4 border-t border-green-600">
        <p className="text-xs text-green-300 mb-1 truncate">{usuario?.nome}</p>
        <p className="text-xs text-green-400 mb-3 truncate">{usuario?.papel}</p>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-xs text-green-200 hover:text-white transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" /> Sair
        </button>
      </div>
    </aside>
  )
}
