import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Boxes, Plus, LogOut, RefreshCw, RotateCcw, Target } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/useAuth'
import { formatBRL, formatDate, statusPedidoVisivel } from '../lib/utils'
import { carregarRascunho } from '../lib/draft'
import logo from '../assets/logo.png'

function garantirLista<T>(valor: unknown): T[] {
  if (Array.isArray(valor)) return valor as T[]

  if (valor && typeof valor === 'object') {
    const obj = valor as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(obj.data)) return obj.data as T[]
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.results)) return obj.results as T[]
  }

  return []
}

export function HomePage() {
  const { usuario, logout } = useAuth()
  // Revendedor: pedidos, devoluções e estoque em caixas; sem a meta da empresa
  const revendedor = usuario?.papel === 'REVENDEDOR'
  const navigate = useNavigate()
  const temRascunho = !!carregarRascunho()

  const {
    data: pedidos = [],
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['meus-pedidos'],
    // Supervisor também entra aqui: só os pedidos dele (para o vendedor a API já filtra)
    queryFn: () =>
      api
        .get('/pedidos', { params: { vendedorId: usuario?.id } })
        .then((r) => garantirLista(r.data)),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const { data: devolucoes = [] } = useQuery({
    queryKey: ['devolucoes-resumo-home'],
    queryFn: () => api.get('/devolucoes/minhas').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const devolucoesPendentes = (devolucoes as any[]).filter((d) => d.status === 'PENDENTE').length

  // Meta do dia da empresa: o vendedor vê só o progresso (sem valores)
  const { data: meta } = useQuery<{
    temMeta: boolean
    percentual: number
    atingida: boolean
    temAcumulado: boolean
  }>({
    queryKey: ['meta-hoje'],
    queryFn: () => api.get('/metas/hoje').then((r) => r.data),
    refetchInterval: 5 * 60_000,
    retry: false,
    enabled: !revendedor,
  })

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
      <div className="brand-login px-4 pt-10 pb-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cream p-1.5 shadow-lg">
              <img src={logo} alt="" className="h-full w-auto" />
            </span>
            <div>
              <p className="text-green-200 text-xs">Olá,</p>
              <h1 className="text-white font-bold text-lg leading-tight">{usuario?.nome}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => refetch({ cancelRefetch: false })}
              disabled={isFetching}
              className="w-9 h-9 cursor-pointer bg-white/10 rounded-full flex items-center justify-center text-white disabled:cursor-not-allowed disabled:opacity-70"
              title="Recarregar pedidos"
              aria-label="Recarregar pedidos"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="w-9 h-9 cursor-pointer bg-white/10 rounded-full flex items-center justify-center text-white"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-green-300 text-xs">{pedidos.length} pedido(s) registrado(s)</p>
      </div>

      {/* Botão novo pedido */}
      <div className="relative z-10 px-4 -mt-5">
        <button
          type="button"
          onClick={() => navigate('/pedido/novo')}
          className="w-full cursor-pointer bg-white shadow-lg rounded-2xl px-5 py-4 flex items-center gap-4 border-2 border-ember active:scale-95 transition"
        >
          <div className="w-12 h-12 bg-ember rounded-xl flex items-center justify-center shrink-0">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900">Novo Pedido</p>
            <p className="text-xs text-gray-500">Criar pedido para um cliente</p>
          </div>
        </button>
      </div>

      {revendedor && (
        <div className="px-4 mt-3">
          <button
            type="button"
            onClick={() => navigate('/estoque')}
            className="w-full cursor-pointer bg-white shadow-sm rounded-2xl px-5 py-4 flex items-center gap-4 border border-gray-200 active:scale-95 transition"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
              <Boxes className="w-6 h-6 text-green-700" />
            </div>
            <div className="text-left">
              <p className="font-bold text-gray-900">Estoque</p>
              <p className="text-xs text-gray-500">Caixas disponíveis para pedido</p>
            </div>
          </button>
        </div>
      )}

      {/* Meta do dia */}
      {!revendedor && meta?.temMeta && (
        <div className="px-4 mt-3">
          <div className="rounded-2xl bg-white px-5 py-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Target className="w-4 h-4 text-ember" /> Meta do dia
              </p>
              <span
                className={`text-sm font-bold ${meta.atingida ? 'text-green-700' : 'text-gray-900'}`}
              >
                {meta.atingida ? 'Batida! 🎉' : `${meta.percentual}%`}
              </span>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${meta.atingida ? 'bg-green-600' : 'bg-linear-to-r from-cyan-500 to-ember'}`}
                style={{ width: `${Math.min(100, meta.percentual)}%` }}
              />
            </div>
            {!meta.atingida && meta.temAcumulado && (
              <p className="mt-2 text-xs text-gray-500">Inclui o que faltou no dia anterior.</p>
            )}
          </div>
        </div>
      )}

      <div className="px-4 mt-3">
        <button
          type="button"
          onClick={() => navigate('/devolucoes')}
          className="w-full cursor-pointer bg-red-600 shadow-lg rounded-2xl px-5 py-4 flex items-center gap-4 border-2 border-red-700 active:scale-95 transition text-white"
        >
          <div className="w-12 h-12 bg-red-700 rounded-xl flex items-center justify-center shrink-0">
            <RotateCcw className="w-6 h-6 text-white" />
          </div>
          <div className="text-left">
            <p className="font-bold">Devolução</p>
            <p className="text-xs text-red-100">
              Escanear caixa e enviar 3 fotos
              {devolucoesPendentes > 0 ? ` · ${devolucoesPendentes} pendente(s)` : ''}
            </p>
          </div>
        </button>
      </div>

      {/* Rascunho pendente */}
      {temRascunho && (
        <div className="px-4 mt-3">
          <button
            type="button"
            onClick={() => navigate('/pedido/novo')}
            className="w-full cursor-pointer bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex items-center gap-3 text-left"
          >
            <span className="text-lg">📝</span>
            <div>
              <p className="text-sm font-semibold text-amber-800">Rascunho salvo</p>
              <p className="text-xs text-amber-600">Toque para continuar de onde parou</p>
            </div>
          </button>
        </div>
      )}

      {/* Lista de pedidos */}
      <div className="flex-1 px-4 mt-5 pb-6 space-y-2">
        <h2 className="text-sm font-semibold text-gray-500 mb-3">MEUS PEDIDOS</h2>

        {isLoading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-20" />
            ))}
          </div>
        )}

        {!isLoading && pedidos.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500 text-sm">
              Nenhum pedido ainda.
              <br />
              Toque em "Novo Pedido" para começar.
            </p>
          </div>
        )}

        {pedidos.map((p: any) => (
          <button
            key={p.id}
            type="button"
            onClick={() => navigate(`/pedido/${p.id}`)}
            className="w-full cursor-pointer bg-white rounded-xl p-4 text-left shadow-sm border border-gray-100 active:bg-gray-50 transition"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-gray-400">
                    #{String(p.numero).padStart(6, '0')}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusPedidoVisivel(p).className}`}
                  >
                    {statusPedidoVisivel(p).label}
                  </span>
                </div>
                <p className="font-semibold text-gray-900 text-sm truncate">
                  {p.cliente?.razaoSocialOuNome}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{formatDate(p.data)}</p>
              </div>
              <p className="font-bold text-green-700 text-sm shrink-0">{formatBRL(p.totalFinal)}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
