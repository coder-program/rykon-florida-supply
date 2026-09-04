import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Minus, Plus, Search } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate, STATUS_COLOR, STATUS_LABEL } from '../lib/utils'

type ItemEdit = {
  produtoId: string
  nome: string
  unidadeVenda: string
  quantidade: number
  valorUnitario: number | null
}

export function PedidoDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [itens, setItens] = useState<ItemEdit[]>([])
  const [erro, setErro] = useState('')
  const [busca, setBusca] = useState('')

  const { data: p, isLoading } = useQuery({
    queryKey: ['portal-pedido', id],
    queryFn: () => api.get(`/portal-cliente/pedidos/${id}`).then((r) => r.data),
  })

  const editavel = p?.status === 'AGUARDANDO_APROVACAO'

  const { data: catalogo = [] } = useQuery({
    queryKey: ['portal-produtos'],
    queryFn: () => api.get('/portal-cliente/produtos').then((r) => r.data),
    enabled: editavel,
  })

  useEffect(() => {
    if (!p?.itens) return
    setItens(
      p.itens.map((i: any) => ({
        produtoId: i.produtoId,
        nome: i.nome,
        unidadeVenda: i.unidadeVenda,
        quantidade: Number(i.quantidade),
        valorUnitario: i.valorUnitario,
      })),
    )
    setErro('')
  }, [p])

  const salvar = useMutation({
    mutationFn: () =>
      api.put(`/portal-cliente/pedidos/${id}`, {
        observacoes: p.observacoes,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      }),
    onSuccess: (res) => {
      qc.setQueryData(['portal-pedido', id], res.data)
      qc.invalidateQueries({ queryKey: ['portal-pedidos'] })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível salvar.'))
    },
  })

  const mudou = useMemo(() => {
    if (!p?.itens) return false
    if (p.itens.length !== itens.length) return true
    return itens.some((i) => {
      const orig = p.itens.find((o: any) => o.produtoId === i.produtoId)
      return !orig || Number(orig.quantidade) !== i.quantidade
    })
  }, [itens, p])

  const total = itens.reduce((acc, i) => acc + (i.valorUnitario ?? 0) * i.quantidade, 0)
  const idsNoPedido = new Set(itens.map((i) => i.produtoId))
  const termo = busca.trim().toLowerCase()
  const paraAdicionar = (catalogo as any[]).filter((prod) => {
    if (idsNoPedido.has(prod.id) || prod.disponibilidade === 'INDISPONIVEL') return false
    return !termo || String(prod.nome).toLowerCase().includes(termo)
  })

  function mudarQtd(produtoId: string, delta: number) {
    setItens((atual) =>
      atual
        .map((i) => (i.produtoId === produtoId ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter((i) => i.quantidade > 0),
    )
  }

  function adicionar(prod: any) {
    setItens((atual) => [
      ...atual,
      {
        produtoId: prod.id,
        nome: prod.nome,
        unidadeVenda: prod.unidadeVenda,
        quantidade: 1,
        valorUnitario: prod.preco,
      },
    ])
    setBusca('')
  }

  if (isLoading || !p) {
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Carregando...</p>
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <Link to="/pedidos" className="inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Pedidos
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pedido #{String(p.numero).padStart(6, '0')}</h1>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_COLOR[p.status]}`}>
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      </div>
      <p className="text-xs text-gray-500">{formatDate(p.data)}</p>
      {editavel && (
        <p className="text-xs text-gray-600">
          Ainda dá para mudar a quantidade ou incluir produto até o pedido ser aprovado.
        </p>
      )}

      <div className="space-y-2">
        {itens.map((i) => {
          const linha = i.valorUnitario != null ? i.valorUnitario * i.quantidade : null
          return (
            <div key={i.produtoId} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    {i.quantidade} {i.unidadeVenda} · {i.nome}
                  </p>
                  {i.valorUnitario != null && (
                    <p className="mt-0.5 text-xs text-gray-500">{formatBRL(i.valorUnitario)}</p>
                  )}
                </div>
                {linha != null && (
                  <p className="shrink-0 font-semibold text-green-700">{formatBRL(linha)}</p>
                )}
              </div>
              {editavel && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => mudarQtd(i.produtoId, -1)}
                    disabled={itens.length === 1 && i.quantidade <= 1}
                    className="rounded-lg border p-1 disabled:opacity-30"
                    aria-label="Diminuir quantidade"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-6 text-center text-sm">{i.quantidade}</span>
                  <button
                    type="button"
                    onClick={() => mudarQtd(i.produtoId, 1)}
                    className="rounded-lg border p-1"
                    aria-label="Aumentar quantidade"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {editavel && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500">Adicionar produto</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no catálogo"
              className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3 text-sm"
            />
          </div>
          {paraAdicionar.slice(0, 8).map((prod: any) => (
            <button
              key={prod.id}
              type="button"
              onClick={() => adicionar(prod)}
              className="flex w-full items-center justify-between rounded-xl border bg-white px-3 py-2 text-left text-sm"
            >
              <span>{prod.nome}</span>
              <span className="text-green-700">
                {prod.preco != null ? formatBRL(prod.preco) : 'Adicionar'}
              </span>
            </button>
          ))}
          {paraAdicionar.length === 0 && (
            <p className="text-xs text-gray-500">
              {termo
                ? 'Nenhum produto encontrado.'
                : 'Todos os produtos disponíveis já estão no pedido.'}
            </p>
          )}
        </div>
      )}

      {(p.totalEstimado != null || editavel) && (
        <p className="text-right font-semibold text-green-700">
          {formatBRL(total || p.totalEstimado || 0)}
        </p>
      )}
      {p.observacoes && <p className="text-sm text-gray-600">{p.observacoes}</p>}
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      {editavel && (
        <button
          type="button"
          disabled={!mudou || salvar.isPending || itens.length === 0}
          onClick={() => salvar.mutate()}
          className="w-full min-h-11 rounded-xl bg-green-600 text-white font-medium disabled:opacity-50"
        >
          {salvar.isPending ? 'Salvando...' : 'Salvar alterações'}
        </button>
      )}
    </div>
  )
}
