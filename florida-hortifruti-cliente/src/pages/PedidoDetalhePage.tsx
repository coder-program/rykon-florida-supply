import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Minus,
  Package2,
  Plus,
  Save,
  Search,
  Truck,
  Wallet,
} from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate, STATUS_COLOR, STATUS_LABEL } from '../lib/utils'

// Ordem esperada do fluxo logístico, usada para montar a timeline de acompanhamento
const ETAPAS_ROTA = [
  'AGUARDANDO_APROVACAO',
  'APROVADO',
  'EM_SEPARACAO',
  'PRONTO_PARA_ENTREGA',
  'EM_ENTREGA',
  'ENTREGUE',
] as const

function formatDataHora(data: string | Date) {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

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

      <section className="overflow-hidden rounded-[28px] bg-linear-to-br from-emerald-700 via-emerald-600 to-lime-400 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
              Pedido
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">
              #{String(p.numero).padStart(6, '0')}
            </h1>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              {editavel
                ? 'Seu pedido ainda pode ser ajustado antes da aprovação.'
                : 'Acompanhe abaixo os itens, valor total e status atual do pedido.'}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLOR[p.status]}`}
          >
            {STATUS_LABEL[p.status] ?? p.status}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/75">
              <CalendarDays className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Data</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">{formatDate(p.data)}</p>
          </div>

          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/75">
              <Package2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Itens</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">{itens.length} item(ns)</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Total estimado
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {formatBRL(total || p.totalEstimado || 0)}
            </p>
          </div>
        </div>
        {editavel && (
          <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Ainda dá para mudar a quantidade ou incluir produto até o pedido ser aprovado.
          </p>
        )}
      </section>

      {p.status !== 'REJEITADO' && p.status !== 'CANCELADO' && (
        <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-emerald-700" />
            <p className="text-sm font-semibold text-gray-900">Acompanhamento da rota</p>
          </div>
          <ol className="mt-4 space-y-4">
            {ETAPAS_ROTA.map((etapa, index) => {
              const registro = (p.historicoStatus ?? []).find((h: any) => h.status === etapa)
              const indiceAtual = ETAPAS_ROTA.indexOf(p.status)
              const concluida = registro != null || index <= indiceAtual
              const ultima = index === ETAPAS_ROTA.length - 1
              return (
                <li key={etapa} className="relative flex gap-3 pl-1">
                  {!ultima && (
                    <span
                      className={`absolute left-2.25 top-5 h-full w-0.5 ${
                        concluida ? 'bg-emerald-300' : 'bg-gray-200'
                      }`}
                    />
                  )}
                  {concluida ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-gray-300" />
                  )}
                  <div className="min-w-0 pb-1">
                    <p
                      className={`text-sm font-semibold ${concluida ? 'text-gray-900' : 'text-gray-400'}`}
                    >
                      {STATUS_LABEL[etapa] ?? etapa}
                    </p>
                    {registro && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        {formatDataHora(registro.alteradoEm)}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Itens do pedido</p>
          <p className="text-xs text-gray-500">{itens.length} item(ns)</p>
        </div>

        {itens.map((i) => {
          const linha = i.valorUnitario != null ? i.valorUnitario * i.quantidade : null
          return (
            <div
              key={i.produtoId}
              className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900">{i.nome}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                    {i.quantidade} {i.unidadeVenda}
                  </p>
                  {i.valorUnitario != null && (
                    <p className="mt-2 text-xs text-gray-500">
                      Unitário: {formatBRL(i.valorUnitario)}
                    </p>
                  )}
                </div>
                {linha != null && (
                  <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">
                      Total
                    </p>
                    <p className="mt-1 shrink-0 font-semibold text-emerald-700">
                      {formatBRL(linha)}
                    </p>
                  </div>
                )}
              </div>

              {editavel && (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Quantidade
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => mudarQtd(i.produtoId, -1)}
                      disabled={itens.length === 1 && i.quantidade <= 1}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Diminuir quantidade"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-semibold text-gray-800">
                      {i.quantidade}
                    </span>
                    <button
                      type="button"
                      onClick={() => mudarQtd(i.produtoId, 1)}
                      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white"
                      aria-label="Aumentar quantidade"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </section>

      {editavel && (
        <section className="space-y-3 rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-gray-900">Adicionar produto</p>
            <p className="mt-1 text-xs text-gray-500">
              Busque no catálogo e inclua novos itens antes da aprovação.
            </p>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no catálogo"
              className="h-12 w-full rounded-2xl border border-gray-300 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
            />
          </div>
          {paraAdicionar.slice(0, 8).map((prod: any) => (
            <button
              key={prod.id}
              type="button"
              onClick={() => adicionar(prod)}
              className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 text-left text-sm"
            >
              <span className="font-medium text-gray-800">{prod.nome}</span>
              <span className="text-emerald-700">
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
        </section>
      )}

      {p.observacoes && (
        <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Observações</p>
          <p className="mt-2 text-sm leading-6 text-gray-700">{p.observacoes}</p>
        </section>
      )}

      {erro && <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {editavel && (
        <button
          type="button"
          disabled={!mudou || salvar.isPending || itens.length === 0}
          onClick={() => salvar.mutate()}
          className="flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> {salvar.isPending ? 'Salvando...' : 'Salvar alterações'}
        </button>
      )}
    </div>
  )
}
