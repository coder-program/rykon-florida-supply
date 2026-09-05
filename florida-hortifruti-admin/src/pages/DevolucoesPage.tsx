import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Clock3, Eye, Loader2, XCircle } from 'lucide-react'
import { api, resolveAssetUrl } from '../lib/api'
import { formatBRL, formatDateTime, statusPedidoVisivel } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONCLUIDA: 'Concluída',
  NEGADA: 'Negada',
}

const STATUS_CLASS: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  NEGADA: 'bg-red-100 text-red-700',
}

export function DevolucoesPage() {
  const qc = useQueryClient()
  const [devolucaoSelecionada, setDevolucaoSelecionada] = useState<any | null>(null)

  const { data: devolucoes = [], isLoading } = useQuery({
    queryKey: ['admin-devolucoes'],
    queryFn: () => api.get('/devolucoes').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })

  const { data: pedidoDetalhe, isLoading: carregandoDetalhePedido } = useQuery({
    queryKey: ['devolucao-pedido-detalhe', devolucaoSelecionada?.pedidoId],
    enabled: Boolean(devolucaoSelecionada?.pedidoId),
    queryFn: () => api.get(`/pedidos/${devolucaoSelecionada?.pedidoId}`).then((r) => r.data),
  })

  const atualizar = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'CONCLUIDA' | 'NEGADA' }) =>
      api.patch(`/devolucoes/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devolucoes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const pendentes = (devolucoes as any[]).filter((d) => d.status === 'PENDENTE').length

  function renderFotos(item: any, mini = true) {
    if (!Array.isArray(item.fotos) || item.fotos.length === 0) {
      return <span className="text-xs text-gray-500">0</span>
    }

    const baseClass = mini ? 'h-9 w-9' : 'h-20 w-20'

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {item.fotos.slice(0, mini ? 3 : 10).map((foto: string) => {
          const fotoUrl = resolveAssetUrl(foto)
          return (
            <a
              key={`${item.id}-${foto}`}
              href={fotoUrl}
              target="_blank"
              rel="noreferrer"
              className="block cursor-pointer"
            >
              <img
                src={fotoUrl}
                alt="Foto da devolução"
                className={`${baseClass} rounded-md border border-gray-200 object-cover`}
              />
            </a>
          )
        })}
        {mini ? <span className="text-xs text-gray-500">{item.fotos.length}</span> : null}
      </div>
    )
  }

  function abrirDetalhes(item: any) {
    setDevolucaoSelecionada(item)
  }

  function fecharDetalhes() {
    setDevolucaoSelecionada(null)
  }

  return (
    <div>
      <PageHeader
        title="Devoluções"
        subtitle={`Solicitações de devolução dos vendedores · ${pendentes} pendente(s)`}
      />

      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Fila de devoluções</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && <p className="px-5 py-8 text-sm text-gray-500">Carregando...</p>}

            {!isLoading && (devolucoes as any[]).length === 0 && (
              <p className="px-5 py-8 text-sm text-gray-500">Nenhuma devolução registrada.</p>
            )}

            {!isLoading && (devolucoes as any[]).length > 0 && (
              <>
                <div className="space-y-3 p-3 md:hidden">
                  {(devolucoes as any[]).map((item) => (
                    <article key={item.id} className="rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            Pedido #{String(item.pedidoNumero ?? '').padStart(6, '0')}
                          </p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[item.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1.5 text-xs text-gray-700">
                        <p>
                          <span className="font-medium text-gray-500">Etiqueta:</span>{' '}
                          <span className="font-mono">{item.etiquetaToken ?? '—'}</span>
                        </p>
                        <p>
                          <span className="font-medium text-gray-500">Cliente:</span>{' '}
                          {item.cliente ?? '—'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-500">Vendedor:</span>{' '}
                          {item.vendedor ?? '—'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-500">Itens:</span>{' '}
                          {item.itensDevolvidos ?? '—'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-500">Caixas:</span>{' '}
                          {item.quantidadeCaixas ?? '—'}
                        </p>
                        <p>
                          <span className="font-medium text-gray-500">Valor:</span>{' '}
                          {item.valorDevolucao ? formatBRL(item.valorDevolucao) : '—'}
                        </p>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => abrirDetalhes(item)}
                          className="cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver detalhes
                        </Button>
                        {item.status === 'PENDENTE' ? (
                          <>
                            <Button
                              size="sm"
                              className="cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                              disabled={atualizar.isPending}
                              onClick={() => atualizar.mutate({ id: item.id, status: 'CONCLUIDA' })}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                            </Button>
                            <Button
                              size="sm"
                              variant="danger"
                              className="cursor-pointer"
                              disabled={atualizar.isPending}
                              onClick={() => atualizar.mutate({ id: item.id, status: 'NEGADA' })}
                            >
                              <XCircle className="h-3.5 w-3.5" /> Negar
                            </Button>
                          </>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                            <Clock3 className="h-3.5 w-3.5" /> Finalizada
                          </span>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-medium">Pedido</th>
                        <th className="px-4 py-3 font-medium">Etiqueta</th>
                        <th className="px-4 py-3 font-medium">Cliente</th>
                        <th className="px-4 py-3 font-medium">Vendedor</th>
                        <th className="px-4 py-3 font-medium">Itens devolvidos</th>
                        <th className="px-4 py-3 font-medium">Caixas</th>
                        <th className="px-4 py-3 font-medium">Valor devolvido</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Data</th>
                        <th className="px-4 py-3 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {(devolucoes as any[]).map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-gray-800">
                            #{String(item.pedidoNumero ?? '').padStart(6, '0')}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <span className="font-mono">{item.etiquetaToken ?? '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{item.cliente ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">{item.vendedor ?? '—'}</td>
                          <td className="px-4 py-3 text-gray-700">
                            <div className="max-w-56">
                              <p className="truncate">{item.itensDevolvidos ?? '—'}</p>
                              {Array.isArray(item.itens) && item.itens.length > 0 && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {item.itens.length} item(ns)
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {item.quantidadeCaixas ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {item.valorDevolucao ? formatBRL(item.valorDevolucao) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[item.status] ?? 'bg-gray-100 text-gray-700'}`}
                            >
                              {STATUS_LABEL[item.status] ?? item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">
                            {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="cursor-pointer"
                                onClick={() => abrirDetalhes(item)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {item.status === 'PENDENTE' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="cursor-pointer bg-emerald-600 hover:bg-emerald-700"
                                    disabled={atualizar.isPending}
                                    onClick={() =>
                                      atualizar.mutate({ id: item.id, status: 'CONCLUIDA' })
                                    }
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Concluir
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    className="cursor-pointer"
                                    disabled={atualizar.isPending}
                                    onClick={() =>
                                      atualizar.mutate({ id: item.id, status: 'NEGADA' })
                                    }
                                  >
                                    <XCircle className="h-3.5 w-3.5" /> Negar
                                  </Button>
                                </>
                              )}
                              {item.status !== 'PENDENTE' && (
                                <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                                  <Clock3 className="h-3.5 w-3.5" /> Finalizada
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal
        open={Boolean(devolucaoSelecionada)}
        onClose={fecharDetalhes}
        title={`Devolução · Pedido #${String(devolucaoSelecionada?.pedidoNumero ?? '').padStart(6, '0')}`}
        size="xl"
      >
        {devolucaoSelecionada && (
          <div className="space-y-4">
            <section className="rounded-lg border border-gray-200 p-3">
              <h3 className="text-xs font-semibold text-gray-500">DEVOLUÇÃO</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                <p>
                  <span className="text-gray-500">Status:</span>{' '}
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[devolucaoSelecionada.status] ?? 'bg-gray-100 text-gray-700'}`}
                  >
                    {STATUS_LABEL[devolucaoSelecionada.status] ?? devolucaoSelecionada.status}
                  </span>
                </p>
                <p>
                  <span className="text-gray-500">Data:</span>{' '}
                  {formatDateTime(devolucaoSelecionada.criadoEm)}
                </p>
                <p>
                  <span className="text-gray-500">Etiqueta:</span>{' '}
                  <span className="font-mono">{devolucaoSelecionada.etiquetaToken ?? '—'}</span>
                </p>
                <p>
                  <span className="text-gray-500">Vendedor:</span>{' '}
                  {devolucaoSelecionada.vendedor ?? '—'}
                </p>
                <p>
                  <span className="text-gray-500">Cliente:</span>{' '}
                  {devolucaoSelecionada.cliente ?? '—'}
                </p>
                <p>
                  <span className="text-gray-500">Registrado por:</span>{' '}
                  {devolucaoSelecionada.registradoPor ?? '—'}
                </p>
                <p>
                  <span className="text-gray-500">Caixas:</span>{' '}
                  {devolucaoSelecionada.quantidadeCaixas ?? '—'}
                </p>
                <p>
                  <span className="text-gray-500">Valor:</span>{' '}
                  {devolucaoSelecionada.valorDevolucao
                    ? formatBRL(devolucaoSelecionada.valorDevolucao)
                    : '—'}
                </p>
              </div>

              {devolucaoSelecionada.itensDevolvidos && (
                <p className="mt-2 text-sm text-gray-700">
                  <span className="text-gray-500">Itens devolvidos:</span>{' '}
                  {devolucaoSelecionada.itensDevolvidos}
                </p>
              )}
              {devolucaoSelecionada.observacao && (
                <p className="mt-1 text-sm text-gray-700">
                  <span className="text-gray-500">Observação:</span>{' '}
                  {devolucaoSelecionada.observacao}
                </p>
              )}
              {devolucaoSelecionada.resposta && (
                <p className="mt-1 text-sm text-gray-700">
                  <span className="text-gray-500">Resposta:</span> {devolucaoSelecionada.resposta}
                </p>
              )}

              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold text-gray-500">FOTOS</p>
                {renderFotos(devolucaoSelecionada, false)}
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-gray-500">DADOS DO PEDIDO</h3>
                {carregandoDetalhePedido && (
                  <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando
                  </span>
                )}
              </div>

              {pedidoDetalhe ? (
                <>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                    <p>
                      <span className="text-gray-500">Número:</span> #
                      {String(pedidoDetalhe.numero ?? '').padStart(6, '0')}
                    </p>
                    <p>
                      <span className="text-gray-500">Status:</span>{' '}
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          statusPedidoVisivel({
                            status: pedidoDetalhe.status,
                            aguardandoAlteracao: pedidoDetalhe.aguardandoAlteracao,
                          }).className
                        }`}
                      >
                        {
                          statusPedidoVisivel({
                            status: pedidoDetalhe.status,
                            aguardandoAlteracao: pedidoDetalhe.aguardandoAlteracao,
                          }).label
                        }
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-500">Data do pedido:</span>{' '}
                      {pedidoDetalhe.data
                        ? new Date(pedidoDetalhe.data).toLocaleDateString('pt-BR')
                        : '—'}
                    </p>
                    <p>
                      <span className="text-gray-500">Forma de pagamento:</span>{' '}
                      {pedidoDetalhe.formaPagamento ?? '—'}
                    </p>
                    <p>
                      <span className="text-gray-500">Subtotal:</span>{' '}
                      {pedidoDetalhe.subtotal ? formatBRL(pedidoDetalhe.subtotal) : '—'}
                    </p>
                    <p>
                      <span className="text-gray-500">Total:</span>{' '}
                      {pedidoDetalhe.valorTotal ? formatBRL(pedidoDetalhe.valorTotal) : '—'}
                    </p>
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-xs text-gray-700">
                      <thead>
                        <tr className="border-b border-gray-100 text-left text-gray-500">
                          <th className="py-1.5 pr-2">Item</th>
                          <th className="py-1.5 pr-2 text-right">Qtd</th>
                          <th className="py-1.5 pr-2 text-right">Unitário</th>
                          <th className="py-1.5 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(pedidoDetalhe.itens ?? []).map((item: any) => (
                          <tr
                            key={item.id ?? `${item.produtoId}-${item.produto?.nome}`}
                            className="border-b border-gray-50"
                          >
                            <td className="py-1.5 pr-2">{item.produto?.nome ?? 'Produto'}</td>
                            <td className="py-1.5 pr-2 text-right">
                              {Number(item.quantidade ?? 0)}
                            </td>
                            <td className="py-1.5 pr-2 text-right">
                              {formatBRL(Number(item.valorUnitario ?? 0))}
                            </td>
                            <td className="py-1.5 text-right">
                              {formatBRL(Number(item.valorTotal ?? 0))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {Array.isArray(pedidoDetalhe.devolucoes) &&
                    pedidoDetalhe.devolucoes.length > 0 && (
                      <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-2.5">
                        <p className="text-xs font-semibold text-gray-500">
                          HISTÓRICO DE DEVOLUÇÕES
                        </p>
                        <div className="mt-2 space-y-2">
                          {pedidoDetalhe.devolucoes.map((d: any) => (
                            <div
                              key={d.id}
                              className="rounded-md border border-gray-100 bg-white p-2 text-xs"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-gray-800">
                                  {formatDateTime(d.data)} · Etiqueta {d.etiquetaToken ?? '—'}
                                </p>
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[d.status] ?? 'bg-gray-100 text-gray-700'}`}
                                >
                                  {STATUS_LABEL[d.status] ?? d.status}
                                </span>
                              </div>
                              {d.itensDevolvidos ? (
                                <p className="mt-1 text-gray-700">Itens: {d.itensDevolvidos}</p>
                              ) : null}
                              <p className="mt-1 text-gray-500">
                                Caixas: {d.quantidadeCaixas ?? '—'} · Valor:{' '}
                                {d.valorDevolucao ? formatBRL(d.valorDevolucao) : '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">
                  Não foi possível carregar os dados completos do pedido para esta devolução.
                </p>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}
