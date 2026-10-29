import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ArrowDown, ArrowUp, CheckCircle2, MapPinOff, Navigation, Truck } from 'lucide-react'
import { api } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'

type Parada = {
  id: string
  numero: number
  status: string
  cliente: string
  endereco: string
  latitude: number | null
  longitude: number | null
  ordemRota: number | null
  entregueEm: string | null
}

type Rota = {
  motorista: { id: string; nome: string }
  localizacao: {
    latitude: number
    longitude: number
    precisao: number | null
    atualizadoEm: string
  } | null
  emEntrega: Parada | null
  proximos: Parada[]
  entregues: Parada[]
  total: number
  concluidas: number
}

// Centro inicial do mapa quando ainda não há nenhum ponto (São Paulo)
const CENTRO_PADRAO: L.LatLngExpression = [-23.55, -46.63]
const CORES = ['#0e7490', '#c2410c', '#7c3aed', '#15803d', '#be123c', '#1d4ed8']

function numeroPedido(n: number) {
  return `#${String(n).padStart(6, '0')}`
}

function haQuanto(data: string) {
  const min = Math.round((Date.now() - new Date(data).getTime()) / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  return `há ${h}h${String(min % 60).padStart(2, '0')}`
}

// Posição com mais de 5 min: o app do motorista provavelmente está fechado
function posicaoVelha(data: string) {
  return Date.now() - new Date(data).getTime() > 5 * 60_000
}

function iconeMotorista(nome: string, cor: string, velho: boolean) {
  const iniciais = nome
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div style="width:36px;height:36px;border-radius:9999px;background:${cor};opacity:${velho ? 0.5 : 1};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:600 12px system-ui">${iniciais}</div>`,
  })
}

function iconeParada(rotulo: string, cor: string, entregue: boolean) {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:${entregue ? '#9ca3af' : '#fff'};border:2px solid ${entregue ? '#9ca3af' : cor};display:flex;align-items:center;justify-content:center;color:${entregue ? '#fff' : cor};font:700 11px system-ui">${rotulo}</div>`,
  })
}

function escapar(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

// Acompanhamento das rotas dos motoristas em tempo real (posição enviada pelo app aberto)
export function AcompanhamentoEntregasPage() {
  const qc = useQueryClient()
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const mapaRef = useRef<HTMLDivElement | null>(null)
  const mapa = useRef<L.Map | null>(null)
  const camada = useRef<L.LayerGroup | null>(null)
  const enquadrado = useRef<string | null>(null)

  const { data: rotas = [], isLoading } = useQuery<Rota[]>({
    queryKey: ['acompanhamento-entregas'],
    queryFn: () => api.get('/entregas/acompanhamento').then((r) => r.data),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  })

  const cores = useMemo(
    () => new Map(rotas.map((r, i) => [r.motorista.id, CORES[i % CORES.length]])),
    [rotas],
  )

  const ordenar = useMutation({
    mutationFn: (pedidoIds: string[]) => api.put('/entregas/ordem', { pedidoIds }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['acompanhamento-entregas'] }),
  })

  function mover(rota: Rota, indice: number, direcao: -1 | 1) {
    const ids = rota.proximos.map((p) => p.id)
    const destino = indice + direcao
    if (destino < 0 || destino >= ids.length) return
    ;[ids[indice], ids[destino]] = [ids[destino], ids[indice]]
    // Mostra a nova ordem na hora; a lista volta do servidor em seguida
    qc.setQueryData<Rota[]>(['acompanhamento-entregas'], (atual) =>
      atual?.map((r) =>
        r.motorista.id === rota.motorista.id
          ? { ...r, proximos: ids.map((id) => r.proximos.find((p) => p.id === id)!) }
          : r,
      ),
    )
    ordenar.mutate(ids)
  }

  useEffect(() => {
    if (!mapaRef.current || mapa.current) return
    mapa.current = L.map(mapaRef.current, { zoomControl: true }).setView(CENTRO_PADRAO, 11)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapa.current)
    camada.current = L.layerGroup().addTo(mapa.current)
    return () => {
      mapa.current?.remove()
      mapa.current = null
    }
  }, [])

  // Redesenha motoristas, paradas e o trajeto previsto a cada atualização
  useEffect(() => {
    const grupo = camada.current
    if (!grupo || !mapa.current) return
    grupo.clearLayers()
    const pontos: L.LatLngExpression[] = []
    const visiveis = selecionado ? rotas.filter((r) => r.motorista.id === selecionado) : rotas

    for (const rota of visiveis) {
      const cor = cores.get(rota.motorista.id) ?? CORES[0]
      const trajeto: L.LatLngExpression[] = []
      if (rota.localizacao) {
        const pos: L.LatLngExpression = [rota.localizacao.latitude, rota.localizacao.longitude]
        trajeto.push(pos)
        pontos.push(pos)
        L.marker(pos, {
          icon: iconeMotorista(
            rota.motorista.nome,
            cor,
            posicaoVelha(rota.localizacao.atualizadoEm),
          ),
          zIndexOffset: 1000,
        })
          .bindTooltip(
            `<b>${escapar(rota.motorista.nome)}</b><br/>${haQuanto(rota.localizacao.atualizadoEm)}`,
          )
          .on('click', () => setSelecionado(rota.motorista.id))
          .addTo(grupo)
      }
      const pendentes = [rota.emEntrega, ...rota.proximos].filter((p): p is Parada => !!p)
      pendentes.forEach((p, i) => {
        if (p.latitude == null || p.longitude == null) return
        const pos: L.LatLngExpression = [p.latitude, p.longitude]
        trajeto.push(pos)
        pontos.push(pos)
        L.marker(pos, { icon: iconeParada(String(i + 1), cor, false) })
          .bindTooltip(
            `<b>${i + 1}. ${escapar(p.cliente)}</b> ${numeroPedido(p.numero)}<br/>${escapar(p.endereco)}${p.status === 'EM_ENTREGA' ? '<br/><i>A caminho agora</i>' : ''}`,
          )
          .addTo(grupo)
      })
      if (selecionado) {
        rota.entregues.forEach((p) => {
          if (p.latitude == null || p.longitude == null) return
          L.marker([p.latitude, p.longitude], { icon: iconeParada('✓', cor, true) })
            .bindTooltip(`<b>${escapar(p.cliente)}</b> · entregue`)
            .addTo(grupo)
        })
      }
      if (trajeto.length > 1) {
        L.polyline(trajeto, { color: cor, weight: 3, opacity: 0.7, dashArray: '6 8' }).addTo(grupo)
      }
    }

    // Enquadra o mapa ao abrir e ao trocar de motorista (não a cada atualização)
    const chave = selecionado ?? 'todos'
    if (pontos.length && enquadrado.current !== chave) {
      mapa.current.fitBounds(L.latLngBounds(pontos), { padding: [40, 40], maxZoom: 15 })
      enquadrado.current = chave
    }
  }, [rotas, selecionado, cores])

  const semPosicao = rotas.filter((r) => !r.localizacao).length
  const paradasSemPonto = rotas.reduce(
    (acc, r) =>
      acc +
      [r.emEntrega, ...r.proximos].filter((p) => p && (p.latitude == null || p.longitude == null))
        .length,
    0,
  )

  return (
    <div>
      <PageHeader
        title="Acompanhar entregas"
        subtitle="Posição dos motoristas e andamento das rotas · atualiza a cada 15 s"
      />
      <div className="grid gap-4 p-4 md:p-6 lg:grid-cols-[380px_1fr]">
        <div className="order-2 space-y-3 lg:order-1 lg:max-h-[calc(100vh-170px)] lg:overflow-y-auto lg:pr-1">
          {selecionado && (
            <button
              type="button"
              onClick={() => setSelecionado(null)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700"
            >
              Ver todos os motoristas
            </button>
          )}
          {isLoading && (
            <p className="brand-loading py-8 text-center text-sm text-gray-400">Carregando...</p>
          )}
          {!isLoading && rotas.length === 0 && (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
              <Truck className="mx-auto mb-2 h-6 w-6 text-gray-400" />
              Nenhuma entrega atribuída hoje.
            </div>
          )}
          {rotas.map((rota) => {
            const cor = cores.get(rota.motorista.id)
            const ativo = selecionado === rota.motorista.id
            const pct = rota.total ? Math.round((rota.concluidas / rota.total) * 100) : 0
            return (
              <div
                key={rota.motorista.id}
                className={`rounded-xl border bg-white p-4 ${ativo ? 'border-green-500 ring-2 ring-green-100' : 'border-gray-200'}`}
              >
                <button
                  type="button"
                  onClick={() => setSelecionado(ativo ? null : rota.motorista.id)}
                  className="flex w-full items-start justify-between gap-2 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: cor }} />
                    <div>
                      <p className="font-semibold text-gray-900">{rota.motorista.nome}</p>
                      <p
                        className={`text-xs ${
                          !rota.localizacao
                            ? 'text-gray-400'
                            : posicaoVelha(rota.localizacao.atualizadoEm)
                              ? 'text-amber-700'
                              : 'text-green-700'
                        }`}
                      >
                        {rota.localizacao
                          ? `Posição ${haQuanto(rota.localizacao.atualizadoEm)}`
                          : 'Sem posição (app fechado ou sem permissão)'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-gray-700">
                    {rota.concluidas}/{rota.total}
                  </span>
                </button>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-green-600" style={{ width: `${pct}%` }} />
                </div>

                {rota.emEntrega ? (
                  <div className="mt-3 rounded-lg bg-cyan-50 px-3 py-2">
                    <p className="flex items-center gap-1 text-xs font-semibold text-cyan-800">
                      <Navigation className="h-3.5 w-3.5" /> Entregando agora
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-gray-900">
                      {rota.emEntrega.cliente}{' '}
                      <span className="text-xs text-gray-500">
                        {numeroPedido(rota.emEntrega.numero)}
                      </span>
                    </p>
                    <p className="text-xs text-gray-600">{rota.emEntrega.endereco || '—'}</p>
                  </div>
                ) : (
                  rota.total > rota.concluidas && (
                    <p className="mt-3 text-xs text-gray-500">Nenhum pedido a caminho agora.</p>
                  )
                )}

                {rota.proximos.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold text-gray-500">PRÓXIMOS</p>
                    <ol className="space-y-1">
                      {rota.proximos.map((p, i) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-2 rounded-lg bg-gray-50 px-2 py-1.5"
                        >
                          <span className="w-5 text-center text-xs font-bold text-gray-500">
                            {i + (rota.emEntrega ? 2 : 1)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-gray-900">
                              {p.cliente}{' '}
                              <span className="text-xs text-gray-400">
                                {numeroPedido(p.numero)}
                              </span>
                            </p>
                            <p className="flex items-center gap-1 truncate text-xs text-gray-500">
                              {(p.latitude == null || p.longitude == null) && (
                                <MapPinOff
                                  className="h-3 w-3 shrink-0 text-amber-600"
                                  aria-label="Endereço sem ponto no mapa"
                                />
                              )}
                              {p.endereco || 'Sem endereço'}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col">
                            <button
                              type="button"
                              onClick={() => mover(rota, i, -1)}
                              disabled={i === 0 || ordenar.isPending}
                              className="rounded p-0.5 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                              aria-label="Subir na rota"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => mover(rota, i, 1)}
                              disabled={i === rota.proximos.length - 1 || ordenar.isPending}
                              className="rounded p-0.5 text-gray-500 hover:bg-gray-200 disabled:opacity-30"
                              aria-label="Descer na rota"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {rota.entregues.length > 0 && (
                  <p className="mt-3 flex items-center gap-1 text-xs text-gray-500">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    {rota.entregues.length} entregue(s) hoje
                    {rota.entregues[0]?.entregueEm
                      ? ` · última ${haQuanto(rota.entregues[0].entregueEm)}`
                      : ''}
                  </p>
                )}
              </div>
            )
          })}
          {ordenar.isError && (
            <p className="text-xs text-red-600">Não foi possível salvar a nova ordem.</p>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <div
            ref={mapaRef}
            className="relative z-0 h-80 w-full overflow-hidden rounded-xl border border-gray-200 lg:h-[calc(100vh-170px)]"
          />
          {(semPosicao > 0 || paradasSemPonto > 0) && (
            <p className="mt-2 text-xs text-gray-500">
              {semPosicao > 0 &&
                `${semPosicao} motorista(s) sem posição: a posição só chega com o app do motorista aberto e a localização permitida. `}
              {paradasSemPonto > 0 &&
                `${paradasSemPonto} parada(s) ainda sem ponto no mapa (o endereço é localizado aos poucos; se não aparecer, confira o endereço do cliente).`}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
