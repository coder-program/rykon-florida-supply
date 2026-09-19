import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, ClipboardList, MapPin, TimerReset, Truck } from 'lucide-react'
import { api } from '../lib/api'
import { STATUS_LABEL, textoEndereco } from '../lib/utils'
import { useAuth } from '../contexts/useAuth'

export function EntregasPage() {
  const { logout, usuario } = useAuth()
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['motorista-entregas'],
    queryFn: () => api.get('/motorista/entregas').then((r) => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 10_000,
  })

  const listaEntregas = entregas as any[]
  const resumo = useMemo(
    () =>
      listaEntregas.reduce(
        (acc, entrega) => {
          acc.total += 1
          if (entrega.status === 'PRONTO_PARA_ENTREGA' || entrega.status === 'APROVADO')
            acc.prontas += 1
          if (entrega.status === 'EM_ENTREGA') acc.rota += 1
          return acc
        },
        { total: 0, prontas: 0, rota: 0 },
      ),
    [listaEntregas],
  )

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 py-4">
      <section className="overflow-hidden rounded-3xl bg-linear-to-br from-sky-700 via-cyan-600 to-emerald-400 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
              Rota do dia
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">Entregas de hoje</h1>
            <p className="mt-2 text-sm text-white/85">{usuario?.nome || 'Motorista'}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur-sm"
          >
            Sair
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Total</p>
            <p className="mt-1 text-lg font-semibold">{resumo.total}</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Prontas</p>
            <p className="mt-1 text-lg font-semibold">{resumo.prontas}</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Na rota</p>
            <p className="mt-1 text-lg font-semibold">{resumo.rota}</p>
          </div>
        </div>
      </section>

      {isLoading && <p className="py-6 text-center text-sm text-gray-500">Carregando...</p>}
      {!isLoading && listaEntregas.length === 0 && (
        <section className="mt-4 rounded-3xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <Truck className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-gray-900">Nenhuma entrega atribuída</p>
          <p className="mt-1 text-sm text-gray-500">
            Quando novos pedidos forem direcionados para sua rota, eles aparecerão aqui.
          </p>
        </section>
      )}

      <div className="mt-4 space-y-3">
        {listaEntregas.map((e) => (
          <Link
            key={e.id}
            to={`/entrega/${e.id}`}
            className="group block rounded-3xl border border-gray-200 bg-white p-4 shadow-sm transition-all active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Pedido
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  #{String(e.numero).padStart(6, '0')}
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {STATUS_LABEL[e.status] ?? e.status}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-gray-50 px-3 py-3">
              <p className="text-sm font-semibold text-gray-900">{e.cliente?.razaoSocialOuNome}</p>
              <div className="mt-2 flex items-start gap-2 text-xs text-gray-500">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-700" />
                <span>{textoEndereco(e.endereco) || 'Sem endereço'}</span>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-sky-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-sky-700/75">
                  <ClipboardList className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">Itens</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-sky-900">
                  {e.itens?.length ?? 0} itens
                </p>
              </div>

              <div className="rounded-2xl bg-emerald-50 px-3 py-2.5">
                <div className="flex items-center gap-2 text-emerald-700/75">
                  <TimerReset className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    Próxima ação
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-emerald-900">Abrir entrega</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm font-semibold text-cyan-700">
              <span>Ver detalhes da rota</span>
              <ArrowRight className="h-4 w-4 transition-transform group-active:translate-x-0.5" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
