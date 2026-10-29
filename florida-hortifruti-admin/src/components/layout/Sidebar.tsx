import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Warehouse,
  Boxes,
  BarChart3,
  UserCog,
  LogOut,
  Banknote,
  ClipboardList,
  RotateCcw,
  Target,
  Truck,
  Route,
  ExternalLink,
  PiggyBank,
  X,
} from 'lucide-react'
import { useAuth } from '../../contexts/useAuth'
import { cn } from '../../lib/utils'
import { api } from '../../lib/api'
import { rotasPermitidas } from '../../lib/permissoes'
import logo from '../../assets/logo.png'

// App do motorista (mesmo domínio, em /motorista); o supervisor usa para as entregas dele
const URL_APP_ENTREGAS = import.meta.env.VITE_MOTORISTA_URL ?? '/motorista/'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/metas', icon: Target, label: 'Metas' },
  { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { to: '/devolucoes', icon: RotateCcw, label: 'Devoluções' },
  { to: '/solicitacoes', icon: ClipboardList, label: 'Solicitações de Alteração' },
  { to: '/clientes', icon: Users, label: 'Clientes' },
  { to: '/produtos', icon: Package, label: 'Produtos' },
  { to: '/estoque', icon: Warehouse, label: 'Estoque' },
  { to: '/lotes', icon: Boxes, label: 'Lotes' },
  { to: '/fornecedores', icon: Truck, label: 'Fornecedores' },
  { to: '/financeiro', icon: Banknote, label: 'Financeiro' },
  { to: '/investimentos', icon: PiggyBank, label: 'Investimentos' },
  { to: '/relatorios', icon: BarChart3, label: 'Relatórios' },
  { to: '/usuarios', icon: UserCog, label: 'Usuários' },
]

// Só administrador e administrativo/financeiro
const SO_FINANCEIRO = ['/usuarios', '/investimentos']

const PEDIDOS_VISTOS_STORAGE_KEY = 'admin-menu-pedidos-vistos-em'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout, usuario, isFinanceiro, isVisaoGeral, isSupervisor } = useAuth()
  const permitidas = rotasPermitidas(usuario?.papel)
  const location = useLocation()

  const [pedidosVistosEm, setPedidosVistosEm] = useState<number>(() => {
    const salvo = Number(localStorage.getItem(PEDIDOS_VISTOS_STORAGE_KEY) ?? '0')
    return Number.isFinite(salvo) ? salvo : 0
  })

  const { data: pedidosPendentes = [] } = useQuery({
    queryKey: ['menu-pedidos-pendentes'],
    queryFn: async () => {
      const res = await api.get('/pedidos', { params: { status: 'AGUARDANDO_APROVACAO' } })
      return Array.isArray(res.data) ? res.data : []
    },
    refetchInterval: 15000,
    // Visão geral não acessa pedidos
    enabled: !isVisaoGeral,
  })

  const pedidosNovos = useMemo(() => {
    return (pedidosPendentes as any[]).reduce((acc, pedido) => {
      const criadoEm = new Date(
        pedido?.criadoEm ?? pedido?.createdAt ?? pedido?.data ?? 0,
      ).getTime()
      if (!Number.isFinite(criadoEm)) return acc
      return criadoEm > pedidosVistosEm ? acc + 1 : acc
    }, 0)
  }, [pedidosPendentes, pedidosVistosEm])

  useEffect(() => {
    onClose()
  }, [location.pathname])

  useEffect(() => {
    if (!location.pathname.startsWith('/pedidos')) return
    const agora = Date.now()
    localStorage.setItem(PEDIDOS_VISTOS_STORAGE_KEY, String(agora))
    setPedidosVistosEm(agora)
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
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-forest-900 text-white transition-transform duration-200',
          'md:static md:z-auto md:w-60 md:max-w-none md:min-h-screen md:shrink-0 md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex items-start justify-between border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream p-1.5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.6)]">
              <img src={logo} alt="" className="h-full w-auto" />
            </span>
            <div className="leading-none">
              <p className="text-[15px] font-bold text-white">Florida Supply</p>
              <p className="mt-1.5 whitespace-nowrap text-[9px] font-semibold uppercase tracking-[0.16em] text-ember">
                Painel administrativo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-0.5 rounded-lg p-2 text-green-100 hover:bg-white/10 md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems
            .filter((item) =>
              permitidas
                ? permitidas.includes(item.to)
                : SO_FINANCEIRO.includes(item.to)
                  ? isFinanceiro
                  : true,
            )
            .map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#e25a16]'
                      : 'text-green-100/80 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                <Icon className="h-4 w-4" />
                <span className="flex items-center gap-2">
                  {label}
                  {to === '/pedidos' && pedidosNovos > 0 && (
                    <span
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-ember px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
                      aria-label={`${pedidosNovos} pedidos novos aguardando aprovação`}
                      title={`${pedidosNovos} pedidos novos aguardando aprovação`}
                    >
                      {pedidosNovos}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          {isSupervisor && (
            <a
              href={URL_APP_ENTREGAS}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-green-100/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Route className="h-4 w-4" />
              <span className="flex items-center gap-2">
                Entregas
                <ExternalLink className="h-3 w-3" />
              </span>
            </a>
          )}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
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
