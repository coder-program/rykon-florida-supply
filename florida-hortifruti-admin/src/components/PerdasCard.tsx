import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'

interface Perdas {
  totalCaixas: number
  valorTotal: number
  itens: {
    id: string
    data: string
    numeroPedido: number
    cliente: string | null
    produto: string
    lote: string
    quantidade: number
    valor: number
  }[]
}

export function PerdasCard({
  dataInicio,
  dataFim,
  rotulo,
}: {
  dataInicio: string
  dataFim: string
  rotulo: string
}) {
  const { data, isLoading } = useQuery<Perdas>({
    queryKey: ['perdas', dataInicio, dataFim],
    queryFn: () =>
      api.get('/devolucoes/perdas', { params: { dataInicio, dataFim } }).then((r) => r.data),
  })

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader>
        <CardTitle>Perdas</CardTitle>
        <p className="mt-1 text-xs text-gray-500">
          Caixas devolvidas que não voltaram ao estoque, já descontadas do lucro · {rotulo}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Caixas</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">
              {isLoading ? '…' : `${data?.totalCaixas ?? 0} cx`}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Valor</p>
            <p className="mt-1 text-xl font-semibold text-red-700">
              {isLoading ? '…' : formatBRL(data?.valorTotal ?? 0)}
            </p>
          </div>
        </div>
        {(data?.itens ?? []).length > 0 && (
          <div className="divide-y divide-gray-100 text-sm">
            {data?.itens.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-gray-800">
                    {p.produto} · lote {p.lote}
                  </p>
                  <p className="truncate text-xs text-gray-500">
                    Pedido #{String(p.numeroPedido).padStart(6, '0')} · {p.cliente ?? 'Cliente'}
                  </p>
                </div>
                <p className="shrink-0 text-right text-gray-700">
                  {p.quantidade} cx{p.valor > 0 ? ` · ${formatBRL(p.valor)}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
