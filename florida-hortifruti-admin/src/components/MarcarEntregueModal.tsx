import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera } from 'lucide-react'
import { api } from '../lib/api'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input } from './ui/Input'

// Reduz a foto antes de enviar (celular tira fotos de vários MB)
async function comprimirFoto(file: File): Promise<string> {
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
    return canvas.toDataURL('image/jpeg', 0.62)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Entrega feita pelo supervisor: a foto é o comprovante (admin/administrativo confirmam sem foto)
export function MarcarEntregueModal({
  pedido,
  onClose,
  onEntregue,
}: {
  pedido: { id: string; numero: number } | null
  onClose: () => void
  onEntregue?: (pedidoAtualizado: any) => void
}) {
  const qc = useQueryClient()
  const [recebidoPor, setRecebidoPor] = useState('')
  const [observacao, setObservacao] = useState('')
  const [foto, setFoto] = useState('')
  const [erroFoto, setErroFoto] = useState('')

  function fechar() {
    setRecebidoPor('')
    setObservacao('')
    setFoto('')
    setErroFoto('')
    confirmar.reset()
    onClose()
  }

  const confirmar = useMutation({
    mutationFn: () =>
      api
        .post(`/pedidos/${pedido!.id}/entregue`, {
          recebidoPor: recebidoPor.trim() || undefined,
          observacaoEntrega: observacao.trim() || undefined,
          fotoEntrega: foto,
        })
        .then((r) => r.data),
    onSuccess: (atualizado) => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      onEntregue?.(atualizado)
      fechar()
    },
  })

  return (
    <Modal
      open={!!pedido}
      onClose={fechar}
      title={`Confirmar entrega · #${String(pedido?.numero ?? '').padStart(6, '0')}`}
      size="sm"
    >
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          A foto da entrega é obrigatória. Quem recebeu e observação são opcionais.
        </p>
        <Input
          label="Quem recebeu"
          value={recebidoPor}
          onChange={(e) => setRecebidoPor(e.target.value)}
          placeholder="Nome de quem pegou as caixas"
        />
        <Input
          label="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
        />
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4">
          <Camera className="h-6 w-6 text-gray-500" />
          <span className="text-sm text-gray-600">
            {foto ? 'Trocar foto' : 'Tirar ou enviar foto (obrigatório)'}
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                setFoto(await comprimirFoto(file))
                setErroFoto('')
              } catch {
                setErroFoto('Não foi possível ler a foto. Tente outra.')
              }
            }}
          />
        </label>
        {foto && (
          <img
            src={foto}
            alt="Foto da entrega"
            className="max-h-48 w-full rounded-lg object-cover"
          />
        )}
        {erroFoto && <p className="text-xs text-red-600">{erroFoto}</p>}
        {confirmar.isError && (
          <p className="text-xs text-red-600">
            {(confirmar.error as any)?.response?.data?.message ??
              'Não foi possível confirmar a entrega.'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={fechar}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!foto || confirmar.isPending}
            onClick={() => confirmar.mutate()}
          >
            {confirmar.isPending ? 'Confirmando...' : 'Confirmar entrega'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
