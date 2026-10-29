import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'

type ItemPedido = {
  produtoId: string
  quantidade: number | string
  valorUnitario: number | string
  produto?: { nome?: string }
}

// Pedido do revendedor: o que ele cobra do cliente dele x o que paga à Flórida
export function ResumoRevenda({ pedido }: { pedido: any }) {
  const qc = useQueryClient()
  const produtos = useMemo(() => {
    const mapa = new Map<
      string,
      { produtoId: string; nome: string; quantidade: number; florida: number }
    >()
    for (const item of (pedido.itens ?? []) as ItemPedido[]) {
      const atual = mapa.get(item.produtoId)
      const qtd = Number(item.quantidade)
      const valor = qtd * Number(item.valorUnitario)
      if (atual) {
        atual.quantidade += qtd
        atual.florida += valor
      } else {
        mapa.set(item.produtoId, {
          produtoId: item.produtoId,
          nome: item.produto?.nome ?? 'Produto',
          quantidade: qtd,
          florida: valor,
        })
      }
    }
    return [...mapa.values()]
  }, [pedido.itens])

  const salvos = (pedido.precosRevenda ?? {}) as Record<string, number>
  const precosSalvos = () =>
    Object.fromEntries(produtos.map((p) => [p.produtoId, String(salvos[p.produtoId] ?? '')]))
  const [precos, setPrecos] = useState<Record<string, string>>(precosSalvos)
  const [editando, setEditando] = useState(false)

  const salvar = useMutation({
    mutationFn: () =>
      api.patch(`/pedidos/${pedido.id}/precos-revenda`, {
        precos: produtos.map((p) => ({
          produtoId: p.produtoId,
          valor: Number(String(precos[p.produtoId] ?? '').replace(',', '.')) || 0,
        })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedido', pedido.id] })
      setEditando(false)
    },
  })

  const precoDe = (produtoId: string) =>
    editando
      ? Number(String(precos[produtoId] ?? '').replace(',', '.')) || 0
      : Number(salvos[produtoId] ?? 0)
  const totalVenda = produtos.reduce((acc, p) => acc + p.quantidade * precoDe(p.produtoId), 0)
  const totalFlorida = Number(pedido.totalFinal ?? 0)
  const aguardando = pedido.status === 'AGUARDANDO_APROVACAO'

  return (
    <div className="bg-white rounded-xl border border-amber-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-amber-50 border-b border-amber-100">
        <p className="text-xs font-semibold text-amber-800">SUA REVENDA</p>
        {!editando ? (
          <button
            type="button"
            onClick={() => {
              setPrecos(precosSalvos())
              setEditando(true)
            }}
            className="text-xs font-semibold text-amber-800"
          >
            Editar preços
          </button>
        ) : (
          <button
            type="button"
            onClick={() => salvar.mutate()}
            disabled={salvar.isPending}
            className="text-xs font-semibold text-green-700 disabled:opacity-50"
          >
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>
      <div className="divide-y divide-gray-50">
        {produtos.map((p) => (
          <div
            key={p.produtoId}
            className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">{p.nome}</p>
              <p className="text-xs text-gray-500">{p.quantidade} cx</p>
            </div>
            {editando ? (
              <input
                inputMode="decimal"
                value={precos[p.produtoId] ?? ''}
                onChange={(e) =>
                  setPrecos((atual) => ({ ...atual, [p.produtoId]: e.target.value }))
                }
                placeholder="R$/cx"
                className="h-9 w-24 rounded-lg border border-gray-300 px-2 text-right text-sm"
              />
            ) : (
              <p className="text-right text-xs text-gray-600">
                {formatBRL(precoDe(p.produtoId))}/cx
                <span className="block font-semibold text-gray-900">
                  {formatBRL(p.quantidade * precoDe(p.produtoId))}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-1 border-t border-gray-100 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Sua venda</span>
          <span className="font-semibold">{formatBRL(totalVenda)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Você paga à Flórida</span>
          <span className="font-semibold">{formatBRL(totalFlorida)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Sua margem</span>
          <span
            className={`font-bold ${totalVenda - totalFlorida >= 0 ? 'text-green-700' : 'text-red-600'}`}
          >
            {formatBRL(totalVenda - totalFlorida)}
          </span>
        </div>
        {aguardando && (
          <p className="pt-1 text-xs text-amber-700">
            O preço da Flórida pode ser ajustado na aprovação do pedido.
          </p>
        )}
        {salvar.isError && (
          <p className="text-xs text-red-600">Não foi possível salvar os preços.</p>
        )}
      </div>
    </div>
  )
}
