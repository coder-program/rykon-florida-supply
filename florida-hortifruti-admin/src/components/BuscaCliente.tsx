import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'

type ClienteOpcao = { id: string; razaoSocialOuNome: string; nomeFantasia?: string | null }

// Sem acento e minúsculo, para "sao" achar "São"
function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

// Campo de cliente com busca digitando (em vez de rolar uma lista longa), com a opção de
// cadastrar um cliente novo no topo
export function BuscaCliente({
  clientes,
  clienteId,
  onChange,
  onCadastrar,
}: {
  clientes: ClienteOpcao[]
  clienteId: string
  onChange: (id: string) => void
  onCadastrar: () => void
}) {
  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const selecionado = clientes.find((c) => c.id === clienteId)

  const filtrados = useMemo(() => {
    const termo = normalizar(busca.trim())
    const lista = termo
      ? clientes.filter((c) =>
          normalizar(`${c.razaoSocialOuNome} ${c.nomeFantasia ?? ''}`).includes(termo),
        )
      : clientes
    return lista.slice(0, 50)
  }, [clientes, busca])

  function escolher(id: string) {
    onChange(id)
    setBusca('')
    setAberto(false)
  }

  return (
    <div className="relative w-full space-y-1">
      <label className="block text-xs font-medium text-gray-700">Cliente *</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={aberto ? busca : (selecionado?.razaoSocialOuNome ?? '')}
          onChange={(e) => {
            setBusca(e.target.value)
            setAberto(true)
          }}
          onFocus={() => setAberto(true)}
          onBlur={() => setAberto(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && aberto) {
              e.preventDefault()
              if (filtrados[0]) escolher(filtrados[0].id)
            }
            if (e.key === 'Escape') setAberto(false)
          }}
          placeholder={selecionado ? selecionado.razaoSocialOuNome : 'Digite o nome do cliente'}
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-9 text-sm placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-green-500"
          autoComplete="off"
        />
        {selecionado && !aberto && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
            aria-label="Limpar cliente"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {aberto && (
        // onMouseDown evita que o blur do campo feche a lista antes do clique contar
        <div
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => {
              setAberto(false)
              onCadastrar()
            }}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm font-medium text-green-700 hover:bg-green-50"
          >
            <Plus className="h-4 w-4" /> Cadastrar cliente
          </button>
          {filtrados.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => escolher(c.id)}
              className={`block w-full cursor-pointer px-3 py-2 text-left text-sm hover:bg-gray-50 ${c.id === clienteId ? 'bg-green-50 font-medium' : ''}`}
            >
              {c.razaoSocialOuNome}
              {c.nomeFantasia && c.nomeFantasia !== c.razaoSocialOuNome && (
                <span className="block text-xs text-gray-400">{c.nomeFantasia}</span>
              )}
            </button>
          ))}
          {filtrados.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado</p>
          )}
        </div>
      )}
    </div>
  )
}
