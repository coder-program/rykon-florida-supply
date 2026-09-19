import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheckBig, MapPin, Package2, Phone, Route, Truck } from 'lucide-react'
import { api, resolveAssetUrl } from '../lib/api'
import { mapsUrl, STATUS_LABEL, textoEndereco } from '../lib/utils'

export function EntregaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: e, isLoading } = useQuery({
    queryKey: ['motorista-entrega', id],
    queryFn: () => api.get(`/motorista/entregas/${id}`).then((r) => r.data),
  })

  const iniciar = useMutation({
    mutationFn: () => api.post(`/motorista/entregas/${id}/iniciar`),
    onSuccess: (res) => {
      qc.setQueryData(['motorista-entrega', id], res.data)
      qc.invalidateQueries({ queryKey: ['motorista-entregas'] })
    },
  })

  if (isLoading || !e) {
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Carregando...</p>
  }

  const endereco = textoEndereco(e.endereco)

  return (
    <div className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Entregas
      </Link>

      <section className="overflow-hidden rounded-3xl bg-linear-to-br from-sky-700 via-cyan-600 to-emerald-400 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
              Entrega
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">
              Pedido #{String(e.numero).padStart(6, '0')}
            </h1>
            <p className="mt-2 text-sm text-white/85">
              Veja os dados do cliente, abra a rota e avance para a confirmação da entrega.
            </p>
          </div>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {STATUS_LABEL[e.status] ?? e.status}
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/75">
              <Package2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Itens</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">{e.itens?.length ?? 0} item(ns)</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/75">
              <Truck className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Status</span>
            </div>
            <p className="mt-1 text-sm font-semibold text-white">
              {STATUS_LABEL[e.status] ?? e.status}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <Route className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">Cliente e destino</p>
            <p className="mt-2 text-base font-semibold text-gray-900">
              {e.cliente?.razaoSocialOuNome}
            </p>
            <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              <span>{e.cliente?.telefone || e.cliente?.whatsapp || 'Telefone não informado'}</span>
            </div>
            <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" />
              <span>{endereco || 'Sem endereço'}</span>
            </div>
          </div>
        </div>
      </section>

      {endereco && (
        <a
          href={mapsUrl(e.endereco)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 text-sm font-semibold text-white shadow-sm"
        >
          <MapPin className="h-4 w-4" /> Abrir no mapa
        </a>
      )}

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Itens da entrega</p>
          <p className="text-xs text-gray-500">{e.itens?.length ?? 0} item(ns)</p>
        </div>
        <div className="mt-3 space-y-2">
          {e.itens.map((i: any) => (
            <div key={i.produtoId} className="rounded-2xl bg-gray-50 px-3 py-3 text-sm">
              <p className="font-semibold text-gray-900">{i.nome}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {i.quantidade} {i.unidadeVenda}
              </p>
            </div>
          ))}
        </div>
      </section>

      {e.comprovante?.fotoUrl && (
        <section className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-sm">
          <p className="text-sm font-semibold text-emerald-900">Comprovante de entrega</p>
          {e.comprovante?.nomeRecebedor && (
            <p className="mt-1 text-xs text-emerald-900/80">
              Recebido por: {e.comprovante.nomeRecebedor}
            </p>
          )}
          {e.comprovante?.dataHora && (
            <p className="mt-1 text-xs text-emerald-900/80">
              Registrado em: {new Date(e.comprovante.dataHora).toLocaleString('pt-BR')}
            </p>
          )}
          <img
            src={resolveAssetUrl(e.comprovante.fotoUrl)}
            alt="Foto da entrega"
            className="mt-3 max-h-72 w-full rounded-2xl border border-emerald-100 object-cover bg-white"
          />
        </section>
      )}

      {e.status !== 'EM_ENTREGA' && e.status !== 'ENTREGUE' && (
        <button
          type="button"
          disabled={iniciar.isPending}
          onClick={() => iniciar.mutate()}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Truck className="h-4 w-4" /> {iniciar.isPending ? 'Iniciando...' : 'Iniciar entrega'}
        </button>
      )}
      {e.status === 'EM_ENTREGA' && (
        <button
          type="button"
          onClick={() => navigate(`/entrega/${id}/confirmar`)}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-sm"
        >
          <CircleCheckBig className="h-4 w-4" /> Confirmar entrega
        </button>
      )}
    </div>
  )
}
