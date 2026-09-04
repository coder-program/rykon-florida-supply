import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { formatBRL, formatDate, STATUS_COLOR, STATUS_LABEL } from '../lib/utils'

export function PedidosPage() {
  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['portal-pedidos'],
    queryFn: () => api.get('/portal-cliente/pedidos').then((r) => r.data),
  })

  if (isLoading)
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Carregando...</p>

  return (
    <div className="px-4 py-4 space-y-3">
      <h1 className="text-lg font-semibold">Meus pedidos</h1>
      {(pedidos as any[]).length === 0 && (
        <p className="text-sm text-gray-500">Você ainda não fez pedidos.</p>
      )}
      {(pedidos as any[]).map((p) => (
        <Link
          key={p.id}
          to={`/pedidos/${p.id}`}
          className="block rounded-xl border border-gray-200 bg-white p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Pedido #{String(p.numero).padStart(6, '0')}</p>
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_COLOR[p.status]}`}>
              {STATUS_LABEL[p.status] ?? p.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">{formatDate(p.data)}</p>
          {p.totalEstimado != null && (
            <p className="mt-1 text-sm text-green-700">{formatBRL(p.totalEstimado)}</p>
          )}
        </Link>
      ))}
    </div>
  )
}
