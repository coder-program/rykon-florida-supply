import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MapPin, MapPinOff } from 'lucide-react'
import { api } from '../lib/api'

// Envia no máximo uma posição a cada 15 s (ou antes, se andou bastante)
const INTERVALO_MS = 15_000
const DISTANCIA_MINIMA_M = 50

type Estado = 'iniciando' | 'ativa' | 'negada' | 'indisponivel'

function distanciaMetros(a: GeolocationCoordinates, b: GeolocationCoordinates) {
  const rad = (g: number) => (g * Math.PI) / 180
  const dLat = rad(b.latitude - a.latitude)
  const dLng = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

/**
 * Manda a posição do celular para o acompanhamento das entregas no painel. Só funciona com o
 * app aberto na tela (é um app de navegador); com entrega a caminho, mantém a tela acesa.
 */
export function Localizacao() {
  const [estado, setEstado] = useState<Estado>(() =>
    'geolocation' in navigator ? 'iniciando' : 'indisponivel',
  )
  const ultimoEnvio = useRef<{ em: number; coords: GeolocationCoordinates } | null>(null)

  // Mesmo cache da lista de entregas: só para saber se há entrega a caminho
  const { data: entregas = [] } = useQuery({
    queryKey: ['motorista-entregas'],
    queryFn: () => api.get('/motorista/entregas').then((r) => r.data),
    refetchInterval: 10_000,
  })
  const aCaminho = (entregas as any[]).some((e) => e.status === 'EM_ENTREGA')

  useEffect(() => {
    if (!('geolocation' in navigator)) return
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setEstado('ativa')
        const anterior = ultimoEnvio.current
        const agora = Date.now()
        const andou = anterior ? distanciaMetros(anterior.coords, pos.coords) : Infinity
        if (anterior && agora - anterior.em < INTERVALO_MS && andou < DISTANCIA_MINIMA_M) return
        ultimoEnvio.current = { em: agora, coords: pos.coords }
        void api
          .post('/motorista/entregas/localizacao', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            precisao: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : undefined,
          })
          .catch(() => {
            // Sem rede: tenta de novo na próxima posição
            ultimoEnvio.current = null
          })
      },
      (erro) => setEstado(erro.code === erro.PERMISSION_DENIED ? 'negada' : 'indisponivel'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [])

  // Tela acesa enquanto há entrega a caminho (o navegador para o GPS com a tela apagada)
  useEffect(() => {
    if (!aCaminho || !('wakeLock' in navigator)) return
    let trava: WakeLockSentinel | null = null
    let ativo = true
    const pedir = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        trava = await navigator.wakeLock.request('screen')
      } catch {
        trava = null
      }
      if (!ativo) void trava?.release()
    }
    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void pedir()
    }
    void pedir()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      ativo = false
      document.removeEventListener('visibilitychange', aoVoltar)
      void trava?.release()
    }
  }, [aCaminho])

  if (estado === 'iniciando') return null

  const ok = estado === 'ativa'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 flex justify-center px-4">
      <div
        className={`pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg ${
          ok ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900'
        }`}
      >
        {ok ? <MapPin className="h-3.5 w-3.5" /> : <MapPinOff className="h-3.5 w-3.5" />}
        {ok
          ? aCaminho
            ? 'Localização ativa · deixe o app aberto na rota'
            : 'Localização ativa'
          : estado === 'negada'
            ? 'Localização bloqueada: permita nas configurações do navegador'
            : 'Localização indisponível neste aparelho'}
      </div>
    </div>
  )
}
