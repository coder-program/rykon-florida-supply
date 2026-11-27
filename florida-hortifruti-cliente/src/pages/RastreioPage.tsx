import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Circle, MapPin, Truck } from 'lucide-react'
import { api } from '../lib/api'
import { STATUS_COLOR, STATUS_LABEL } from '../lib/utils'
import logo from '../assets/logo.png'

type Ponto = { latitude: number; longitude: number }
type Rastreio = {
  numero: number
  status: string
  cliente: string
  entregueEm: string | null
  historicoStatus: { status: string; alteradoEm: string }[]
  motorista: { nome: string; posicao: (Ponto & { atualizadoEm: string }) | null } | null
  destino: Ponto | null
}

const ETAPAS = ['APROVADO', 'EM_SEPARACAO', 'PRONTO_PARA_ENTREGA', 'EM_ENTREGA', 'ENTREGUE']

function dataHora(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Mapa do OpenStreetMap embutido (sem biblioteca): enquadra motorista e destino
function urlMapa(motorista: Ponto, destino: Ponto | null) {
  const pts = destino ? [motorista, destino] : [motorista]
  const lats = pts.map((p) => p.latitude)
  const lons = pts.map((p) => p.longitude)
  const folga = 0.01
  const bbox = [
    Math.min(...lons) - folga,
    Math.min(...lats) - folga,
    Math.max(...lons) + folga,
    Math.max(...lats) + folga,
  ]
    .map((n) => Number(n.toFixed(5)))
    .join(',')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${motorista.latitude},${motorista.longitude}`
}

// Página pública (sem login): link enviado ao cliente pelo WhatsApp na aprovação do pedido
export function RastreioPage() {
  const { token } = useParams<{ token: string }>()
  const {
    data: r,
    isLoading,
    isError,
  } = useQuery<Rastreio>({
    queryKey: ['rastreio', token],
    queryFn: () => api.get(`/p/${token}/rastreio`).then((res) => res.data),
    // Com o motorista em rota, a posição é atualizada a cada 20 s
    refetchInterval: (q) => (q.state.data?.status === 'EM_ENTREGA' ? 20_000 : 60_000),
  })

  const posicao = r?.motorista?.posicao
  const indiceAtual = r ? ETAPAS.indexOf(r.status) : -1

  return (
    <div className="mx-auto min-h-dvh max-w-lg bg-gray-50">
      <header className="flex items-center gap-2.5 bg-forest-900 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cream p-1">
          <img src={logo} alt="" className="h-full w-auto" />
        </span>
        <span className="text-sm font-bold text-white">Florida Supply · Acompanhar pedido</span>
      </header>

      <main className="space-y-4 p-4">
        {isLoading ? (
          <p className="py-10 text-center text-sm text-gray-400">Carregando...</p>
        ) : isError || !r ? (
          <p className="py-10 text-center text-sm text-gray-500">
            Pedido não encontrado. Confira o link recebido.
          </p>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">{r.cliente}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-lg font-semibold text-gray-900">
                  Pedido #{String(r.numero).padStart(6, '0')}
                </p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLOR[r.status] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
            </section>

            {r.status === 'EM_ENTREGA' && (
              <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 p-4 pb-3">
                  <Truck className="h-4 w-4 text-emerald-700" />
                  <p className="text-sm font-semibold text-gray-900">
                    {r.motorista
                      ? `${r.motorista.nome} está a caminho`
                      : 'Seu pedido está a caminho'}
                  </p>
                </div>
                {posicao ? (
                  <>
                    <iframe
                      title="Posição do motorista"
                      src={urlMapa(posicao, r.destino)}
                      className="h-72 w-full border-0"
                      loading="lazy"
                    />
                    <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-gray-500">
                      <span>Atualizado às {dataHora(posicao.atualizadoEm).split(' ').at(-1)}</span>
                      <a
                        className="inline-flex items-center gap-1 font-semibold text-emerald-700"
                        href={`https://www.google.com/maps?q=${posicao.latitude},${posicao.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MapPin className="h-3.5 w-3.5" /> Abrir no mapa
                      </a>
                    </div>
                  </>
                ) : (
                  <p className="px-4 pb-4 text-xs text-gray-500">
                    A posição do motorista aparece aqui assim que ele estiver com o app aberto.
                  </p>
                )}
              </section>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">Andamento</p>
              <ol className="mt-4 space-y-4">
                {ETAPAS.map((etapa, i) => {
                  const registro = r.historicoStatus.find((h) => h.status === etapa)
                  const feito = !!registro || i <= indiceAtual
                  return (
                    <li key={etapa} className="flex gap-3">
                      {feito ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-gray-300" />
                      )}
                      <div>
                        <p
                          className={`text-sm font-semibold ${feito ? 'text-gray-900' : 'text-gray-400'}`}
                        >
                          {STATUS_LABEL[etapa] ?? etapa}
                        </p>
                        {registro && (
                          <p className="text-xs text-gray-500">{dataHora(registro.alteradoEm)}</p>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
