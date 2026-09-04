import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { api } from '../lib/api'

async function comprimirFoto(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = url
    })
    const max = 960
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale)
    canvas.height = Math.round(img.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.7),
    )
    if (!blob) throw new Error('foto')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ConfirmarPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [nomeRecebedor, setNomeRecebedor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [foto, setFoto] = useState<Blob | null>(null)
  const [preview, setPreview] = useState('')
  const [erro, setErro] = useState('')
  const agora = new Date().toLocaleString('pt-BR')

  const confirmar = useMutation({
    mutationFn: async () => {
      if (!foto) throw new Error('Tire a foto da entrega')
      const body = new FormData()
      body.append('nomeRecebedor', nomeRecebedor.trim())
      if (observacao.trim()) body.append('observacao', observacao.trim())
      body.append('foto', foto, 'entrega.jpg')
      if (navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 }),
          )
          body.append('latitude', String(pos.coords.latitude))
          body.append('longitude', String(pos.coords.longitude))
        } catch {
          /* GPS opcional */
        }
      }
      return api.post(`/motorista/entregas/${id}/confirmar`, body)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['motorista-entregas'] })
      navigate('/')
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message ?? e.message
      setErro(Array.isArray(msg) ? msg.join(' ') : msg)
    },
  })

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 py-4 space-y-4">
      <Link to={`/entrega/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="text-lg font-semibold">Confirmar entrega</h1>
      <label className="block text-sm">
        Quem recebeu
        <input
          value={nomeRecebedor}
          onChange={(e) => setNomeRecebedor(e.target.value)}
          className="mt-1 w-full min-h-11 rounded-xl border px-3"
          required
        />
      </label>
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed bg-gray-50 px-3 py-6">
        <Camera className="h-6 w-6 text-gray-500" />
        <span className="text-sm text-gray-600">{preview ? 'Trocar foto' : 'Tirar foto'}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            try {
              const blob = await comprimirFoto(file)
              setFoto(blob)
              setPreview(URL.createObjectURL(blob))
            } catch {
              setErro('Não foi possível ler a foto.')
            }
          }}
        />
      </label>
      {preview && (
        <img src={preview} alt="Prévia" className="max-h-48 w-full rounded-xl object-cover" />
      )}
      <p className="text-xs text-gray-500">Data/hora: {agora} (registrada pelo servidor)</p>
      <textarea
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        rows={2}
        placeholder="Observação (opcional)"
        className="w-full rounded-xl border px-3 py-2"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="button"
        disabled={confirmar.isPending || !nomeRecebedor.trim() || !foto}
        onClick={() => confirmar.mutate()}
        className="w-full min-h-11 rounded-xl bg-green-600 text-white font-medium disabled:opacity-50"
      >
        {confirmar.isPending ? 'Enviando...' : 'Confirmar entrega'}
      </button>
    </div>
  )
}
