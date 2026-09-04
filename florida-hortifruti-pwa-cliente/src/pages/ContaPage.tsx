import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import { useAuth } from '../contexts/useAuth'

export function ContaPage() {
  const { logout } = useAuth()
  const { data: conta } = useQuery({
    queryKey: ['portal-conta'],
    queryFn: () => api.get('/portal-cliente/conta').then((r) => r.data),
  })

  const endereco = conta?.enderecos?.[0]

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-lg font-semibold">Conta</h1>
      {conta && (
        <div className="space-y-2 rounded-xl border bg-white p-4 text-sm">
          <p className="font-medium">{conta.razaoSocialOuNome}</p>
          {conta.nomeFantasia && <p className="text-gray-500">{conta.nomeFantasia}</p>}
          <p className="text-gray-600">{conta.email}</p>
          <p className="text-gray-600">{conta.telefone ?? conta.whatsapp}</p>
          {endereco && (
            <p className="text-gray-600">
              {endereco.logradouro}, {endereco.numero}
              {endereco.bairro ? ` — ${endereco.bairro}` : ''}
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={logout}
        className="w-full min-h-11 rounded-xl border border-red-200 text-red-600"
      >
        Sair
      </button>
    </div>
  )
}
