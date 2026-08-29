import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate, STATUS_LABEL, STATUS_COLOR } from '../lib/utils'

export function DetalhePedidoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: p, isLoading } = useQuery({
    queryKey: ['pedido', id],
    queryFn: () => api.get(`/pedidos/${id}`).then((r) => r.data),
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
        <button onClick={() => navigate('/')} className="text-green-600 font-medium text-sm">Voltar</button>
      </div>
    )
  }

  const status = p.status as string
  const subtotal = Number(p.subtotal ?? 0)
  const frete = Number(p.valorFrete ?? 0)
  const desconto = Number(p.descontoValor ?? 0)
  const total = Number(p.totalFinal ?? 0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Header */}
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
        <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_COLOR[status] ?? 'bg-gray-100 text-gray-700'}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">

        {/* Dados gerais */}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-sm space-y-2.5">
          <Row label="Cliente" value={p.cliente?.razaoSocialOuNome} bold />
          {p.vendedor && <Row label="Vendedor" value={p.vendedor?.nome} />}
          <Row label="Pagamento" value={p.formaPagamento} />
          {p.dataVencimento && <Row label="Vencimento" value={formatDate(p.dataVencimento)} />}
          {p.condicaoNegociada && <Row label="Condição" value={p.condicaoNegociada} />}
          <Row label="Nota Fiscal" value={p.necessitaNF ? '✅ Sim' : 'Não'} />
          {p.observacoes && (
            <div className="pt-2 border-t border-gray-100">
              <p className="text-gray-400 text-xs mb-1">Observações</p>
              <p className="text-gray-700">{p.observacoes}</p>
            </div>
          )}
        </div>

        {/* Itens */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500">PRODUTOS</p>
          </div>
          {(p.itens ?? []).map((item: any) => (
            <div key={item.id} className="px-4 py-3 border-b border-gray-50 text-sm last:border-b-0">
              <div className="flex justify-between items-start gap-2">
                <span className="font-medium text-gray-900 flex-1">{item.produto?.nome}</span>
                <span className="font-semibold shrink-0">{formatBRL(item.valorTotal)}</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {Number(item.quantidade).toFixed(0)} cx × {formatBRL(item.valorUnitario)}
              </p>
            </div>
          ))}

          {/* Totais */}
          <div className="px-4 pt-3 pb-4 space-y-1.5 text-sm border-t border-gray-100">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span><span>{formatBRL(subtotal)}</span>
            </div>
            {frete > 0 && (
              <div className="flex justify-between text-gray-500">
                <span>Frete{p.freteInclusoNoPreco ? ' (incluso)' : ''}</span>
                <span>+{formatBRL(frete)}</span>
              </div>
            )}
            {desconto > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Desconto</span><span>-{formatBRL(desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
              <span>Total</span>
              <span className="text-green-700">{formatBRL(total)}</span>
            </div>
          </div>
        </div>

        {/* Etiqueta QR (caso aprovado) */}
        {p.etiqueta && (
          <div className="bg-white rounded-xl border border-gray-100 p-4 text-center space-y-2">
            <p className="text-xs font-semibold text-gray-500">ETIQUETA / QR CODE</p>
            <img
              src={p.etiqueta.qrCodeUrl ?? `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(p.etiqueta.codigo ?? p.id)}`}
              alt="QR Code do pedido"
              className="w-32 h-32 mx-auto rounded-lg"
            />
            <p className="font-mono text-xs text-gray-500">{p.etiqueta.codigo ?? '—'}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, bold }: { label: string; value?: string; bold?: boolean }) {
  if (!value) return null
  return (
    <div className="flex justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`text-right ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</span>
    </div>
  )
}
