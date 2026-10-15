import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bell, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'

type Aviso = {
  id: string
  tipo: string
  titulo: string
  mensagem: string
  criadoEm: string
  lidaEm: string | null
  pedidoId: string | null
}

const COR_TIPO: Record<string, string> = {
  COMPRA_A_PRAZO: 'border-l-emerald-500',
  VENCE_EM_3_DIAS: 'border-l-amber-500',
  VENCIMENTO_HOJE: 'border-l-red-500',
}

export function AvisosPage() {
  const qc = useQueryClient()
  const { data: avisos = [], isLoading } = useQuery<Aviso[]>({
    queryKey: ['portal-avisos'],
    queryFn: () => api.get('/portal-cliente/notificacoes').then((r) => r.data),
  })

  const marcarLidas = useMutation({
    mutationFn: () => api.post('/portal-cliente/notificacoes/lidas'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['portal-avisos'] }),
  })

  // Abrir a tela conta como leitura de todos os avisos
  const temNaoLidos = avisos.some((a) => !a.lidaEm)
  useEffect(() => {
    if (temNaoLidos && !marcarLidas.isPending) marcarLidas.mutate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temNaoLidos])

  if (isLoading)
    return (
      <p className="brand-loading px-4 py-10 text-center text-sm text-gray-500">Carregando...</p>
    )

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-gray-700" />
        <h1 className="text-lg font-semibold text-gray-900">Avisos</h1>
      </div>

      {avisos.length === 0 && (
        <p className="rounded-2xl bg-white px-4 py-8 text-center text-sm text-gray-500">
          Nenhum aviso no momento.
        </p>
      )}

      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className={`rounded-2xl border border-l-4 border-gray-100 bg-white px-4 py-3 shadow-sm ${COR_TIPO[aviso.tipo] ?? 'border-l-gray-300'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-gray-900">{aviso.titulo}</p>
            {!aviso.lidaEm && (
              <span className="shrink-0 rounded-full bg-ember px-2 py-0.5 text-[10px] font-semibold text-white">
                Novo
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-gray-600">{aviso.mensagem}</p>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
            <span>{formatDate(aviso.criadoEm)}</span>
            {aviso.pedidoId && (
              <Link
                to={`/pedidos/${aviso.pedidoId}`}
                className="inline-flex items-center gap-1 font-medium text-emerald-700"
              >
                Ver pedido <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
