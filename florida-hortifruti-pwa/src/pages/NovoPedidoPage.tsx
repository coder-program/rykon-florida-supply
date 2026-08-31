import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Search, Plus, Minus, ChevronRight, ArrowLeft, Check } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { salvarRascunho, carregarRascunho, limparRascunho } from '../lib/draft'

type Etapa = 'cliente' | 'produtos' | 'extras' | 'confirmar'

interface Item {
  produtoId: string
  nome: string
  quantidade: number
  valorUnitario: number
}
interface DadosPedido {
  clienteId: string
  clienteNome: string
  itens: Item[]
  valorFrete: number
  freteInclusoNoPreco: boolean
  descontoValor: number
  descontoPercentual: number
  usarPercentual: boolean
  formaPagamento: string
  dataVencimento: string
  condicaoNegociada: string
  necessitaNF: boolean
  observacoes: string
}

interface NovoClienteForm {
  razaoSocialOuNome: string
  cnpjCpf: string
  telefone: string
}

type NovoClienteErros = Partial<Record<keyof NovoClienteForm, string>>

const VAZIO: DadosPedido = {
  clienteId: '',
  clienteNome: '',
  itens: [],
  valorFrete: 0,
  freteInclusoNoPreco: false,
  descontoValor: 0,
  descontoPercentual: 0,
  usarPercentual: false,
  formaPagamento: 'PIX',
  dataVencimento: '',
  condicaoNegociada: '',
  necessitaNF: false,
  observacoes: '',
}

function calcularTotais(d: DadosPedido) {
  const subtotal = d.itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0)
  const desconto = d.usarPercentual ? (subtotal * d.descontoPercentual) / 100 : d.descontoValor
  return { subtotal, desconto, total: subtotal + d.valorFrete - desconto }
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function isCpfValido(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^([0-9])\1{10}$/.test(digits)) return false

  const calc = (limite: number) => {
    let soma = 0
    for (let i = 0; i < limite; i += 1) soma += Number(digits[i]) * (limite + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10])
}

function isCnpjValido(digits: string) {
  if (!/^\d{14}$/.test(digits) || /^([0-9])\1{13}$/.test(digits)) return false

  const calc = (base: number[], pesos: number[]) => {
    const soma = base.reduce((acc, digit, index) => acc + digit * pesos[index], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const numeros = digits.split('').map(Number)
  const primeiro = calc(numeros.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = calc(numeros.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return primeiro === numeros[12] && segundo === numeros[13]
}

function isTelefoneValido(valor: string) {
  const digits = somenteDigitos(valor)
  if (digits.length < 10 || digits.length > 11) return false
  if (/^([0-9])\1+$/.test(digits)) return false
  return true
}

function validarNovoCliente(form: NovoClienteForm): NovoClienteErros {
  const erros: NovoClienteErros = {}
  const nome = form.razaoSocialOuNome.trim()
  const cnpjCpf = form.cnpjCpf.trim()
  const telefone = form.telefone.trim()

  if (!nome) {
    erros.razaoSocialOuNome = 'Informe o nome ou razão social.'
  } else if (nome.length < 3) {
    erros.razaoSocialOuNome = 'Use pelo menos 3 caracteres.'
  } else if (nome.length > 120) {
    erros.razaoSocialOuNome = 'Use no máximo 120 caracteres.'
  } else if (!/^[\p{L}\p{N} .,'&()\/-]+$/u.test(nome)) {
    erros.razaoSocialOuNome = 'Use apenas letras, números e sinais básicos.'
  }

  if (cnpjCpf) {
    const digits = somenteDigitos(cnpjCpf)
    if (
      !(digits.length === 11
        ? isCpfValido(digits)
        : digits.length === 14
          ? isCnpjValido(digits)
          : false)
    ) {
      erros.cnpjCpf = 'CPF ou CNPJ inválido.'
    }
  }

  if (!telefone) {
    erros.telefone = 'Informe o telefone.'
  } else if (!isTelefoneValido(telefone)) {
    erros.telefone = 'Telefone inválido.'
  }

  return erros
}

// ── Etapa 1: seleção de cliente ─────────────────────────────────────────────
function EtapaCliente({
  dados,
  onSelecionar,
  onNovo,
}: {
  dados: DadosPedido
  onSelecionar: (id: string, nome: string) => void
  onNovo: () => void
}) {
  const [busca, setBusca] = useState('')

  const { data: clientes = [], isFetching } = useQuery({
    queryKey: ['clientes-busca', busca],
    queryFn: () => api.get('/clientes', { params: busca ? { busca } : {} }).then((r) => r.data),
    staleTime: 0,
  })

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
            placeholder="Buscar por nome, CNPJ ou telefone..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <button
        onClick={onNovo}
        className="mx-4 mb-3 flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-green-700"
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium text-sm">Cadastrar novo cliente</span>
      </button>

      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        {isFetching && <p className="text-center py-6 text-gray-400 text-sm">Buscando...</p>}
        {clientes.map((c: any) => (
          <button
            key={c.id}
            onClick={() => onSelecionar(c.id, c.razaoSocialOuNome)}
            className={`w-full text-left bg-white rounded-xl px-4 py-3.5 border transition active:bg-green-50 ${
              dados.clienteId === c.id ? 'border-green-500 bg-green-50' : 'border-gray-100'
            }`}
          >
            <p className="font-semibold text-gray-900 text-sm">{c.razaoSocialOuNome}</p>
            {c.nomeFantasia && <p className="text-xs text-gray-400">{c.nomeFantasia}</p>}
            <p className="text-xs text-gray-500 mt-0.5">
              {c.cnpjCpf?.startsWith('SEM-DOC-') ? 'CPF/CNPJ não informado' : c.cnpjCpf}
              {c.cidade ? ` • ${c.cidade}` : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Etapa 2: seleção de produtos ────────────────────────────────────────────
function EtapaProdutos({ itens, onChange }: { itens: Item[]; onChange: (itens: Item[]) => void }) {
  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => r.data),
  })

  function getItem(id: string) {
    return itens.find((i) => i.produtoId === id)
  }

  function adicionar(p: any) {
    const existe = getItem(p.id)
    if (existe) {
      onChange(
        itens.map((i) => (i.produtoId === p.id ? { ...i, quantidade: i.quantidade + 1 } : i)),
      )
    } else {
      onChange([
        ...itens,
        { produtoId: p.id, nome: p.nome, quantidade: 1, valorUnitario: Number(p.precoSugerido) },
      ])
    }
  }

  function remover(id: string) {
    const item = getItem(id)
    if (!item) return
    if (item.quantidade <= 1) onChange(itens.filter((i) => i.produtoId !== id))
    else
      onChange(itens.map((i) => (i.produtoId === id ? { ...i, quantidade: i.quantidade - 1 } : i)))
  }

  function setPreco(id: string, v: string) {
    onChange(itens.map((i) => (i.produtoId === id ? { ...i, valorUnitario: Number(v) || 0 } : i)))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-4 space-y-3">
        {produtos.map((p: any) => {
          const item = getItem(p.id)
          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border px-4 py-3.5 transition ${item ? 'border-green-400' : 'border-gray-100'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{p.nome}</p>
                  <p className="text-xs text-gray-400">
                    {p.codigoInterno} • {p.unidadeVenda}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {item && (
                    <button
                      onClick={() => remover(p.id)}
                      className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                  {item && (
                    <span className="w-7 text-center font-bold text-gray-900">
                      {item.quantidade}
                    </span>
                  )}
                  <button
                    onClick={() => adicionar(p)}
                    className="w-8 h-8 bg-green-100 text-green-700 rounded-lg flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {item && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Preço unitário (R$):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={item.valorUnitario}
                    onChange={(e) => setPreco(p.id, e.target.value)}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-right focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <span className="text-xs font-semibold text-green-700 min-w-18 text-right">
                    = {formatBRL(item.quantidade * item.valorUnitario)}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {itens.length > 0 && (
        <div className="px-4 py-3 bg-green-50 border-t border-green-200">
          <p className="text-sm text-green-800">
            <span className="font-semibold">{itens.length} produto(s)</span> • Subtotal:{' '}
            <span className="font-bold">
              {formatBRL(itens.reduce((s, i) => s + i.quantidade * i.valorUnitario, 0))}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

// ── Etapa 3: frete, desconto, pagamento ─────────────────────────────────────
function EtapaExtras({
  dados,
  onChange,
}: {
  dados: DadosPedido
  onChange: (p: Partial<DadosPedido>) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-5">
      {/* Frete */}
      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Frete</h3>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600">Valor (R$)</label>
          <input
            type="number"
            step="0.01"
            value={dados.valorFrete || ''}
            onChange={(e) => onChange({ valorFrete: Number(e.target.value) })}
            placeholder="0,00"
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2.5 text-base text-right focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={dados.freteInclusoNoPreco}
            onChange={(e) => onChange({ freteInclusoNoPreco: e.target.checked })}
            className="accent-green-600 w-4 h-4"
          />
          Frete incluso no preço
        </label>
      </section>

      {/* Desconto */}
      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Desconto</h3>
        <div className="flex gap-2 text-sm">
          <button
            onClick={() => onChange({ usarPercentual: false })}
            className={`flex-1 py-2 rounded-lg font-medium transition ${!dados.usarPercentual ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            R$
          </button>
          <button
            onClick={() => onChange({ usarPercentual: true })}
            className={`flex-1 py-2 rounded-lg font-medium transition ${dados.usarPercentual ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
          >
            %
          </button>
        </div>
        {dados.usarPercentual ? (
          <input
            type="number"
            step="0.1"
            max="100"
            value={dados.descontoPercentual || ''}
            onChange={(e) => onChange({ descontoPercentual: Number(e.target.value) })}
            placeholder="0"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base text-right focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        ) : (
          <input
            type="number"
            step="0.01"
            value={dados.descontoValor || ''}
            onChange={(e) => onChange({ descontoValor: Number(e.target.value) })}
            placeholder="0,00"
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base text-right focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        )}
      </section>

      {/* Pagamento */}
      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Forma de Pagamento</h3>
        <div className="grid grid-cols-2 gap-2">
          {['PIX', 'BOLETO', 'DINHEIRO', 'OUTROS'].map((f) => (
            <button
              key={f}
              onClick={() => onChange({ formaPagamento: f })}
              className={`py-2.5 rounded-xl text-sm font-medium transition ${dados.formaPagamento === f ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}
            >
              {f}
            </button>
          ))}
        </div>
        {dados.formaPagamento === 'BOLETO' && (
          <div className="space-y-2">
            <label className="text-xs text-gray-500">Vencimento</label>
            <input
              type="date"
              value={dados.dataVencimento}
              onChange={(e) => onChange({ dataVencimento: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <input
              placeholder="Condição negociada (ex: 30 dias)"
              value={dados.condicaoNegociada}
              onChange={(e) => onChange({ condicaoNegociada: e.target.value })}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        )}
      </section>

      {/* NF + Observações */}
      <section className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
        <label className="flex items-center gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={dados.necessitaNF}
            onChange={(e) => onChange({ necessitaNF: e.target.checked })}
            className="accent-green-600 w-5 h-5"
          />
          <span>Necessita Nota Fiscal</span>
        </label>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Observações</label>
          <textarea
            rows={3}
            value={dados.observacoes}
            onChange={(e) => onChange({ observacoes: e.target.value })}
            placeholder="Horário de entrega, instruções especiais..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>
      </section>
    </div>
  )
}

// ── Etapa 4: confirmação ────────────────────────────────────────────────────
function EtapaConfirmar({ dados }: { dados: DadosPedido }) {
  const { subtotal, desconto, total } = calcularTotais(dados)

  return (
    <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4">
      <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Cliente</span>
          <span className="font-semibold">{dados.clienteNome}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Pagamento</span>
          <span>{dados.formaPagamento}</span>
        </div>
        {dados.dataVencimento && (
          <div className="flex justify-between">
            <span className="text-gray-500">Vencimento</span>
            <span>{dados.dataVencimento}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Nota Fiscal</span>
          <span>{dados.necessitaNF ? '✅ Sim' : 'Não'}</span>
        </div>
        {dados.observacoes && (
          <div className="flex justify-between gap-4">
            <span className="text-gray-500 shrink-0">Obs</span>
            <span className="text-right text-gray-700">{dados.observacoes}</span>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-500">PRODUTOS</p>
        </div>
        {dados.itens.map((i) => (
          <div key={i.produtoId} className="px-4 py-3 border-b border-gray-50 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-800 font-medium">{i.nome}</span>
              <span className="font-semibold">{formatBRL(i.quantidade * i.valorUnitario)}</span>
            </div>
            <p className="text-xs text-gray-400">
              {i.quantidade} cx × {formatBRL(i.valorUnitario)}
            </p>
          </div>
        ))}
        <div className="px-4 pt-3 pb-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span>{formatBRL(subtotal)}</span>
          </div>
          {dados.valorFrete > 0 && (
            <div className="flex justify-between text-gray-500">
              <span>Frete</span>
              <span>+{formatBRL(dados.valorFrete)}</span>
            </div>
          )}
          {desconto > 0 && (
            <div className="flex justify-between text-red-500">
              <span>Desconto</span>
              <span>-{formatBRL(desconto)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-100">
            <span>Total</span>
            <span className="text-green-700">{formatBRL(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────────────────
export function NovoPedidoPage() {
  const navigate = useNavigate()
  const [etapa, setEtapa] = useState<Etapa>('cliente')
  const [dados, setDados] = useState<DadosPedido>(() => carregarRascunho<DadosPedido>() ?? VAZIO)
  const [novoCliente, setNovoCliente] = useState(false)
  const [formCliente, setFormCliente] = useState<NovoClienteForm>({
    razaoSocialOuNome: '',
    cnpjCpf: '',
    telefone: '',
  })
  const [clienteTentouSalvar, setClienteTentouSalvar] = useState(false)
  const [clienteErroApi, setClienteErroApi] = useState('')
  const errosCliente = validarNovoCliente(formCliente)

  const patch = useCallback((partial: Partial<DadosPedido>) => {
    setDados((d) => {
      const next = { ...d, ...partial }
      salvarRascunho(next)
      return next
    })
  }, [])

  const criarCliente = useMutation({
    mutationFn: (d: any) => api.post('/clientes', d).then((r) => r.data),
    onSuccess: (c) => {
      patch({ clienteId: c.id, clienteNome: c.razaoSocialOuNome })
      setNovoCliente(false)
      setFormCliente({ razaoSocialOuNome: '', cnpjCpf: '', telefone: '' })
      setClienteTentouSalvar(false)
      setClienteErroApi('')
    },
    onError: (erro: any) => {
      const mensagem = erro?.response?.data?.message
      setClienteErroApi(
        Array.isArray(mensagem)
          ? mensagem.join(' ')
          : (mensagem ?? 'Não foi possível cadastrar o cliente.'),
      )
    },
  })

  const enviarPedido = useMutation({
    mutationFn: () =>
      api.post('/pedidos', {
        clienteId: dados.clienteId,
        itens: dados.itens.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          valorUnitario: i.valorUnitario,
        })),
        valorFrete: dados.valorFrete,
        freteInclusoNoPreco: dados.freteInclusoNoPreco,
        descontoValor: dados.usarPercentual ? 0 : dados.descontoValor,
        descontoPercentual: dados.usarPercentual ? dados.descontoPercentual : undefined,
        formaPagamento: dados.formaPagamento,
        dataVencimento: dados.dataVencimento || undefined,
        condicaoNegociada: dados.condicaoNegociada || undefined,
        necessitaNF: dados.necessitaNF,
        observacoes: dados.observacoes || undefined,
      }),
    onSuccess: () => {
      limparRascunho()
      navigate('/')
    },
  })

  const ETAPAS: Etapa[] = ['cliente', 'produtos', 'extras', 'confirmar']
  const ETAPA_LABEL: Record<Etapa, string> = {
    cliente: 'Cliente',
    produtos: 'Produtos',
    extras: 'Detalhes',
    confirmar: 'Confirmar',
  }
  const idx = ETAPAS.indexOf(etapa)

  function podeAvancar() {
    if (etapa === 'cliente') return !!dados.clienteId
    if (etapa === 'produtos') return dados.itens.length > 0
    return true
  }

  function abrirNovoCliente() {
    setNovoCliente(true)
    setFormCliente({ razaoSocialOuNome: '', cnpjCpf: '', telefone: '' })
    setClienteTentouSalvar(false)
    setClienteErroApi('')
  }

  function cancelarNovoCliente() {
    setNovoCliente(false)
    setFormCliente({ razaoSocialOuNome: '', cnpjCpf: '', telefone: '' })
    setClienteTentouSalvar(false)
    setClienteErroApi('')
  }

  function salvarNovoCliente() {
    setClienteTentouSalvar(true)
    const erros = validarNovoCliente(formCliente)
    if (Object.keys(erros).length > 0) return

    criarCliente.mutate({
      razaoSocialOuNome: formCliente.razaoSocialOuNome.trim(),
      cnpjCpf: formCliente.cnpjCpf.trim() || undefined,
      telefone: formCliente.telefone.trim(),
    })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* Navbar */}
      <div className="bg-green-600 px-4 pt-10 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => (idx > 0 ? setEtapa(ETAPAS[idx - 1]) : navigate('/'))}
            className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-white font-bold">Novo Pedido</h1>
        </div>
        {/* Progress */}
        <div className="flex gap-1">
          {ETAPAS.map((e, i) => (
            <div key={e} className="flex-1">
              <div
                className={`h-1 rounded-full transition-colors ${i <= idx ? 'bg-white' : 'bg-green-500'}`}
              />
              <p
                className={`text-xs mt-1 text-center ${i === idx ? 'text-white font-semibold' : 'text-green-300'}`}
              >
                {ETAPA_LABEL[e]}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Conteúdo da etapa */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {etapa === 'cliente' && !novoCliente && (
          <EtapaCliente
            dados={dados}
            onSelecionar={(id, nome) => patch({ clienteId: id, clienteNome: nome })}
            onNovo={abrirNovoCliente}
          />
        )}

        {etapa === 'cliente' && novoCliente && (
          <div className="p-4 space-y-3">
            <h2 className="font-semibold text-gray-800">Novo Cliente</h2>
            <div>
              <input
                placeholder="Nome / Razão Social *"
                value={formCliente.razaoSocialOuNome}
                maxLength={120}
                onChange={(e) => {
                  setClienteErroApi('')
                  setFormCliente((f) => ({ ...f, razaoSocialOuNome: e.target.value }))
                }}
                className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 ${clienteTentouSalvar && errosCliente.razaoSocialOuNome ? 'border-red-400' : 'border-gray-300'}`}
              />
              {clienteTentouSalvar && errosCliente.razaoSocialOuNome && (
                <p className="mt-1 text-xs text-red-600">{errosCliente.razaoSocialOuNome}</p>
              )}
            </div>
            <div>
              <input
                placeholder="CNPJ / CPF (opcional)"
                value={formCliente.cnpjCpf}
                maxLength={18}
                onChange={(e) => {
                  setClienteErroApi('')
                  setFormCliente((f) => ({ ...f, cnpjCpf: e.target.value }))
                }}
                className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 ${clienteTentouSalvar && errosCliente.cnpjCpf ? 'border-red-400' : 'border-gray-300'}`}
              />
              {clienteTentouSalvar && errosCliente.cnpjCpf && (
                <p className="mt-1 text-xs text-red-600">{errosCliente.cnpjCpf}</p>
              )}
            </div>
            <div>
              <input
                placeholder="Telefone *"
                value={formCliente.telefone}
                maxLength={20}
                onChange={(e) => {
                  setClienteErroApi('')
                  setFormCliente((f) => ({ ...f, telefone: e.target.value }))
                }}
                className={`w-full border rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500 ${clienteTentouSalvar && errosCliente.telefone ? 'border-red-400' : 'border-gray-300'}`}
              />
              {clienteTentouSalvar && errosCliente.telefone && (
                <p className="mt-1 text-xs text-red-600">{errosCliente.telefone}</p>
              )}
            </div>
            {clienteErroApi && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {clienteErroApi}
              </p>
            )}
            <p className="text-xs leading-relaxed text-gray-500">
              Nome com até 120 caracteres. CPF/CNPJ é opcional, mas precisa ser válido se informado.
              Telefone é obrigatório.
            </p>
            <div className="flex gap-2">
              <button
                onClick={cancelarNovoCliente}
                className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={salvarNovoCliente}
                disabled={criarCliente.isPending}
                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-medium disabled:opacity-50"
              >
                {criarCliente.isPending ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </div>
        )}

        {etapa === 'produtos' && (
          <EtapaProdutos itens={dados.itens} onChange={(itens) => patch({ itens })} />
        )}
        {etapa === 'extras' && <EtapaExtras dados={dados} onChange={patch} />}
        {etapa === 'confirmar' && <EtapaConfirmar dados={dados} />}
      </div>

      {/* Botão de avanço */}
      <div className="px-4 py-4 bg-white border-t border-gray-100">
        {etapa !== 'confirmar' ? (
          <button
            onClick={() => setEtapa(ETAPAS[idx + 1])}
            disabled={!podeAvancar()}
            className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition"
          >
            Continuar <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => enviarPedido.mutate()}
            disabled={enviarPedido.isPending}
            className="w-full py-4 bg-green-600 text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition"
          >
            {enviarPedido.isPending ? (
              'Enviando...'
            ) : (
              <>
                <Check className="w-5 h-5" /> Enviar Pedido
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
