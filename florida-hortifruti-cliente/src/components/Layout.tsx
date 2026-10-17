import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Package, ShoppingCart, ClipboardList, User, Bell } from 'lucide-react'
import { api } from '../lib/api'
import { totalItens, lerCarrinho } from '../lib/cart'
import { useEffect, useState } from 'react'
import logo from '../assets/logo.png'

export function Layout({ children }: { children: ReactNode }) {
  const [qtd, setQtd] = useState(() => totalItens(lerCarrinho()))

  // Avisos ainda não lidos (cobrança e pedido a caminho)
  const { data: avisos = [] } = useQuery<{ lidaEm: string | null }[]>({
    queryKey: ['portal-avisos'],
    queryFn: () => api.get('/portal-cliente/notificacoes').then((r) => r.data),
    refetchInterval: 5 * 60_000,
  })
  const naoLidos = avisos.filter((a) => !a.lidaEm).length

  useEffect(() => {
    const sync = () => setQtd(totalItens(lerCarrinho()))
    window.addEventListener('storage', sync)
    window.addEventListener('carrinho', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('carrinho', sync)
    }
  }, [])

  const item = (to: string, label: string, icon: ReactNode, badge?: number) => (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'font-semibold text-ember' : 'text-gray-500'}`
      }
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-ember px-1 text-[10px] text-white text-center">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </NavLink>
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-gray-50">
      <header className="flex items-center gap-2.5 bg-forest-900 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream p-1">
          <img src={logo} alt="" className="h-full w-auto" />
        </span>
        <span className="leading-none">
          <span className="block text-sm font-bold text-white">Florida Supply</span>
          <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.22em] text-ember">
            Hortifruti
          </span>
        </span>
        <Link
          to="/avisos"
          className="relative ml-auto rounded-lg p-2 text-white/90 hover:bg-white/10"
          aria-label={naoLidos ? `${naoLidos} avisos novos` : 'Avisos'}
        >
          <Bell className="h-5 w-5" />
          {naoLidos > 0 && (
            <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-ember px-1 text-center text-[10px] font-semibold text-white">
              {naoLidos}
            </span>
          )}
        </Link>
      </header>
      <div className="flex-1 pb-20">{children}</div>
      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-lg border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]">
        {item('/produtos', 'Produtos', <Package className="h-5 w-5" />)}
        {item('/pedidos', 'Pedidos', <ClipboardList className="h-5 w-5" />)}
        {item('/carrinho', 'Carrinho', <ShoppingCart className="h-5 w-5" />, qtd)}
        {item('/conta', 'Conta', <User className="h-5 w-5" />)}
      </nav>
    </div>
  )
}
