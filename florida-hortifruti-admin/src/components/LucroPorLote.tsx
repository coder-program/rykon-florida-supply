import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate } from '../lib/utils'

type LoteOpcao = {
  id: string
  numero: string
  dataEntrada: string
  produto: string
  quantidadeInicial: number
  quantidadeDisponivel: number
}

type LucroLote = {
  lote: LoteOpcao & { custoUnitario: number; custoLote: number }
  geral: {
    totalVendido: number
    custoTotal: number
    perdas: number
    lucroTotal: number
    margemPercentual: number
    quantidadeTotal: number
    precoMedio: number
  }
  vendas: {
    pedidoId: string
    numeroPedido: number
    data: string
    cliente: string | null
    quantidade: number
    valorUnitario: number
    faturamento: number
    lucro: number
  }[]
}

function rotuloLote(l: LoteOpcao) {
  const dia = new Date(l.dataEntrada).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
  const situacao =
    l.quantidadeDisponivel > 0 ? `${l.quantidadeDisponivel} cx em estoque` : 'esgotado'
  return `${dia} - lote ${l.numero} · ${l.produto} (${situacao})`
}

function Kpi({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${destaque ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}
    >
      <p
        className={`text-[11px] font-medium uppercase tracking-wide ${destaque ? 'text-green-700' : 'text-gray-500'}`}
      >
        {titulo}
      </p>
      <p className={`mt-1 text-xl font-semibold ${destaque ? 'text-green-800' : 'text-gray-900'}`}>
        {valor}
      </p>
    </div>
  )
}

// Lucro de um lote escolhido entre todos os já cadastrados (antigos e novos, com ou sem saldo)
export function LucroPorLote() {
  const [busca, setBusca] = useState('')
  const [loteId, setLoteId] = useState('')

  const { data: lotes = [], isLoading: carregandoLotes } = useQuery<LoteOpcao[]>({
    queryKey: ['lucro-lote-lotes'],
    queryFn: () => api.get('/relatorios/lucro-lote/lotes').then((r) => r.data),
  })

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return lotes
    return lotes.filter((l) => rotuloLote(l).toLowerCase().includes(termo))
  }, [lotes, busca])

  const { data, isLoading, isFetching } = useQuery<LucroLote>({
    queryKey: ['lucro-lote', loteId],
    queryFn: () => api.get(`/relatorios/lucro-lote/${loteId}`).then((r) => r.data),
    enabled: !!loteId,
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,240px)_1fr]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar lote, data ou produto"
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <select
          value={loteId}
          onChange={(e) => setLoteId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">
            {carregandoLotes
              ? 'Carregando lotes...'
              : `Escolha o lote (${filtrados.length} de ${lotes.length})`}
          </option>
          {filtrados.map((l) => (
            <option key={l.id} value={l.id}>
              {rotuloLote(l)}
            </option>
          ))}
        </select>
      </div>

      {!loteId ? (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
          <p className="text-sm font-medium text-gray-700">Escolha um lote para ver o lucro</p>
          <p className="mt-1 text-xs text-gray-500">
            A lista tem todos os lotes já cadastrados, inclusive os esgotados.
          </p>
        </div>
      ) : isLoading || !data ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi titulo="Vendido" valor={formatBRL(data.geral.totalVendido)} />
            <Kpi
              titulo="Caixas vendidas"
              valor={`${data.geral.quantidadeTotal.toFixed(0)} de ${data.lote.quantidadeInicial.toFixed(0)}`}
            />
            <Kpi titulo="Custo" valor={formatBRL(data.geral.custoTotal)} />
            <Kpi titulo="Lucro" valor={formatBRL(data.geral.lucroTotal)} destaque />
            <Kpi titulo="Margem" valor={`${data.geral.margemPercentual.toFixed(1)}%`} />
          </div>
          <p className="text-xs text-gray-500">
            Custo da caixa neste lote: <strong>{formatBRL(data.lote.custoUnitario)}</strong> (com
            frete e comissão) · preço médio de venda:{' '}
            <strong>{formatBRL(data.geral.precoMedio)}</strong> ·{' '}
            {data.geral.perdas > 0 && (
              <>
                perdas descontadas do lucro: <strong>{formatBRL(data.geral.perdas)}</strong> ·{' '}
              </>
            )}
            {data.lote.quantidadeDisponivel > 0
              ? `${data.lote.quantidadeDisponivel.toFixed(0)} cx ainda em estoque`
              : 'lote esgotado'}
            {isFetching ? ' · atualizando…' : ''}
          </p>

          {data.vendas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
              Nenhuma venda deste lote ainda.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Pedido</th>
                    <th className="px-3 py-2.5 font-medium">Cliente</th>
                    <th className="px-3 py-2.5 font-medium text-right">Qtd.</th>
                    <th className="px-3 py-2.5 font-medium text-right">Preço/cx</th>
                    <th className="px-3 py-2.5 font-medium text-right">Faturamento</th>
                    <th className="px-3 py-2.5 font-medium text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {data.vendas.map((v) => (
                    <tr key={`${v.pedidoId}-${v.valorUnitario}`}>
                      <td className="px-3 py-2.5 text-gray-800">
                        #{String(v.numeroPedido).padStart(6, '0')}
                        <span className="block text-xs text-gray-400">{formatDate(v.data)}</span>
                      </td>
                      <td className="px-3 py-2.5 text-gray-700">{v.cliente ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                        {v.quantidade.toFixed(0)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {formatBRL(v.valorUnitario)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                        {formatBRL(v.faturamento)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-semibold ${v.lucro >= 0 ? 'text-green-700' : 'text-red-600'}`}
                      >
                        {formatBRL(v.lucro)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
