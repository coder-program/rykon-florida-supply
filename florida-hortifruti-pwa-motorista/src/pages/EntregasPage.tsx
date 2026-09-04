import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { STATUS_LABEL, textoEndereco } from '../lib/utils'
import { useAuth } from '../contexts/useAuth'

export function EntregasPage() {
  const { logout, usuario } = useAuth()
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ['motorista-entregas'],
    queryFn: () => api.get('/motorista/entregas').then((r) => r.data),
    staleTime: 0,
    refetchOnMount: 'always',
    refetchInterval: 10_000,
  })

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Entregas de hoje</h1>
          <p className="text-xs text-gray-500">{usuario?.nome}</p>
        </div>
        <button type="button" onClick={logout} className="text-sm text-red-600">
          Sair
        </button>
      </div>
      {isLoading && <p className="text-sm text-gray-500">Carregando...</p>}
      {!isLoading && (entregas as any[]).length === 0 && (
        <p className="text-sm text-gray-500">Nenhuma entrega atribuída.</p>
      )}
      <div className="space-y-3">
        {(entregas as any[]).map((e) => (
          <Link key={e.id} to={`/entrega/${e.id}`} className="block rounded-xl border bg-white p-3">
            <div className="flex justify-between gap-2">
              <p className="font-medium">Pedido #{String(e.numero).padStart(6, '0')}</p>
              <span className="text-[11px] text-green-700">
                {STATUS_LABEL[e.status] ?? e.status}
              </span>
            </div>
            <p className="text-sm text-gray-800">{e.cliente?.razaoSocialOuNome}</p>
            <p className="mt-1 text-xs text-gray-500">
              {textoEndereco(e.endereco) || 'Sem endereço'}
            </p>
            <p className="mt-1 text-xs text-gray-500">{e.itens?.length ?? 0} itens</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
