import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/utils'

type Movimento = {
  id: string
  data: string
  origem: string
  quantidade: number
  tipo: 'ENTRADA' | 'SAIDA'
  saldoAntes: number | null
  saldoDepois: number | null
  loteNumero: string
  loteData: string
  produtoNome: string
}

// Rastreabilidade do pedido: Pedido 1542 → 30 cx B2 → Lote 01 → saldo 130 → 100
export function RastreioLotesPedido({ pedidoId }: { pedidoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['pedido-lotes', pedidoId],
    queryFn: () => api.get(`/pedidos/${pedidoId}/lotes`).then((r) => r.data),
  })
  const movimentos = (data?.movimentos ?? []) as Movimento[]

  if (isLoading) return null

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 p-3">
      <p className="text-xs font-semibold uppercase text-gray-500">Lotes utilizados</p>
      {movimentos.length === 0 && (
        <p className="text-xs text-gray-400">Nenhuma baixa de lote registrada neste pedido.</p>
      )}
      {movimentos.map((m) => (
        <div key={m.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
          <p className="text-gray-800">
            <span className={m.tipo === 'SAIDA' ? 'text-red-600' : 'text-green-700'}>
              {m.tipo === 'SAIDA' ? '−' : '+'}
              {m.quantidade} cx
            </span>{' '}
            {m.produtoNome} → {formatDate(m.loteData).slice(0, 5)} - lote {m.loteNumero}
            {m.saldoAntes != null && (
              <span className="text-gray-500">
                {' '}
                → saldo {m.saldoAntes} → {m.saldoDepois} cx
              </span>
            )}
          </p>
          <p className="text-xs text-gray-400">
            {m.origem} · {formatDateTime(m.data)}
          </p>
        </div>
      ))}
    </div>
  )
}
