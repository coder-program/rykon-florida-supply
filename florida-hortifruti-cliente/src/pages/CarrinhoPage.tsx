import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Minus, NotebookText, Plus, ShoppingBasket, Wallet } from 'lucide-react'
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
    return (
      <div className="space-y-4 px-4 py-4">
        <section className="overflow-hidden rounded-[28px] bg-linear-to-br from-emerald-700 via-emerald-600 to-lime-400 p-5 text-white shadow-lg">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
            Carrinho
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-tight">Seu carrinho está vazio</h1>
          <p className="mt-2 text-sm text-white/85">
            Adicione produtos para montar um novo pedido e acompanhar tudo por aqui.
          </p>
        </section>

        <section className="rounded-3xl border border-dashed border-gray-300 bg-white px-5 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 text-gray-500">
            <ShoppingBasket className="h-6 w-6" />
          </div>
          <p className="mt-4 text-base font-semibold text-gray-900">Nenhum item no momento</p>
          <p className="mt-1 text-sm text-gray-500">
            Explore os produtos disponíveis e volte para finalizar seu pedido.
          </p>
          <Link
            to="/produtos"
            className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Ir para produtos
          </Link>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <section className="overflow-hidden rounded-[28px] bg-linear-to-br from-emerald-700 via-emerald-600 to-lime-400 p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/75">
              Carrinho
            </p>
            <h1 className="mt-2 text-2xl font-semibold leading-tight">Revise seu pedido</h1>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Ajuste quantidades, adicione observações e finalize quando estiver tudo certo.
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/18 backdrop-blur-sm">
            <ShoppingBasket className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Itens</p>
            <p className="mt-1 text-lg font-semibold">{itens.length}</p>
          </div>
          <div className="rounded-2xl bg-white/14 px-3 py-3 backdrop-blur-sm">
            <p className="text-[11px] uppercase tracking-wide text-white/70">Subtotal</p>
            <p className="mt-1 text-lg font-semibold">{formatBRL(subtotal(itens))}</p>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        {itens.map((i) => (
          <article
            key={i.produtoId}
            className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900">{i.nome}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                  {i.unidadeVenda}
                </p>
                {i.preco != null && (
                  <p className="mt-2 text-sm font-semibold text-emerald-700">
                    {formatBRL(i.preco)}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700/70">
                  Total
                </p>
                <p className="mt-1 text-sm font-semibold text-emerald-700">
                  {formatBRL((i.preco ?? 0) * i.quantidade)}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Quantidade
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => mudarQtd(i.produtoId, -1)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-8 text-center text-sm font-semibold text-gray-800">
                  {i.quantidade}
                </span>
                <button
                  type="button"
                  onClick={() => mudarQtd(i.produtoId, 1)}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-3xl border border-emerald-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Subtotal estimado
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">
              {formatBRL(subtotal(itens))}
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Valores sujeitos à confirmação no fechamento do pedido.
        </p>
      </section>

      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-100 text-gray-600">
            <NotebookText className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Observações do pedido</p>
            <p className="mt-1 text-xs text-gray-500">Use este campo para detalhes adicionais.</p>
          </div>
        </div>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={3}
          placeholder="Ex.: separar caixas menores, referência para entrega, horário ideal..."
          className="mt-4 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-400 focus:bg-white"
        />
      </section>

      {erro && <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      <div className="space-y-2">
        <button
          type="button"
          disabled={enviar.isPending}
          onClick={() => enviar.mutate()}
          className="w-full min-h-12 cursor-pointer rounded-2xl bg-emerald-600 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviar.isPending ? 'Enviando...' : 'Fazer pedido'}
        </button>
        <Link
          to="/produtos"
          className="flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700"
        >
          Continuar comprando
        </Link>
      </div>
    </div>
  )
}
