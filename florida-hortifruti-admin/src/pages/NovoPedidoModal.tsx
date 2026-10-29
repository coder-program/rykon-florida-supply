import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Minus, AlertTriangle, X } from 'lucide-react'
import { api } from '../lib/api'
import { FORMA_PAGAMENTO_LABEL, FORMAS_PAGAMENTO, formatBRL, hojeISO } from '../lib/utils'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import { ClienteFormModal } from '../components/ClienteFormModal'
import { BuscaCliente } from '../components/BuscaCliente'

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

type LoteDisponivel = {
  id: string
  produtoId: string
  numero: string
  dataEntrada: string
  quantidadeDisponivel: number
  precoSugeridoVenda?: number | null
}

// Cada linha é produto + lote. O lote é escolhido por quem faz o pedido (nunca automático) e o
// mesmo produto pode ser dividido entre lotes, ex.: 20 cx do lote 1 + 10 cx do lote 2.
// O preço é digitado por pedido e não altera a tabela de preços do cliente.
type ItemNovoPedido = {
  produtoId: string
  nome: string
  loteId: string
  quantidade: number
  valorUnitario: number
}

function rotuloLote(l: { numero: string; dataEntrada: string }) {
  return `${new Date(l.dataEntrada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - lote ${l.numero}`
}

export function NovoPedidoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const [clienteId, setClienteId] = useState('')
  const [cadastrandoCliente, setCadastrandoCliente] = useState(false)
  // Dia em que a venda foi fechada; pode ser anterior quando a relação chega no dia seguinte
  const [dataPedido, setDataPedido] = useState(hojeISO)
  const [itens, setItens] = useState<ItemNovoPedido[]>([])
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

  const { data: lotes = [] } = useQuery<LoteDisponivel[]>({
    queryKey: ['lotes-disponiveis'],
    queryFn: () => api.get('/estoque/lotes/disponiveis').then((r) => garantirLista(r.data)),
    enabled: open,
  })

  const criar = useMutation({
    mutationFn: () =>
      api.post('/pedidos', {
        clienteId,
        data: dataPedido,
        itens: itens.map((i) => ({
          produtoId: i.produtoId,
          loteId: i.loteId,
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
      // As caixas saem do lote no lançamento: saldo atualizado para o próximo pedido
      qc.invalidateQueries({ queryKey: ['lotes-disponiveis'] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
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
    setDataPedido(hojeISO())
    setItens([])
    setValorFrete('')
    setDescontoValor('')
    setFormaPagamento('PIX')
    setDataVencimento('')
    setNecessitaNF(false)
    setObservacoes('')
  }

  function lotesDoProduto(produtoId: string) {
    return lotes.filter((l) => l.produtoId === produtoId)
  }

  function saldoLote(loteId: string) {
    return lotes.find((l) => l.id === loteId)?.quantidadeDisponivel ?? 0
  }

  function precoSugeridoLote(loteId: string) {
    return lotes.find((l) => l.id === loteId)?.precoSugeridoVenda ?? null
  }

  function atualizar(index: number, patch: Partial<ItemNovoPedido>) {
    setItens(itens.map((i, idx) => (idx === index ? { ...i, ...patch } : i)))
  }

  function adicionarLinha(p: any) {
    const usados = new Set(itens.filter((i) => i.produtoId === p.id).map((i) => i.loteId))
    const livres = lotesDoProduto(p.id).filter((l) => !usados.has(l.id))
    if (livres.length === 0) return
    // Só preenche o lote sozinho quando não há escolha a fazer (um único lote livre)
    const unico = livres.length === 1 ? livres[0] : undefined
    const precoBase = itens.find((i) => i.produtoId === p.id)?.valorUnitario
    setItens([
      ...itens,
      {
        produtoId: p.id,
        nome: p.nome,
        loteId: unico?.id ?? '',
        quantidade: 1,
        valorUnitario: precoBase ?? Number(p.precoSugerido),
      },
    ])
  }

  function setLote(index: number, loteId: string) {
    const lote = lotes.find((l) => l.id === loteId)
    const item = itens[index]
    atualizar(index, {
      loteId,
      quantidade: lote
        ? Math.max(1, Math.min(item.quantidade, lote.quantidadeDisponivel))
        : item.quantidade,
    })
  }

  function mudarQuantidade(index: number, delta: number) {
    const item = itens[index]
    const nova = item.quantidade + delta
    if (nova <= 0) {
      setItens(itens.filter((_, idx) => idx !== index))
      return
    }
    if (delta > 0 && item.loteId && nova > saldoLote(item.loteId)) return
    atualizar(index, { quantidade: nova })
  }

  // Digitação livre: vazio vira 0 enquanto edita e volta a 1 ao sair do campo
  function digitarQuantidade(index: number, valor: string) {
    const n = Number.parseInt(valor, 10)
    atualizar(index, { quantidade: Number.isFinite(n) ? Math.max(0, n) : 0 })
  }

  function confirmarQuantidade(index: number) {
    if (itens[index].quantidade <= 0) atualizar(index, { quantidade: 1 })
  }

  const linhasSemLote = itens.some((i) => !i.loteId)
  const acimaDoSaldo = itens.some((i) => i.loteId && i.quantidade > saldoLote(i.loteId))
  const precoInvalido = itens.some((i) => !(i.valorUnitario > 0))

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
    if (linhasSemLote) {
      abrirFeedback('Lote obrigatório', 'Selecione o lote de cada produto.')
      return
    }
    if (acimaDoSaldo) {
      abrirFeedback(
        'Saldo insuficiente',
        'Há lote com saldo insuficiente. Ajuste a quantidade ou divida em outro lote.',
      )
      return
    }
    if (precoInvalido) {
      abrirFeedback('Preço obrigatório', 'Informe o preço de venda de cada produto.')
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
        <BuscaCliente
          clientes={clientes as any[]}
          clienteId={clienteId}
          onChange={setClienteId}
          // Ao salvar o cadastro, o cliente novo já fica selecionado
          onCadastrar={() => setCadastrandoCliente(true)}
        />

        <div>
          <Input
            label="Data do pedido *"
            type="date"
            value={dataPedido}
            max={hojeISO()}
            onChange={(e) => setDataPedido(e.target.value)}
            required
          />
          {dataPedido && dataPedido < hojeISO() && (
            <p className="mt-1 text-xs text-amber-700">
              Venda de outro dia: entra nos relatórios e na meta desse dia.
            </p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium text-gray-700 mb-2">Produtos</p>
          <div className="max-h-80 overflow-y-auto space-y-2 border border-gray-100 rounded-lg p-2">
            {produtos.map((p: any) => {
              const estoque = Number(p.estoqueAtual ?? 0)
              const opcoesLote = lotesDoProduto(p.id)
              const semEstoque = estoque <= 0 || opcoesLote.length === 0
              const linhas = itens
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.produtoId === p.id)
              const usados = new Set(linhas.map(({ item }) => item.loteId))
              const temLoteLivre = opcoesLote.some((l) => !usados.has(l.id))
              return (
                <div
                  key={p.id}
                  className={`rounded-lg text-sm ${linhas.length > 0 ? 'border border-green-300 p-2' : ''} ${semEstoque && linhas.length === 0 ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex-1 truncate">
                      {p.nome}
                      <span className="block text-[11px] text-gray-400">
                        {semEstoque ? 'Sem lote com saldo' : `${estoque} cx`}
                      </span>
                    </span>
                    {linhas.length === 0 && (
                      <button
                        type="button"
                        onClick={() => adicionarLinha(p)}
                        disabled={semEstoque}
                        className="w-6 h-6 cursor-pointer bg-green-100 text-green-700 rounded flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {linhas.map(({ item, index }) => {
                    const saldo = saldoLote(item.loteId)
                    const noLimite = !!item.loteId && item.quantidade >= saldo
                    return (
                      <div key={index} className="mt-2 space-y-1.5 rounded-lg bg-gray-50 p-2">
                        <div className="flex items-center gap-1.5">
                          <select
                            value={item.loteId}
                            onChange={(e) => setLote(index, e.target.value)}
                            className={`min-w-0 flex-1 rounded-lg border bg-white px-2 py-1.5 text-sm ${item.loteId ? 'border-gray-300' : 'border-amber-400'}`}
                          >
                            <option value="">Selecione o lote</option>
                            {opcoesLote
                              .filter((l) => l.id === item.loteId || !usados.has(l.id))
                              .map((l) => (
                                <option key={l.id} value={l.id}>
                                  {rotuloLote(l)} • {l.quantidadeDisponivel} cx
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => mudarQuantidade(index, -1)}
                            className="w-6 h-6 shrink-0 cursor-pointer bg-red-100 text-red-600 rounded flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            value={item.quantidade || ''}
                            onChange={(e) => digitarQuantidade(index, e.target.value)}
                            onBlur={() => confirmarQuantidade(index)}
                            onFocus={(e) => e.target.select()}
                            aria-label="Quantidade de caixas"
                            className="w-12 h-6 shrink-0 rounded border border-gray-300 bg-white text-center text-sm font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => mudarQuantidade(index, 1)}
                            disabled={noLimite}
                            className="w-6 h-6 shrink-0 cursor-pointer bg-green-100 text-green-700 rounded flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-40 disabled:bg-gray-100 disabled:text-gray-400"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        {(() => {
                          const sugerido = precoSugeridoLote(item.loteId)
                          if (sugerido == null) return null
                          const abaixo = item.valorUnitario > 0 && item.valorUnitario < sugerido
                          return (
                            <p
                              className={`text-xs ${abaixo ? 'font-medium text-amber-700' : 'text-gray-500'}`}
                            >
                              Preço sugerido: {formatBRL(sugerido)}/cx
                              {abaixo ? ' • preço abaixo do sugerido' : ''}
                            </p>
                          )
                        })()}
                        {item.loteId && item.quantidade > saldo && (
                          <p className="text-xs text-red-600">
                            Saldo insuficiente: o lote tem {saldo} cx. Selecione outro lote ou
                            divida.
                          </p>
                        )}
                        {noLimite && item.quantidade === saldo && temLoteLivre && (
                          <p className="text-xs text-gray-500">
                            Lote no limite. Para vender mais, use "Dividir em outro lote".
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">Preço (R$/cx):</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.valorUnitario}
                            onChange={(e) =>
                              atualizar(index, { valorUnitario: Number(e.target.value) || 0 })
                            }
                            className={`w-24 rounded-lg border bg-white px-2 py-1 text-right text-sm ${item.valorUnitario > 0 ? 'border-gray-300' : 'border-amber-400'}`}
                          />
                          <span className="ml-auto text-xs font-semibold text-green-700">
                            = {formatBRL(item.quantidade * item.valorUnitario)}
                          </span>
                        </div>
                      </div>
                    )
                  })}

                  {linhas.length > 0 && temLoteLivre && (
                    <button
                      type="button"
                      onClick={() => adicionarLinha(p)}
                      className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-green-700"
                    >
                      <Plus className="w-3.5 h-3.5" /> Dividir em outro lote
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {(linhasSemLote || acimaDoSaldo) && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {linhasSemLote
                ? 'Selecione o lote de cada produto para continuar.'
                : 'Há lote com saldo insuficiente. Ajuste a quantidade ou escolha outro lote.'}
            </p>
          )}
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
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {FORMA_PAGAMENTO_LABEL[f]}
              </option>
            ))}
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

      <ClienteFormModal
        open={cadastrandoCliente}
        cliente={null}
        onClose={() => setCadastrandoCliente(false)}
        onSalvo={(cliente) => setClienteId(cliente.id)}
      />
    </Modal>
  )
}
