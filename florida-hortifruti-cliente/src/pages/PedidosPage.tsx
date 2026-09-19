import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, ClipboardList, Package2, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate, STATUS_COLOR, STATUS_LABEL } from '../lib/utils'

export function PedidosPage() {
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['portal-pedidos'],
    queryFn: () => api.get('/portal-cliente/pedidos').then((r) => r.data),
  })

  const listaPedidos = pedidos as any[]

  const resumo = useMemo(() => {
    return listaPedidos.reduce(
      (acc, pedido) => {
        acc.total += 1
        if (pedido.status === 'ENTREGUE') acc.entregues += 1
        if (pedido.status === 'AGUARDANDO_APROVACAO') acc.abertos += 1
        acc.valor += Number(pedido.totalEstimado ?? 0)
        return acc
      },
      { total: 0, entregues: 0, abertos: 0, valor: 0 },
    )
  }, [listaPedidos])

  if (isLoading)
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Carregando...</p>

  return (
    <div className="space-y-4 px-4 py-4">
      <section className="overflow-hidden rounded-[28px] bg-linear-to-br from-emerald-700 via-emerald-600 to-lime-400 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
              Histórico
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">Meus pedidos</h1>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Acompanhe pedidos abertos, entregas concluídas e o valor total movimentado.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
            <ClipboardList className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Total</p>
            <p className="mt-1 text-lg font-semibold">{resumo.total}</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Abertos</p>
            <p className="mt-1 text-lg font-semibold">{resumo.abertos}</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Entregues</p>
            <p className="mt-1 text-lg font-semibold">{resumo.entregues}</p>
          </div>
        </div>
      </section>

      {listaPedidos.length > 0 && (
        <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Valor movimentado
              </p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{formatBRL(resumo.valor)}</p>
            </div>
          </div>
        </section>
      )}

      {listaPedidos.length === 0 && (
        <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <Package2 className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-gray-900">Você ainda não fez pedidos</p>
          <p className="mt-1 text-sm text-gray-500">
            Quando seu primeiro pedido for enviado, ele aparece aqui com status e total.
          </p>
        </section>
      )}

      <div className="space-y-3">
        {listaPedidos.map((p) => (
          <Link
            key={p.id}
            to={`/pedidos/${p.id}`}
            className="group block overflow-hidden rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Pedido
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  #{String(p.numero).padStart(6, '0')}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_COLOR[p.status]}`}
              >
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-gray-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">Data</span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-800">{formatDate(p.data)}</p>
              </div>

              <div className="rounded-2xl bg-gray-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-gray-500">
                  <Package2 className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">Itens</span>
                </div>
                <p className="mt-1 text-sm font-medium text-gray-800">
                  {Array.isArray(p.itens) ? p.itens.length : 0} item(ns)
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-end justify-between gap-3 rounded-2xl bg-emerald-50 px-3 py-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">
                  Total estimado
                </p>
                <p className="mt-1 text-xl font-semibold text-emerald-700">
                  {p.totalEstimado != null ? formatBRL(p.totalEstimado) : 'Sob consulta'}
                </p>
              </div>
              <div className="flex items-center gap-1 text-sm font-semibold text-emerald-700">
                Ver detalhes
                <ArrowRight className="h-4 w-4 transition-transform group-active:translate-x-0.5" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
