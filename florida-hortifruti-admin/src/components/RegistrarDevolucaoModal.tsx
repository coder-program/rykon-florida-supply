import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/useAuth'
import { MotivosDevolucao } from './MotivosDevolucao'
import { SELECAO_VAZIA, erroSelecao, type SelecaoMotivos } from '../lib/motivosDevolucao'
import { Button } from './ui/Button'
import { Input } from './ui/Input'
import { Modal } from './ui/Modal'

type PedidoDevolucao = {
  pedidoId: string
  pedidoNumero: number
  cliente: string | null
  entregueEm: string | null
  itens: { produtoId: string; nome: string; quantidade: number }[]
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Falha ao ler imagem'))
    reader.readAsDataURL(file)
  })
}

function numeroPedido(numero: number) {
  return String(numero).padStart(6, '0')
}

// Supervisor registra com fotos; administrador e administrativo, sem. Os dois já saem aprovados
export function RegistrarDevolucaoModal({ onFechar }: { onFechar: () => void }) {
  const qc = useQueryClient()
  const { isSupervisor } = useAuth()
  const [busca, setBusca] = useState('')
  const [pedido, setPedido] = useState<PedidoDevolucao | null>(null)
  const [quantidades, setQuantidades] = useState<Record<string, string>>({})
  const [motivos, setMotivos] = useState<Record<string, SelecaoMotivos>>({})
  const [observacao, setObservacao] = useState('')
  const [arquivos, setArquivos] = useState<File[]>([])
  const [erro, setErro] = useState('')

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos-para-devolucao'],
    queryFn: () =>
      api
        .get('/devolucoes/pedidos')
        .then((r) => (Array.isArray(r.data) ? (r.data as PedidoDevolucao[]) : [])),
  })

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return pedidos
    return pedidos.filter(
      (p) =>
        numeroPedido(p.pedidoNumero).includes(termo) ||
        String(p.cliente ?? '')
          .toLowerCase()
          .includes(termo),
    )
  }, [pedidos, busca])

  const registrar = useMutation({
    mutationFn: async () => {
      const devolvidos = (pedido?.itens ?? []).filter(
        (item) => Number(quantidades[item.produtoId] || 0) > 0,
      )
      if (!pedido || devolvidos.length === 0) throw new Error('Informe ao menos um item devolvido')
      for (const item of devolvidos) {
        const problema = erroSelecao(motivos[item.produtoId], item.nome)
        if (problema) throw new Error(problema)
      }
      if (isSupervisor && arquivos.length !== 3) throw new Error('Envie exatamente 3 fotos')

      return api.post('/devolucoes', {
        pedidoId: pedido.pedidoId,
        observacao: observacao.trim() || undefined,
        fotos: isSupervisor ? await Promise.all(arquivos.map(toDataUrl)) : undefined,
        itens: devolvidos.map((item) => {
          const selecao = motivos[item.produtoId]
          return {
            produtoId: item.produtoId,
            quantidade: Number(quantidades[item.produtoId]),
            motivos: selecao.motivos,
            motivoOutro: selecao.motivos.includes('OUTROS')
              ? selecao.motivoOutro.trim()
              : undefined,
          }
        }),
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devolucoes'] })
      qc.invalidateQueries({ queryKey: ['devolucoes-resumo-geral'] })
      onFechar()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(
        Array.isArray(msg) ? msg.join(' ') : msg || e?.message || 'Não foi possível registrar',
      )
    },
  })

  return (
    <Modal open onClose={onFechar} title="Registrar devolução" size="lg">
      <div className="space-y-4">
        {!pedido ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por número ou cliente"
                className="min-h-11 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="max-h-80 space-y-1.5 overflow-y-auto">
              {isLoading && (
                <p className="brand-loading py-3 text-sm text-gray-500">Carregando...</p>
              )}
              {!isLoading && filtrados.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">Nenhum pedido entregue.</p>
              )}
              {filtrados.map((p) => (
                <button
                  key={p.pedidoId}
                  type="button"
                  onClick={() => setPedido(p)}
                  className="w-full cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-left transition hover:border-green-300 hover:bg-green-50/40"
                >
                  <span className="text-sm font-semibold text-gray-900">
                    #{numeroPedido(p.pedidoNumero)}
                  </span>
                  <p className="truncate text-xs text-gray-600">
                    {p.cliente ?? 'Cliente'}
                    {p.entregueEm
                      ? ` · Entregue ${new Date(p.entregueEm).toLocaleDateString('pt-BR')}`
                      : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">
                  Pedido #{numeroPedido(pedido.pedidoNumero)}
                </p>
                <p className="truncate text-xs text-gray-600">{pedido.cliente ?? 'Cliente'}</p>
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={() => setPedido(null)}>
                Trocar
              </Button>
            </div>

            <div className="space-y-3">
              {pedido.itens.map((item) => (
                <div
                  key={item.produtoId}
                  className="space-y-2 rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">{item.nome}</p>
                      <p className="text-xs text-gray-500">No pedido: {item.quantidade} caixa(s)</p>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={item.quantidade}
                      aria-label={`Caixas devolvidas de ${item.nome}`}
                      value={quantidades[item.produtoId] ?? ''}
                      onChange={(e) =>
                        setQuantidades((atual) => ({ ...atual, [item.produtoId]: e.target.value }))
                      }
                      placeholder="0"
                      className="h-10 w-20 rounded-lg border border-gray-300 px-2 text-center text-sm"
                    />
                  </div>
                  {Number(quantidades[item.produtoId] || 0) > 0 && (
                    <MotivosDevolucao
                      valor={motivos[item.produtoId] ?? SELECAO_VAZIA}
                      onChange={(valor) =>
                        setMotivos((atual) => ({ ...atual, [item.produtoId]: valor }))
                      }
                    />
                  )}
                </div>
              ))}
            </div>

            {isSupervisor && (
              <Input
                type="file"
                accept="image/*"
                multiple
                label="Fotos da caixa (3 fotos)"
                onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
              />
            )}

            <label className="block space-y-1">
              <span className="block text-xs font-medium text-gray-700">Observação (opcional)</span>
              <textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>

            {erro && <p className="text-sm text-red-600">{erro}</p>}

            <Button
              type="button"
              className="w-full"
              disabled={registrar.isPending}
              onClick={() => {
                setErro('')
                registrar.mutate()
              }}
            >
              {registrar.isPending ? 'Registrando...' : 'Registrar devolução'}
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
