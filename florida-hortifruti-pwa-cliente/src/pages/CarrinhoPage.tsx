import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { lerCarrinho, salvarCarrinho, subtotal } from '../lib/cart'

export function CarrinhoPage() {
  const navigate = useNavigate()
  const [itens, setItens] = useState(lerCarrinho)
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState('')

  function persistir(prox: typeof itens) {
    setItens(prox)
    salvarCarrinho(prox)
    window.dispatchEvent(new Event('carrinho'))
  }

  function mudarQtd(id: string, delta: number) {
    persistir(
      itens
        .map((i) => (i.produtoId === id ? { ...i, quantidade: i.quantidade + delta } : i))
        .filter((i) => i.quantidade > 0),
    )
  }

  const enviar = useMutation({
    mutationFn: () =>
      api.post('/portal-cliente/pedidos', {
        observacoes: observacoes.trim() || undefined,
        itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
      }),
    onSuccess: () => {
      persistir([])
      navigate('/pedidos')
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível enviar o pedido.'))
    },
  })

  if (itens.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Seu carrinho está vazio.</p>
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-lg font-semibold">Carrinho</h1>
      {itens.map((i) => (
        <div key={i.produtoId} className="rounded-xl border bg-white p-3">
          <p className="font-medium">{i.nome}</p>
          <p className="text-xs text-gray-500">{i.unidadeVenda}</p>
          {i.preco != null && <p className="text-sm text-green-700">{formatBRL(i.preco)}</p>}
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => mudarQtd(i.produtoId, -1)}
              className="rounded-lg border p-1"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-6 text-center text-sm">{i.quantidade}</span>
            <button
              type="button"
              onClick={() => mudarQtd(i.produtoId, 1)}
              className="rounded-lg border p-1"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      <div className="rounded-xl bg-green-50 p-4">
        <p className="text-xs text-gray-500">Subtotal estimado</p>
        <p className="text-2xl font-bold text-green-800">{formatBRL(subtotal(itens))}</p>
        <p className="mt-1 text-xs text-gray-600">
          Valores sujeitos à confirmação no fechamento do pedido.
        </p>
      </div>
      <textarea
        value={observacoes}
        onChange={(e) => setObservacoes(e.target.value)}
        rows={2}
        placeholder="Observação (opcional)"
        className="w-full rounded-xl border px-3 py-2"
      />
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <button
        type="button"
        disabled={enviar.isPending}
        onClick={() => enviar.mutate()}
        className="w-full min-h-11 rounded-xl bg-green-600 text-white font-medium disabled:opacity-50"
      >
        {enviar.isPending ? 'Enviando...' : 'Fazer pedido'}
      </button>
    </div>
  )
}
