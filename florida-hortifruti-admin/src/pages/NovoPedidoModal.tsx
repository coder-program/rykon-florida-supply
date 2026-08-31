import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'

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

  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes'],
    queryFn: () => api.get('/clientes').then((r) => r.data),
    enabled: open,
  })

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => r.data),
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

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Novo Pedido"
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          criar.mutate()
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
                          className="w-6 h-6 bg-red-100 text-red-600 rounded flex items-center justify-center"
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
                      className="w-6 h-6 bg-green-100 text-green-700 rounded flex items-center justify-center disabled:opacity-40 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
          onChange={(e) => setObservacoes(e.target.value)}
        />

        {criar.isError && (
          <p className="text-xs text-red-600">
            {Array.isArray((criar.error as any)?.response?.data?.message)
              ? (criar.error as any).response.data.message.join(' ')
              : ((criar.error as any)?.response?.data?.message ??
                'Não foi possível criar o pedido.')}
          </p>
        )}
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
    </Modal>
  )
}
