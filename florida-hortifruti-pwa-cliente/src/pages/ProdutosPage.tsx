import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Plus } from 'lucide-react'
import { api } from '../lib/api'
import { DISPONIBILIDADE, formatBRL } from '../lib/utils'
import { lerCarrinho, salvarCarrinho, type CartItem } from '../lib/cart'

export function ProdutosPage() {
  const [busca, setBusca] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const { data: produtos = [] } = useQuery({
    queryKey: ['portal-produtos'],
    queryFn: () => api.get('/portal-cliente/produtos').then((r) => r.data),
  })

  const categorias = useMemo(() => {
    const mapa = new Map<string, string>()
    for (const p of produtos as any[]) {
      if (p.categoria?.id) mapa.set(p.categoria.id, p.categoria.nome)
    }
    return [...mapa.entries()]
  }, [produtos])

  const filtrados = (produtos as any[]).filter((p) => {
    const termo = busca.trim().toLowerCase()
    const okBusca = !termo || p.nome.toLowerCase().includes(termo)
    const okCat = !categoriaId || p.categoria?.id === categoriaId
    return okBusca && okCat
  })

  function adicionar(p: any) {
    if (p.disponibilidade === 'INDISPONIVEL') return
    const atual = lerCarrinho()
    const idx = atual.findIndex((i) => i.produtoId === p.id)
    const item: CartItem = {
      produtoId: p.id,
      nome: p.nome,
      unidadeVenda: p.unidadeVenda,
      preco: p.preco,
      quantidade: 1,
    }
    if (idx >= 0) atual[idx] = { ...atual[idx], quantidade: atual[idx].quantidade + 1 }
    else atual.push(item)
    salvarCarrinho(atual)
    window.dispatchEvent(new Event('carrinho'))
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-lg font-semibold text-gray-900">Produtos</h1>
      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar"
          className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-3"
        />
      </div>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setCategoriaId('')}
          className={`rounded-full px-3 py-1 text-xs ${!categoriaId ? 'bg-green-600 text-white' : 'bg-white border'}`}
        >
          Todas
        </button>
        {categorias.map(([id, nome]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCategoriaId(id)}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs ${categoriaId === id ? 'bg-green-600 text-white' : 'bg-white border'}`}
          >
            {nome}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {filtrados.map((p) => {
          const disp = DISPONIBILIDADE[p.disponibilidade] ?? DISPONIBILIDADE.DISPONIVEL
          return (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">{p.nome}</p>
                  <p className="text-xs text-gray-500">/{p.unidadeVenda}</p>
                  {p.preco != null && (
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      {formatBRL(p.preco)}
                    </p>
                  )}
                  {p.quantidadeAproximada != null && (
                    <p className="text-xs text-gray-500">
                      ~{p.quantidadeAproximada} {p.unidadeVenda}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] text-gray-600">
                    <span className={`h-2 w-2 rounded-full ${disp.className}`} />
                    {disp.label}
                  </span>
                  <button
                    type="button"
                    disabled={p.disponibilidade === 'INDISPONIVEL'}
                    onClick={() => adicionar(p)}
                    className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-green-600 px-3 text-xs font-medium text-white disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
