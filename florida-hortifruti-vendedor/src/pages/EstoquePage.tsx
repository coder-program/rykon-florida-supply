import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { api } from '../lib/api'

type Produto = { id: string; nome: string; unidadeVenda?: string; ativo?: boolean }
type Lote = {
  id: string
  produtoId: string
  numero: string
  dataEntrada: string
  quantidadeDisponivel: number
}

function rotuloLote(lote: Lote) {
  const dia = new Date(lote.dataEntrada).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
  return `${dia} - lote ${lote.numero}`
}

// Caixas disponíveis para pedido, por produto e lote (sem custo nem preço da Flórida)
export function EstoquePage() {
  const { data: produtos = [], isLoading: carregandoProdutos } = useQuery<Produto[]>({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })
  const { data: lotes = [], isLoading: carregandoLotes } = useQuery<Lote[]>({
    queryKey: ['lotes-disponiveis'],
    queryFn: () =>
      api.get('/estoque/lotes/disponiveis').then((r) => (Array.isArray(r.data) ? r.data : [])),
    refetchInterval: 60_000,
  })

  const linhas = useMemo(
    () =>
      produtos
        .map((p) => {
          const doProduto = lotes.filter((l) => l.produtoId === p.id)
          const total = doProduto.reduce((acc, l) => acc + Number(l.quantidadeDisponivel), 0)
          return { produto: p, lotes: doProduto, total }
        })
        .sort((a, b) => b.total - a.total || a.produto.nome.localeCompare(b.produto.nome)),
    [produtos, lotes],
  )

  const carregando = carregandoProdutos || carregandoLotes

  return (
    <div className="mx-auto min-h-screen max-w-lg bg-gray-50 px-4 py-4">
      <Link to="/" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Estoque</h1>
      <p className="mt-1 text-xs text-gray-500">Caixas disponíveis agora para novos pedidos.</p>

      {carregando && (
        <p className="brand-loading mt-6 text-center text-sm text-gray-500">Carregando...</p>
      )}

      <div className="mt-4 space-y-2">
        {!carregando &&
          linhas.map(({ produto, lotes: lotesProduto, total }) => (
            <div
              key={produto.id}
              className={`rounded-xl border bg-white px-4 py-3 ${total > 0 ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900">{produto.nome}</p>
                <p
                  className={`text-sm font-bold ${total > 0 ? 'text-green-700' : 'text-gray-400'}`}
                >
                  {total} cx
                </p>
              </div>
              {lotesProduto.length > 0 ? (
                <ul className="mt-2 space-y-1">
                  {lotesProduto.map((l) => (
                    <li key={l.id} className="flex justify-between text-xs text-gray-600">
                      <span>{rotuloLote(l)}</span>
                      <span className="font-medium">{l.quantidadeDisponivel} cx</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-gray-400">Sem caixas disponíveis</p>
              )}
            </div>
          ))}
      </div>
    </div>
  )
}
