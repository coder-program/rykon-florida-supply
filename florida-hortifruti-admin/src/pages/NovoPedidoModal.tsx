import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, AlertTriangle, X } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'

const LIMITE_OBSERVACOES_PEDIDO = 255

function garantirLista<T>(valor: unknown): T[] {
  if (Array.isArray(valor)) return valor as T[]

  if (valor && typeof valor === 'object') {
    const obj = valor as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(obj.data)) return obj.data as T[]
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.results)) return obj.results as T[]
  }

  return []
}

export function NovoPedidoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [clienteId, setClienteId] = useState('')
  const [itens, setItens] = useState<
    { produtoId: string; nome: string; quantidade: number; valorUnitario: number }[]
  >([])
  const [valorFrete, setValorFrete] = useState('')
  const [descontoValor, setDescontoValor] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('PIX')
  const [dataVencimento, setDataVencimento] = useState('')
  const [necessitaNF, setNecessitaNF] = useState(false)
  const [observacoes, setObservacoes] = useState('')
  const [feedback, setFeedback] = useState<{ aberto: boolean; titulo: string; mensagem: string }>({
    aberto: false,
    titulo: '',
    mensagem: '',
  })

  function abrirFeedback(titulo: string, mensagem: string) {
    setFeedback({ aberto: true, titulo, mensagem })
  }

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.get('/clientes').then((r) => garantirLista(r.data)),
    enabled: open,
  })

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => garantirLista(r.data)),
    enabled: open,
  })

  const criar = useMutation({
    mutationFn: () =>
      api.post('/pedidos', {
        clienteId,
        itens: itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          valorUnitario: i.valorUnitario,
        })),
        valorFrete: Number(valorFrete) || 0,
        descontoValor: Number(descontoValor) || 0,
        formaPagamento,
        dataVencimento: dataVencimento || undefined,
        necessitaNF,
        observacoes: observacoes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      reset()
      onClose()
    },
    onError: (erro: any) => {
      const mensagem = erro?.response?.data?.message
      const texto = Array.isArray(mensagem)
        ? mensagem.join(' ')
        : (mensagem ?? 'Não foi possível criar o pedido.')
      abrirFeedback('Falha ao criar pedido', texto)
    },
  })

  function reset() {
    setClienteId('')
    setItens([])
    setValorFrete('')
    setDescontoValor('')
    setFormaPagamento('PIX')
    setDataVencimento('')
    setNecessitaNF(false)
    setObservacoes('')
  }

  function add(p: any) {
    const estoque = Number(p.estoqueAtual ?? 0)
    const existe = itens.find((i) => i.produtoId === p.id)
    if (estoque <= 0) return
    if (existe && existe.quantidade >= estoque) return
    if (existe)
      setItens(
        itens.map((i) => (i.produtoId === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)),
      )
    else
      setItens([
        ...itens,
        { produtoId: p.id, nome: p.nome, quantidade: 1, valorUnitario: Number(p.precoSugerido) },
      ])
  }

  function dec(id: string) {
    const item = itens.find((i) => i.produtoId === id)
    if (!item) return
    if (item.quantidade <= 1) setItens(itens.filter((i) => i.produtoId !== id))
    else
      setItens(itens.map((i) => (i.produtoId === id ? { ...i, quantidade: i.quantidade - 1 } : i)))
  }

  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)
  const total = subtotal + (Number(valorFrete) || 0) - (Number(descontoValor) || 0)

  function submitPedido() {
    if (criar.isPending) return
    if (!clienteId) {
      abrirFeedback('Cliente obrigatório', 'Selecione um cliente para criar o pedido.')
      return
    }
    if (itens.length === 0) {
      abrirFeedback('Itens obrigatórios', 'Adicione pelo menos um produto ao pedido.')
      return
    }
    criar.mutate()
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Novo Pedido"
      size="lg"
      closeOnBackdropClick={false}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          submitPedido()
        }}
        className="space-y-4"
      >
        <Select
          label="Cliente *"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          required
        >
          <option value="">Selecione o cliente</option>
          {clientes.map((c: any) => (
            <option key={c.id} value={c.id}>
              {c.razaoSocialOuNome}
            </option>
          ))}
        </Select>

        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Produtos</p>
          <div className="max-h-48 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2">
            {produtos.map((p: any) => {
              const item = itens.find((i) => i.produtoId === p.id)
              const estoque = Number(p.estoqueAtual ?? 0)
              const semEstoque = estoque <= 0
              const noLimite = !!item && item.quantidade >= estoque
              return (
                <div
                  key={p.id}
                  className={`flex items-center justify-between gap-2 text-sm ${semEstoque ? 'opacity-50' : ''}`}
                >
                  <span className="flex-1 truncate">
                    {p.nome}
                    <span className="block text-[11px] text-gray-400">
                      {semEstoque ? 'Sem estoque' : `${estoque} cx`}
                    </span>
                  </span>
                  <div className="flex items-center gap-1">
                    {item && (
                      <>
                        <button
                          type="button"
                          onClick={() => dec(p.id)}
                          className="w-6 h-6 cursor-pointer bg-red-100 text-red-600 rounded flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-semibold">{item.quantidade}</span>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => add(p)}
                      disabled={semEstoque || noLimite}
                      className="w-6 h-6 cursor-pointer bg-green-100 text-green-700 rounded flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Frete (R$)"
            type="number"
            step="0.01"
            value={valorFrete}
            onChange={(e) => setValorFrete(e.target.value)}
          />
          <Input
            label="Desconto (R$)"
            type="number"
            step="0.01"
            value={descontoValor}
            onChange={(e) => setDescontoValor(e.target.value)}
          />
          <Select
            label="Pagamento *"
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
          >
            <option value="PIX">PIX</option>
            <option value="BOLETO">Boleto</option>
            <option value="DINHEIRO">Dinheiro</option>
            <option value="OUTROS">Outros</option>
          </Select>
          <Input
            label="Vencimento"
            type="date"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={necessitaNF}
            onChange={(e) => setNecessitaNF(e.target.checked)}
            className="accent-green-600"
          />
          Necessita Nota Fiscal
        </label>
        <Input
          label="Observações"
          value={observacoes}
          maxLength={LIMITE_OBSERVACOES_PEDIDO}
          onChange={(e) => setObservacoes(e.target.value.slice(0, LIMITE_OBSERVACOES_PEDIDO))}
        />
        <p className="-mt-3 text-right text-xs text-gray-400">
          {observacoes.length}/{LIMITE_OBSERVACOES_PEDIDO}
        </p>
        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
          <p className="text-sm font-semibold text-green-700">Total {formatBRL(total)}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!clienteId || itens.length === 0 || criar.isPending}>
              {criar.isPending ? 'Salvando...' : 'Criar Pedido'}
            </Button>
          </div>
        </div>
      </form>

      {feedback.aberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </span>
                <h3 className="text-sm font-semibold text-gray-900">{feedback.titulo}</h3>
              </div>
              <button
                type="button"
                onClick={() => setFeedback((s) => ({ ...s, aberto: false }))}
                className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm leading-relaxed text-gray-600">{feedback.mensagem}</p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setFeedback((s) => ({ ...s, aberto: false }))}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
