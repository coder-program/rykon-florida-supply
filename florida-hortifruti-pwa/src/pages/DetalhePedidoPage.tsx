import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Camera, Minus, Plus, X } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate, statusPedidoVisivel } from '../lib/utils'

const STATUS_PODE_SOLICITAR = ['APROVADO', 'SEPARACAO_ENTREGA']

const SOLIC_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  NEGADA: 'Negada',
}

const SOLIC_COLOR: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  APROVADA: 'bg-green-100 text-green-700',
  NEGADA: 'bg-red-100 text-red-700',
}

type ItemEdit = {
  produtoId: string
  nome: string
  quantidade: number
  valorUnitario: number
  original: number
}

export function DetalhePedidoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [itens, setItens] = useState<ItemEdit[]>([])
  const [erro, setErro] = useState('')
  const [modalEntrega, setModalEntrega] = useState(false)
  const [recebidoPor, setRecebidoPor] = useState('')
  const [observacaoEntrega, setObservacaoEntrega] = useState('')
  const [fotoEntrega, setFotoEntrega] = useState('')

  const { data: p, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`).then((r) => r.data),
  })

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => r.data),
    enabled: !!p && STATUS_PODE_SOLICITAR.includes(p.status),
  })

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-pedido', id],
    queryFn: () => api.get(`/pedidos/${id}/solicitacoes-alteracao`).then((r) => r.data),
    enabled: !!id && !!p,
    refetchInterval: (query) =>
      (query.state.data as any[] | undefined)?.some((s) => s.status === 'PENDENTE') ? 10000 : false,
  })

  useEffect(() => {
    if (!p?.itens) return
    setItens(
      p.itens.map((item: any) => ({
        produtoId: item.produtoId,
        nome: item.produto?.nome ?? '',
        quantidade: Math.max(1, Math.round(Number(item.quantidade) || 0)),
        valorUnitario: Number(item.valorUnitario),
        original: Math.max(1, Math.round(Number(item.quantidade) || 0)),
      })),
    )
    setErro('')
  }, [p])

  const marcarEntregue = useMutation({
    mutationFn: () =>
      api.post(`/pedidos/${id}/entregue`, {
        recebidoPor: recebidoPor.trim() || undefined,
        observacaoEntrega: observacaoEntrega.trim() || undefined,
        fotoEntrega: fotoEntrega || undefined,
      }),
    onSuccess: (res) => {
      const atualizado = res.data
      qc.setQueryData(['pedido', id], atualizado)
      qc.setQueryData(['meus-pedidos'], (lista: any[] | undefined) =>
        Array.isArray(lista)
          ? lista.map((item) => (item.id === atualizado?.id ? { ...item, ...atualizado } : item))
          : lista,
      )
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      qc.invalidateQueries({ queryKey: ['meus-pedidos'] })
      qc.invalidateQueries({ queryKey: ['pedido', id] })
      setModalEntrega(false)
      setRecebidoPor('')
      setObservacaoEntrega('')
      setFotoEntrega('')
      setErro('')
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(
        Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível marcar como entregue.'),
      )
    },
  })

  const solicitar = useMutation({
    mutationFn: () =>
      api.post(`/pedidos/${id}/solicitacoes-alteracao`, {
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-pedido', id] })
      setErro('')
      setItens((lista) => lista.map((i) => ({ ...i, quantidade: i.original })))
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(
        Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível enviar a solicitação.'),
      )
    },
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!p) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <p className="text-4xl">📦</p>
        <p className="text-gray-500 text-sm">Pedido não encontrado.</p>
        <button onClick={() => navigate('/')} className="text-green-600 font-medium text-sm">
          Voltar
        </button>
      </div>
    )
  }

  const status = p.status as string
  const podeSolicitar = STATUS_PODE_SOLICITAR.includes(status)
  const podeEntregar = ['APROVADO', 'SEPARACAO_ENTREGA'].includes(status)
  const pendente =
    (solicitacoes as any[]).some((s) => s.status === 'PENDENTE') || !!p.aguardandoAlteracao
  const jaBaixou = podeSolicitar
  const alterou = itens.some((i) => i.quantidade !== i.original)
  const subtotal = Number(p.subtotal ?? 0)
  const frete = Number(p.valorFrete ?? 0)
  const desconto = Number(p.descontoValor ?? 0)
  const total = Number(p.totalFinal ?? 0)
  const previewSubtotal = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)

  function estoqueLivre(produtoId: string) {
    const prod = produtos.find((x: any) => x.id === produtoId)
    return Number(prod?.estoqueAtual ?? 0)
  }

  function maxQtd(item: ItemEdit) {
    const livre = estoqueLivre(item.produtoId)
    return jaBaixou ? livre + item.original : livre
  }

  function alterar(produtoId: string, delta: number) {
    setErro('')
    setItens((lista) =>
      lista.map((item) => {
        if (item.produtoId !== produtoId) return item
        const proxima = item.quantidade + delta
        if (proxima < 1) return item
        if (delta > 0 && proxima > maxQtd(item)) return item
        return { ...item, quantidade: proxima }
      }),
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      <div className="bg-green-600 px-4 pt-10 pb-5">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => navigate('/')}
            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-white font-bold leading-tight">
              Pedido #{String(p.numero).padStart(6, '0')}
            </h1>
            <p className="text-green-300 text-xs">{formatDate(p.data)}</p>
          </div>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full font-medium ${statusPedidoVisivel({ status, aguardandoAlteracao: pendente || p.aguardandoAlteracao }).className}`}
        >
          {
            statusPedidoVisivel({ status, aguardandoAlteracao: pendente || p.aguardandoAlteracao })
              .label
          }
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm space-y-2.5">
          <Row label="Cliente" value={p.cliente?.razaoSocialOuNome} bold />
          {p.vendedor && <Row label="Vendedor" value={p.vendedor?.nome} />}
          <Row label="Pagamento" value={p.formaPagamento} />
          {p.dataVencimento && <Row label="Vencimento" value={formatDate(p.dataVencimento)} />}
          {p.observacoes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-gray-400 text-xs mb-1">Observações</p>
              <p className="text-gray-700">{p.observacoes}</p>
            </div>
          )}
        </div>

        {(p.entregueEm || p.recebidoPor || p.fotoEntrega || p.observacaoEntrega) && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
            <p className="text-xs font-semibold text-gray-500">COMPROVANTE DE ENTREGA</p>
            {p.entregueEm && <Row label="Quando" value={formatDate(p.entregueEm)} />}
            {p.recebidoPor && <Row label="Recebido por" value={p.recebidoPor} />}
            {p.observacaoEntrega && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-gray-400 text-xs mb-1">Observação</p>
                <p className="text-gray-700">{p.observacaoEntrega}</p>
              </div>
            )}
            {p.fotoEntrega && (
              <img
                src={p.fotoEntrega}
                alt="Foto da entrega"
                className="mt-2 w-full rounded-lg border border-gray-100"
              />
            )}
          </div>
        )}

        {(solicitacoes as any[]).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500">SOLICITAÇÕES DE ALTERAÇÃO</p>
            </div>
            {(solicitacoes as any[]).map((s) => (
              <div key={s.id} className="px-4 py-3 border-b border-gray-50 last:border-b-0 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-gray-800">
                    {s.quantidadeOriginal} cx → {s.quantidadeSolicitada} cx
                  </p>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOLIC_COLOR[s.status]}`}
                  >
                    {SOLIC_LABEL[s.status]}
                  </span>
                </div>
                {s.status === 'NEGADA' && s.resposta && (
                  <p className="text-xs text-red-600 mt-1">Motivo: {s.resposta}</p>
                )}
                {s.status === 'APROVADA' && (
                  <p className="text-xs text-green-700 mt-1">
                    Pedido atualizado com a nova quantidade.
                  </p>
                )}
                {s.status === 'PENDENTE' && (
                  <p className="text-xs text-amber-700 mt-1">Aguardando o administrador.</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500">PRODUTOS</p>
            {podeSolicitar && (
              <p className="text-xs text-gray-400 mt-0.5">
                Se o cliente mudar a quantidade, solicite a alteração. O admin aprova ou nega.
              </p>
            )}
          </div>
          {(podeSolicitar ? itens : (p.itens ?? [])).map((item: any) => {
            const edit = podeSolicitar ? (item as ItemEdit) : null
            const qtd = edit ? edit.quantidade : Math.round(Number(item.quantidade))
            const unit = edit ? edit.valorUnitario : Number(item.valorUnitario)
            const nome = edit ? edit.nome : item.produto?.nome
            const noLimite = edit ? qtd >= maxQtd(edit) : false
            return (
              <div
                key={edit?.produtoId ?? item.id}
                className="px-4 py-3 border-b border-gray-50 text-sm last:border-b-0"
              >
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium text-gray-900 flex-1">{nome}</span>
                  <span className="font-semibold shrink-0">{formatBRL(qtd * unit)}</span>
                </div>
                {edit && !pendente ? (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">{formatBRL(unit)} / cx</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => alterar(edit.produtoId, -1)}
                        disabled={qtd <= 1}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-semibold">{qtd}</span>
                      <button
                        type="button"
                        onClick={() => alterar(edit.produtoId, 1)}
                        disabled={noLimite}
                        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center disabled:opacity-40"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {qtd} cx × {formatBRL(unit)}
                  </p>
                )}
              </div>
            )
          })}

          <div className="px-4 pt-3 pb-4 space-y-1.5 text-sm border-t border-gray-100">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>{formatBRL(alterou ? previewSubtotal : subtotal)}</span>
            </div>
            {frete > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Frete</span>
                <span>+{formatBRL(frete)}</span>
              </div>
            )}
            {desconto > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Desconto</span>
                <span>-{formatBRL(desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-green-700">
                {formatBRL(alterou ? previewSubtotal + frete - desconto : total)}
              </span>
            </div>
          </div>
        </div>

        {(podeSolicitar || podeEntregar) && (
          <div className="space-y-2">
            {erro && <p className="text-xs text-red-600">{erro}</p>}
            {podeSolicitar && !pendente && (
              <button
                type="button"
                disabled={!alterou || solicitar.isPending}
                onClick={() => solicitar.mutate()}
                className="w-full min-h-11 rounded-xl border border-green-600 text-green-700 text-sm font-medium disabled:opacity-50"
              >
                {solicitar.isPending ? 'Enviando...' : 'Solicitar alteração'}
              </button>
            )}
            {podeEntregar && !pendente && (
              <button
                type="button"
                disabled={alterou}
                onClick={() => {
                  setErro('')
                  setModalEntrega(true)
                }}
                className="w-full min-h-11 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50"
              >
                Marcar como entregue
              </button>
            )}
            {pendente && (
              <p className="text-xs text-amber-700">
                Aguarde o administrador aprovar ou negar a alteração para marcar a entrega.
              </p>
            )}
          </div>
        )}
      </div>

      {modalEntrega && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/40">
          <div className="w-full max-w-lg rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900">Confirmar entrega</p>
              <button
                type="button"
                onClick={() => setModalEntrega(false)}
                className="p-2 text-gray-400"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Foto, quem recebeu e observação são opcionais.
            </p>
            <label className="block mb-3">
              <span className="text-xs font-medium text-gray-600">Quem recebeu</span>
              <input
                value={recebidoPor}
                onChange={(e) => setRecebidoPor(e.target.value)}
                className="mt-1 w-full min-h-11 rounded-lg border border-gray-300 px-3 text-sm"
                placeholder="Nome de quem pegou as caixas"
              />
            </label>
            <label className="block mb-3">
              <span className="text-xs font-medium text-gray-600">Observação</span>
              <textarea
                value={observacaoEntrega}
                onChange={(e) => setObservacaoEntrega(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Ex.: deixei na porta, cliente pediu para deixar no fundo"
              />
            </label>
            <label className="mb-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-4">
              <Camera className="w-6 h-6 text-gray-500" />
              <span className="text-sm text-gray-600">
                {fotoEntrega ? 'Trocar foto' : 'Tirar ou enviar foto (opcional)'}
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
                    setFotoEntrega(await comprimirFoto(file))
                  } catch {
                    setErro('Não foi possível ler a foto.')
                  }
                }}
              />
            </label>
            {fotoEntrega && (
              <img
                src={fotoEntrega}
                alt="Prévia"
                className="mb-3 max-h-48 w-full rounded-lg object-cover"
              />
            )}
            <button
              type="button"
              disabled={marcarEntregue.isPending}
              onClick={() => marcarEntregue.mutate()}
              className="w-full min-h-11 rounded-xl bg-green-600 text-white text-sm font-medium disabled:opacity-50"
            >
              {marcarEntregue.isPending ? 'Confirmando...' : 'Confirmar entrega'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

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

function Row({ label, value, bold }: { label: string; value?: string; bold?: boolean }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
        {value}
      </span>
    </div>
  )
}
