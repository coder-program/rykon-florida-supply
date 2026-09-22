import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser'
import { ArrowLeft, CircleCheckBig, QrCode } from 'lucide-react'
import { api } from '../lib/api'

export function ScannerPage() {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState<{ numero: number } | null>(null)

  const escanear = useMutation({
    mutationFn: (token: string) => api.post('/motorista/entregas/scan', { token }).then((r) => r.data),
    onSuccess: (pedido) => {
      controlsRef.current?.stop()
      setSucesso({ numero: pedido.numero })
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível confirmar a leitura.'))
    },
  })

  useEffect(() => {
    if (sucesso) return
    const video = videoRef.current
    if (!video) return

    setErro('')
    const reader = new BrowserQRCodeReader()

    void reader
      .decodeFromVideoDevice(undefined, video, (result, error) => {
        if (result) {
          const texto = result.getText().trim()
          if (texto && !escanear.isPending) {
            escanear.mutate(texto)
          }
          return
        }
        if (error && (error as Error).name !== 'NotFoundException') {
          setErro('Não foi possível ler o QR. Tente aproximar melhor a câmera.')
        }
      })
      .then((controls) => {
        controlsRef.current = controls
      })
      .catch(() => {
        setErro('Não foi possível abrir a câmera. Verifique a permissão no navegador.')
      })

    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sucesso])

  return (
    <div className="mx-auto min-h-dvh max-w-lg space-y-4 px-4 py-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Entregas
      </Link>

      <section className="overflow-hidden rounded-3xl bg-linear-to-br from-sky-700 via-cyan-600 to-emerald-400 p-5 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
            Escanear pedido
          </p>
        </div>
        <h1 className="mt-2 text-xl font-semibold leading-tight">Aponte para o QR da etiqueta</h1>
        <p className="mt-2 text-sm text-white/85">
          Ao ler o código, o pedido passa automaticamente para "A caminho".
        </p>
      </section>

      {sucesso ? (
        <section className="flex flex-col items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
          <CircleCheckBig className="h-10 w-10 text-emerald-600" />
          <p className="text-base font-semibold text-emerald-900">
            Pedido #{String(sucesso.numero).padStart(6, '0')} está a caminho
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-2 flex min-h-11 w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white"
          >
            Ver entregas
          </button>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-black shadow-sm">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        </section>
      )}

      {erro && (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>
      )}
    </div>
  )
}
