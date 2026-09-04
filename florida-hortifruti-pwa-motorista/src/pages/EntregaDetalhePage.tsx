import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import { mapsUrl, textoEndereco } from '../lib/utils'

export function EntregaDetalhePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: e, isLoading } = useQuery({
    queryKey: ['motorista-entrega', id],
    queryFn: () => api.get(`/motorista/entregas/${id}`).then((r) => r.data),
  })

  const iniciar = useMutation({
    mutationFn: () => api.post(`/motorista/entregas/${id}/iniciar`),
    onSuccess: (res) => {
      qc.setQueryData(['motorista-entrega', id], res.data)
      qc.invalidateQueries({ queryKey: ['motorista-entregas'] })
    },
  })

  if (isLoading || !e) {
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Carregando...</p>
  }

  const endereco = textoEndereco(e.endereco)

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 py-4 space-y-4">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-gray-600">
        <ArrowLeft className="h-4 w-4" /> Entregas
      </Link>
      <h1 className="text-lg font-semibold">Pedido #{String(e.numero).padStart(6, '0')}</h1>
      <div className="rounded-xl border bg-white p-3 text-sm space-y-1">
        <p className="font-medium">{e.cliente?.razaoSocialOuNome}</p>
        <p className="text-gray-600">{e.cliente?.telefone || e.cliente?.whatsapp || '—'}</p>
        <p className="text-gray-600">{endereco || 'Sem endereço'}</p>
      </div>
      {endereco && (
        <a
          href={mapsUrl(e.endereco)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 text-white text-sm font-medium"
        >
          <MapPin className="h-4 w-4" /> Abrir no mapa
        </a>
      )}
      <div className="rounded-xl border bg-white p-3 space-y-2">
        <p className="text-xs font-semibold text-gray-500">Itens</p>
        {e.itens.map((i: any) => (
          <p key={i.produtoId} className="text-sm">
            {i.quantidade} {i.unidadeVenda} · {i.nome}
          </p>
        ))}
      </div>
      {e.status !== 'EM_ENTREGA' && e.status !== 'ENTREGUE' && (
        <button
          type="button"
          disabled={iniciar.isPending}
          onClick={() => iniciar.mutate()}
          className="w-full min-h-11 rounded-xl bg-green-600 text-white font-medium"
        >
          {iniciar.isPending ? 'Iniciando...' : 'Iniciar entrega'}
        </button>
      )}
      {e.status === 'EM_ENTREGA' && (
        <button
          type="button"
          onClick={() => navigate(`/entrega/${id}/confirmar`)}
          className="w-full min-h-11 rounded-xl bg-green-600 text-white font-medium"
        >
          Confirmar entrega
        </button>
      )}
    </div>
  )
}
