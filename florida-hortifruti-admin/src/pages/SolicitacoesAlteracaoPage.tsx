import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Printer, X } from 'lucide-react'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Select } from '../components/ui/Input'

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  NEGADA: 'Negada',
}

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  APROVADA: 'bg-green-100 text-green-700',
  NEGADA: 'bg-red-100 text-red-700',
}

function numeroPedido(n: number | string) {
  return `#${String(n).padStart(6, '0')}`
}

function nomeCaixa(n: number) {
  return `Caixa ${String(n).padStart(2, '0')}`
}

export function SolicitacoesAlteracaoPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [filtro, setFiltro] = useState('PENDENTE')
  const [negarId, setNegarId] = useState<string | null>(null)
  const [resposta, setResposta] = useState('')

  const { data: solicitacoes = [], isLoading } = useQuery({
    queryKey: ['solicitacoes-alteracao', filtro],
    queryFn: () =>
      api
        .get('/solicitacoes-alteracao', { params: filtro ? { status: filtro } : {} })
        .then((r) => r.data),
  })

  const aprovar = useMutation({
    mutationFn: (id: string) => api.post(`/solicitacoes-alteracao/${id}/aprovar`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-alteracao'] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      const extras = res.data?.etiquetasExtras
      const etiquetaId = res.data?.etiquetaId
      if (extras && etiquetaId) {
        navigate(`/etiqueta/${etiquetaId}?de=${extras.de}&ate=${extras.ate}`)
      }
    },
  })

  const negar = useMutation({
    mutationFn: () =>
      api.post(`/solicitacoes-alteracao/${negarId}/negar`, {
        resposta: resposta.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['solicitacoes-alteracao'] })
      setNegarId(null)
      setResposta('')
    },
  })

  return (
    <div className="min-w-0">
      <PageHeader
        title="Solicitações de Alteração"
        subtitle="Aprovar ou negar mudanças de quantidade pedidas pelo vendedor na entrega"
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="w-full sm:w-56">
          <Select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="PENDENTE">Pendentes</option>
            <option value="APROVADA">Aprovadas</option>
            <option value="NEGADA">Negadas</option>
            <option value="">Todas</option>
          </Select>
        </div>

        {isLoading && <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>}
        {!isLoading && solicitacoes.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">Nenhuma solicitação encontrada</p>
        )}

        <div className="space-y-3">
          {solicitacoes.map((s: any) => {
            const aumento = s.delta > 0
            return (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      Pedido {numeroPedido(s.pedido?.numero)}
                    </p>
                    <p className="text-sm text-gray-700">{s.pedido?.cliente?.razaoSocialOuNome}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      Vendedor: {s.solicitante?.nome ?? s.pedido?.vendedor?.nome} ·{' '}
                      {formatDateTime(s.criadoEm)}
                    </p>
                  </div>
                  <Badge className={STATUS_COLOR[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Quantidade original</p>
                    <p className="font-semibold text-gray-900">{s.quantidadeOriginal} cx</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Quantidade solicitada</p>
                    <p className="font-semibold text-gray-900">{s.quantidadeSolicitada} cx</p>
                  </div>
                  <div className="col-span-2 rounded-lg bg-gray-50 p-3 sm:col-span-1">
                    <p className="text-xs text-gray-500">Diferença</p>
                    <p className={`font-semibold ${aumento ? 'text-green-700' : 'text-amber-700'}`}>
                      {aumento ? '+' : ''}
                      {s.delta} cx
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1 text-sm">
                  {(s.itens ?? []).map((item: any) => (
                    <p key={item.produtoId} className="text-gray-700">
                      {item.nome}: {item.quantidadeOriginal} → {item.quantidadeSolicitada} cx
                    </p>
                  ))}
                </div>

                {s.observacao && (
                  <p className="mt-2 text-xs text-gray-500">Obs. do vendedor: {s.observacao}</p>
                )}
                {s.resposta && <p className="mt-2 text-xs text-gray-500">Resposta: {s.resposta}</p>}

                {s.status === 'PENDENTE' && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => aprovar.mutate(s.id)}
                      disabled={aprovar.isPending}
                    >
                      <Check className="h-4 w-4" /> Aprovar
                    </Button>
                    <Button
                      variant="danger"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setNegarId(s.id)
                        setResposta('')
                      }}
                    >
                      <X className="h-4 w-4" /> Negar
                    </Button>
                  </div>
                )}

                {s.status === 'APROVADA' && s.delta > 0 && s.pedido?.etiqueta?.id && (
                  <Button
                    variant="secondary"
                    className="mt-3 w-full sm:w-auto"
                    onClick={() =>
                      navigate(
                        `/etiqueta/${s.pedido.etiqueta.id}?de=${s.quantidadeOriginal + 1}&ate=${s.quantidadeSolicitada}`,
                      )
                    }
                  >
                    <Printer className="h-4 w-4" /> Imprimir {nomeCaixa(s.quantidadeOriginal + 1)} a{' '}
                    {nomeCaixa(s.quantidadeSolicitada)}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <Modal open={!!negarId} onClose={() => setNegarId(null)} title="Negar solicitação" size="sm">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            O vendedor verá que a solicitação foi negada. Pode informar o motivo:
          </p>
          <textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Motivo (opcional)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNegarId(null)}>
              Voltar
            </Button>
            <Button variant="danger" onClick={() => negar.mutate()} disabled={negar.isPending}>
              {negar.isPending ? 'Negando...' : 'Negar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
