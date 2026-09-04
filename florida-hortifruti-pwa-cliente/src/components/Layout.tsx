import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Package, ShoppingCart, ClipboardList, User } from 'lucide-react'
import { totalItens, lerCarrinho } from '../lib/cart'
import { useEffect, useState } from 'react'

export function Layout({ children }: { children: ReactNode }) {
  const [qtd, setQtd] = useState(() => totalItens(lerCarrinho()))

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
        `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-green-700' : 'text-gray-500'}`
      }
    >
      <span className="relative">
        {icon}
        {badge ? (
          <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-green-600 px-1 text-[10px] text-white text-center">
            {badge}
          </span>
        ) : null}
      </span>
      {label}
    </NavLink>
  )

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-gray-50">
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
