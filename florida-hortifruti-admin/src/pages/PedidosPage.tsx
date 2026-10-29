import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search,
  ChevronDown,
  Printer,
  Pencil,
  Plus,
  FileSpreadsheet,
  FileText,
  Trash2,
  Check,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api, resolveAssetUrl } from '../lib/api'
import {
  formatBRL,
  formatDate,
  diaISO,
  hojeISO,
  STATUS_PEDIDO_LABEL,
  STATUS_PAGAMENTO_COLOR,
  statusPedidoVisivel,
  FORMA_PAGAMENTO_LABEL,
} from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { NovoPedidoModal } from './NovoPedidoModal'
import { MarcarEntregueModal } from '../components/MarcarEntregueModal'
import {
  RegistrarPagamentoModal,
  type PedidoPagamento,
} from '../components/RegistrarPagamentoModal'
import { RastreioLotesPedido } from './RastreioLotesPedido'
import { useAuth } from '../contexts/useAuth'

type LoteDisponivel = {
  id: string
  produtoId: string
  numero: string
  dataEntrada: string
  quantidadeDisponivel: number
}

// Total menos os pagamentos já registrados (parciais somados)
function saldoEmAberto(p: any) {
  const pago = (p.pagamentos ?? []).reduce((acc: number, pg: any) => acc + Number(pg.valor), 0)
  return Math.max(0, Number((Number(p.totalFinal) - pago).toFixed(2)))
}

function rotuloLote(l: { numero: string; dataEntrada: string }) {
  return `${new Date(l.dataEntrada).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} - lote ${l.numero}`
}

const STATUS_ACOES: Record<string, { label: string; next: string }[]> = {
  AGUARDANDO_APROVACAO: [
    { label: 'Aprovar', next: 'aprovar' },
    { label: 'Rejeitar pedido', next: 'rejeitar' },
    { label: 'Cancelar pedido', next: 'cancelar' },
  ],
  APROVADO: [
    { label: 'Pedido em Andamento', next: 'separacao' },
    { label: 'Cancelar pedido', next: 'cancelar' },
  ],
  EM_SEPARACAO: [
    { label: 'Pronto para entrega', next: 'pronto-para-entrega' },
    { label: 'Cancelar pedido', next: 'cancelar' },
  ],
  PRONTO_PARA_ENTREGA: [
    { label: 'Saiu para entrega', next: 'em-entrega' },
    { label: 'Cancelar pedido', next: 'cancelar' },
  ],
}

const STATUS_EDITAVEL = ['AGUARDANDO_APROVACAO']
// Pedido que já saiu do estoque e ainda não foi entregue
const STATUS_ENTREGAVEL = ['APROVADO', 'EM_SEPARACAO', 'PRONTO_PARA_ENTREGA', 'EM_ENTREGA']

type AcaoLote = 'aprovar' | 'entregue' | 'pago'

// Ações em lote: quem pode e em quais pedidos cada uma se aplica (a API confere de novo)
const ACOES_LOTE: Record<
  AcaoLote,
  { label: string; feito: string; papeis: string[]; aplica: (p: any) => boolean }
> = {
  aprovar: {
    label: 'Aprovar pedidos',
    feito: 'aprovado(s)',
    papeis: ['ADMINISTRADOR', 'ADMINISTRATIVO', 'SUPERVISOR'],
    aplica: (p) => p.status === 'AGUARDANDO_APROVACAO',
  },
  entregue: {
    label: 'Marcar como entregue',
    feito: 'marcado(s) como entregue',
    papeis: ['ADMINISTRADOR', 'ADMINISTRATIVO'],
    aplica: (p) => STATUS_ENTREGAVEL.includes(p.status),
  },
  pago: {
    label: 'Marcar como pago',
    feito: 'marcado(s) como pago',
    papeis: ['ADMINISTRADOR', 'ADMINISTRATIVO', 'SUPERVISOR'],
    aplica: (p) => p.statusPagamento !== 'PAGO' && !['CANCELADO', 'REJEITADO'].includes(p.status),
  },
}

function numeroPedido(p: { numero: number }) {
  return `#${String(p.numero).padStart(6, '0')}`
}
const STATUS_COM_ETIQUETA = [
  'APROVADO',
  'EM_SEPARACAO',
  'PRONTO_PARA_ENTREGA',
  'EM_ENTREGA',
  'ENTREGUE',
]
const STATUS_PODE_ATRIBUIR = ['APROVADO', 'EM_SEPARACAO', 'PRONTO_PARA_ENTREGA', 'EM_ENTREGA']

const DEVOL_LABEL: Record<string, string> = {
  PENDENTE: 'Pendente',
  CONCLUIDA: 'Concluída',
  NEGADA: 'Negada',
}

const DEVOL_COLOR: Record<string, string> = {
  PENDENTE: 'bg-amber-100 text-amber-800',
  CONCLUIDA: 'bg-emerald-100 text-emerald-700',
  NEGADA: 'bg-red-100 text-red-700',
}

function totalCaixasPedido(pedido: { itens?: { quantidade?: number }[] } | null) {
  const soma = (pedido?.itens ?? []).reduce(
    (acc, item) => acc + Math.round(Number(item.quantidade) || 0),
    0,
  )
  return Math.max(1, soma)
}

export function PedidosPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const podeExcluirPedido =
    usuario?.papel === 'ADMINISTRADOR' || usuario?.papel === 'ADMINISTRATIVO'
  // Admin/administrativo confirmam entrega sem foto; supervisor (que às vezes entrega) com foto
  const entregaSemFoto = podeExcluirPedido
  const podeMarcarEntregue = podeExcluirPedido || usuario?.papel === 'SUPERVISOR'
  const [entregando, setEntregando] = useState<{ id: string; numero: number } | null>(null)
  const acoesLote = (Object.keys(ACOES_LOTE) as AcaoLote[]).filter((a) =>
    ACOES_LOTE[a].papeis.includes(usuario?.papel ?? ''),
  )
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [acaoEscolhida, setAcaoLote] = useState<AcaoLote | ''>('')
  const [dataPagamentoLote, setDataPagamentoLote] = useState(hojeISO)
  const [executandoLote, setExecutandoLote] = useState(false)
  const [resultadoLote, setResultadoLote] = useState<{
    feitos: string[]
    pulados: string[]
    erros: string[]
    acao: AcaoLote
  } | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any>(null)
  const [confirmarAcao, setConfirmarAcao] = useState<'cancelar' | 'rejeitar' | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')
  const [carregandoPedidoDetalhe, setCarregandoPedidoDetalhe] = useState(false)
  const [novoPedido, setNovoPedido] = useState(false)
  const [pagando, setPagando] = useState<PedidoPagamento | null>(null)
  const [entregadorId, setEntregadorId] = useState('')
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState({
    dataPedido: '',
    valorFrete: '',
    descontoValor: '',
    formaPagamento: '',
    dataVencimento: '',
    necessitaNF: false,
    observacoes: '',
    itens: [] as {
      produtoId: string
      loteId: string
      nome: string
      quantidade: number
      valorUnitario: number
    }[],
  })

  // Lotes com saldo, para escolher (ou dividir) o lote de cada produto antes de aprovar
  const { data: lotesDisponiveis = [] } = useQuery<LoteDisponivel[]>({
    queryKey: ['lotes-disponiveis'],
    queryFn: () => api.get('/estoque/lotes/disponiveis').then((r) => r.data),
    enabled: editando,
  })

  // Pedido pendente já tirou do lote as caixas dele (a baixa é no lançamento): na edição,
  // essas caixas contam como disponíveis para o próprio pedido
  function baixadoPeloPedido(loteId: string) {
    if (!loteId || pedidoSelecionado?.status !== 'AGUARDANDO_APROVACAO') return 0
    return (pedidoSelecionado.itens ?? [])
      .filter((i: any) => i.loteId === loteId)
      .reduce((acc: number, i: any) => acc + Number(i.quantidade), 0)
  }

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos', filtroStatus],
    queryFn: () =>
      api
        .get('/pedidos', { params: filtroStatus ? { status: filtroStatus } : {} })
        .then((r) => r.data),
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios-motoristas'],
    queryFn: () => api.get('/usuarios/motoristas').then((r) => r.data),
  })
  // Entregadores: motoristas e supervisores (às vezes fazem entregas)
  const motoristas = (usuarios as any[]).filter(
    (u) => (u.papel === 'MOTORISTA' || u.papel === 'SUPERVISOR') && u.ativo,
  )

  // Vindo do QR da etiqueta (/abrir-pedido/:token): abre o detalhe do pedido direto
  const [searchParams, setSearchParams] = useSearchParams()
  const pedidoDaUrl = searchParams.get('pedido')
  useEffect(() => {
    if (!pedidoDaUrl) return
    setSearchParams({}, { replace: true })
    void abrirPedido({ id: pedidoDaUrl })
  }, [pedidoDaUrl])

  async function abrirPedido(p: any) {
    setPedidoSelecionado(p)
    setEntregadorId(p.entregadorId ?? p.entregador?.id ?? '')
    setCarregandoPedidoDetalhe(true)
    try {
      const detalhe = await api.get(`/pedidos/${p.id}`).then((r) => r.data)
      setPedidoSelecionado(detalhe)
      setEntregadorId(detalhe.entregadorId ?? detalhe.entregador?.id ?? '')
    } finally {
      setCarregandoPedidoDetalhe(false)
    }
  }

  const mudarStatus = useMutation({
    mutationFn: ({ id, acao, body }: { id: string; acao: string; body?: any }) =>
      api.post(`/pedidos/${id}/${acao}`, body),
    onSuccess: (res, { acao }) => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      if (acao === 'aprovar') {
        const payload = res.data
        setPedidoSelecionado((prev: any) =>
          prev
            ? {
                ...prev,
                ...(payload.pedido ?? {}),
                etiqueta: payload.etiqueta ?? prev.etiqueta,
                status: payload.pedido?.status ?? 'APROVADO',
              }
            : prev,
        )
        return
      }
      if (acao === 'atribuir') {
        setPedidoSelecionado(res.data)
        setEntregadorId(res.data.entregadorId ?? res.data.entregador?.id ?? entregadorId)
        return
      }
      setPedidoSelecionado(null)
    },
  })

  // Exclusão definitiva: a API só aceita pedido CANCELADO
  const excluirPedido = useMutation({
    mutationFn: (id: string) => api.delete(`/pedidos/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setPedidoSelecionado(null)
    },
  })

  const gerarEtiqueta = useMutation({
    mutationFn: (pedidoId: string) => api.post(`/etiquetas/pedido/${pedidoId}`),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      const etiqueta = res.data
      setPedidoSelecionado((prev: any) => (prev ? { ...prev, etiqueta } : prev))
      navigate(`/etiqueta/${etiqueta.id}`)
    },
  })

  const editarPedido = useMutation({
    mutationFn: (d: any) => api.patch(`/pedidos/${pedidoSelecionado.id}`, d),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      setEditando(false)
      setPedidoSelecionado(res.data)
    },
  })

  function abrirEdicao(p: any) {
    setFormEdit({
      dataPedido: diaISO(p.data),
      valorFrete: String(Number(p.valorFrete) || ''),
      descontoValor: String(Number(p.descontoValor) || ''),
      formaPagamento: p.formaPagamento,
      dataVencimento: p.dataVencimento
        ? new Date(p.dataVencimento).toISOString().split('T')[0]
        : '',
      necessitaNF: p.necessitaNF,
      observacoes: p.observacoes ?? '',
      itens: (p.itens ?? []).map((i: any) => ({
        produtoId: i.produtoId,
        loteId: i.loteId ?? '',
        nome: i.produto?.nome ?? '',
        quantidade: Math.max(1, Math.round(Number(i.quantidade) || 0)),
        valorUnitario: Number(i.valorUnitario),
      })),
    })
    setEditando(true)
  }

  function alterarItem(index: number, patch: Partial<(typeof formEdit.itens)[number]>) {
    setFormEdit((f) => ({
      ...f,
      itens: f.itens.map((item, idx) => (idx === index ? { ...item, ...patch } : item)),
    }))
  }

  function alterarQtdItem(index: number, delta: number) {
    const item = formEdit.itens[index]
    alterarItem(index, { quantidade: Math.max(1, item.quantidade + delta) })
  }

  // Divide o produto em mais uma linha, para o usuário escolher outro lote
  function dividirItem(index: number) {
    const item = formEdit.itens[index]
    setFormEdit((f) => ({
      ...f,
      itens: [
        ...f.itens.slice(0, index + 1),
        { ...item, loteId: '', quantidade: 1 },
        ...f.itens.slice(index + 1),
      ],
    }))
  }

  function removerItem(index: number) {
    setFormEdit((f) => ({ ...f, itens: f.itens.filter((_, idx) => idx !== index) }))
  }

  const pedidosFiltrados = pedidos.filter(
    (p: any) =>
      !busca ||
      p.numero?.toString().includes(busca) ||
      p.cliente?.razaoSocialOuNome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.vendedor?.nome?.toLowerCase().includes(busca.toLowerCase()),
  )

  // Só conta o que está visível na lista (filtro/busca)
  const selecionadosVisiveis = pedidosFiltrados.filter((p: any) => selecionados.has(p.id))
  const todosSelecionados =
    pedidosFiltrados.length > 0 && selecionadosVisiveis.length === pedidosFiltrados.length
  // Só oferece a ação que vale para pelo menos um dos selecionados
  // (ex.: todos já pagos -> não aparece "Marcar como pago")
  const acoesDisponiveis = acoesLote.filter((a) => selecionadosVisiveis.some(ACOES_LOTE[a].aplica))
  const acaoLote = acaoEscolhida && acoesDisponiveis.includes(acaoEscolhida) ? acaoEscolhida : ''

  function alternarSelecao(id: string) {
    setSelecionados((atual) => {
      const novo = new Set(atual)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  function alternarTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(pedidosFiltrados.map((p: any) => p.id)))
  }

  // Um pedido por vez: erro em um não trava os outros; no fim mostra o resumo
  async function executarLote() {
    if (!acaoLote) return
    const regra = ACOES_LOTE[acaoLote]
    const aplicaveis = selecionadosVisiveis.filter(regra.aplica)
    const pulados = selecionadosVisiveis.filter((p: any) => !regra.aplica(p)).map(numeroPedido)
    const feitos: string[] = []
    const erros: string[] = []
    setExecutandoLote(true)
    for (const p of aplicaveis) {
      try {
        if (acaoLote === 'aprovar') await api.post(`/pedidos/${p.id}/aprovar`)
        if (acaoLote === 'entregue') await api.post(`/pedidos/${p.id}/entregue`, {})
        if (acaoLote === 'pago')
          await api.post(`/financeiro/marcar-pago/${p.id}`, { data: dataPagamentoLote })
        feitos.push(numeroPedido(p))
      } catch (erro: any) {
        const msg = erro?.response?.data?.message
        erros.push(`${numeroPedido(p)}: ${Array.isArray(msg) ? msg.join(' ') : (msg ?? 'falhou')}`)
      }
    }
    setExecutandoLote(false)
    qc.invalidateQueries({ queryKey: ['pedidos'] })
    qc.invalidateQueries({ queryKey: ['contas-a-receber'] })
    qc.invalidateQueries({ queryKey: ['financeiro-resumo'] })
    qc.invalidateQueries({ queryKey: ['lotes-disponiveis'] })
    setSelecionados(new Set())
    setResultadoLote({ feitos, pulados, erros, acao: acaoLote })
  }

  function formatarDataArquivo() {
    return new Date().toISOString().slice(0, 10)
  }

  async function exportarExcel() {
    const linhas = pedidosFiltrados.map((p: any) => ({
      'Nº Pedido': p.numero ?? '',
      Data: p.data ? formatDate(p.data) : '',
      Cliente: p.cliente?.razaoSocialOuNome ?? '',
      Vendedor: p.vendedor?.nome ?? '',
      Status: STATUS_PEDIDO_LABEL[p.status] ?? p.status,
      Pagamento: FORMA_PAGAMENTO_LABEL[p.formaPagamento] ?? p.formaPagamento,
      'Necessita NF': p.necessitaNF ? 'Sim' : 'Não',
      Total: Number(p.totalFinal ?? 0),
    }))

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Pedidos')
    worksheet.columns = [
      { header: 'Nº Pedido', key: 'Nº Pedido', width: 14 },
      { header: 'Data', key: 'Data', width: 16 },
      { header: 'Cliente', key: 'Cliente', width: 28 },
      { header: 'Vendedor', key: 'Vendedor', width: 20 },
      { header: 'Status', key: 'Status', width: 22 },
      { header: 'Pagamento', key: 'Pagamento', width: 18 },
      { header: 'Necessita NF', key: 'Necessita NF', width: 16 },
      { header: 'Total', key: 'Total', width: 16 },
    ]
    worksheet.addRows(linhas)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pedidos-${formatarDataArquivo()}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Relatório de Pedidos', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Nº', 'Cliente', 'Vendedor', 'Status', 'Pagamento', 'NF', 'Total']],
      body: pedidosFiltrados.map((p: any) => [
        `#${String(p.numero ?? '').padStart(6, '0')}`,
        p.cliente?.razaoSocialOuNome ?? '',
        p.vendedor?.nome ?? '',
        STATUS_PEDIDO_LABEL[p.status] ?? p.status,
        FORMA_PAGAMENTO_LABEL[p.formaPagamento] ?? p.formaPagamento,
        p.necessitaNF ? 'Sim' : 'Não',
        formatBRL(p.totalFinal),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74] },
      margin: { left: 10, right: 10 },
    })

    doc.save(`pedidos-${formatarDataArquivo()}.pdf`)
  }

  return (
    <div>
      <PageHeader
        title="Pedidos"
        subtitle={`${pedidos.length} pedido(s) encontrado(s)`}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={exportarExcel}
              disabled={pedidosFiltrados.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button
              variant="secondary"
              onClick={exportarPdf}
              disabled={pedidosFiltrados.length === 0}
            >
              <FileText className="w-4 h-4" /> Exportar PDF
            </Button>
            <Button onClick={() => setNovoPedido(true)}>
              <Plus className="w-4 h-4" /> Novo Pedido
            </Button>
          </div>
        }
      />
      <NovoPedidoModal open={novoPedido} onClose={() => setNovoPedido(false)} />

      <div className="space-y-4 p-4 md:p-6">
        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por número, cliente ou vendedor..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <Select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(STATUS_PEDIDO_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {acoesLote.length > 0 && selecionadosVisiveis.length > 0 && (
          <div className="flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50 p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <p className="text-sm font-semibold text-gray-800 sm:self-center">
              {selecionadosVisiveis.length} pedido(s) selecionado(s)
            </p>
            {acoesDisponiveis.length > 0 ? (
              <div className="w-full sm:w-64">
                <Select
                  label="Selecione uma ação"
                  value={acaoLote}
                  onChange={(e) => setAcaoLote(e.target.value as AcaoLote | '')}
                >
                  <option value="">Selecione</option>
                  {acoesDisponiveis.map((a) => (
                    <option key={a} value={a}>
                      {ACOES_LOTE[a].label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-sm text-gray-600 sm:self-center">
                Nenhuma ação disponível para os pedidos selecionados.
              </p>
            )}
            {acaoLote === 'pago' && (
              <div className="w-full sm:w-48">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Data do pagamento
                </label>
                <input
                  type="date"
                  value={dataPagamentoLote}
                  max={hojeISO()}
                  onChange={(e) => setDataPagamentoLote(e.target.value)}
                  className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm"
                />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                onClick={executarLote}
                disabled={
                  !acaoLote || executandoLote || (acaoLote === 'pago' && !dataPagamentoLote)
                }
              >
                <Check className="w-4 h-4" /> {executandoLote ? 'Processando...' : 'Confirmar'}
              </Button>
              <Button variant="secondary" onClick={() => setSelecionados(new Set())}>
                Limpar
              </Button>
            </div>
            {acaoLote && (
              <p className="w-full text-xs text-gray-600">
                {selecionadosVisiveis.filter(ACOES_LOTE[acaoLote].aplica).length} de{' '}
                {selecionadosVisiveis.length} pedido(s) podem receber esta ação; os demais serão
                ignorados pelo status atual.
              </p>
            )}
          </div>
        )}

        <div className="space-y-3 md:hidden">
          {isLoading && (
            <p className="brand-loading py-8 text-center text-sm text-gray-400">Carregando...</p>
          )}
          {!isLoading && pedidosFiltrados.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum pedido encontrado</p>
          )}
          {pedidosFiltrados.map((p: any) => (
            <div key={p.id} className="flex items-start gap-2">
              {acoesLote.length > 0 && (
                <input
                  type="checkbox"
                  checked={selecionados.has(p.id)}
                  onChange={() => alternarSelecao(p.id)}
                  className="mt-5 h-5 w-5 shrink-0 accent-green-600"
                  aria-label={`Selecionar pedido ${numeroPedido(p)}`}
                />
              )}
              <button
                type="button"
                onClick={() => abrirPedido(p)}
                className={`w-full rounded-xl border bg-white p-4 text-left ${selecionados.has(p.id) ? 'border-green-400' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      #{String(p.numero).padStart(6, '0')}
                    </p>
                    <p className="text-sm text-gray-700">{p.cliente?.razaoSocialOuNome}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {formatDate(p.data)} · {p.vendedor?.nome}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-900">
                    {formatBRL(p.totalFinal)}
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge className={statusPedidoVisivel(p).className}>
                    {statusPedidoVisivel(p).label}
                  </Badge>
                  <Badge className={STATUS_PAGAMENTO_COLOR[p.statusPagamento]}>
                    {p.statusPagamento?.replace('_', ' ')}
                  </Badge>
                  <Badge
                    className={
                      p.necessitaNF ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-700'
                    }
                  >
                    {p.necessitaNF ? 'NF: Sim' : 'NF: Não'}
                  </Badge>
                </div>
              </button>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {acoesLote.length > 0 && (
                    <th className="w-10 pl-4 py-3">
                      <input
                        type="checkbox"
                        checked={todosSelecionados}
                        onChange={alternarTodos}
                        className="h-4 w-4 accent-green-600"
                        aria-label="Selecionar todos"
                      />
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Nº / Data
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Vendedor
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Pagamento
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">NF</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && pedidosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400">
                      Nenhum pedido encontrado
                    </td>
                  </tr>
                )}
                {pedidosFiltrados.map((p: any) => (
                  <tr
                    key={p.id}
                    className={selecionados.has(p.id) ? 'bg-green-50/60' : 'hover:bg-gray-50'}
                  >
                    {acoesLote.length > 0 && (
                      <td className="w-10 pl-4 py-3">
                        <input
                          type="checkbox"
                          checked={selecionados.has(p.id)}
                          onChange={() => alternarSelecao(p.id)}
                          className="h-4 w-4 accent-green-600"
                          aria-label={`Selecionar pedido ${numeroPedido(p)}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        #{String(p.numero).padStart(6, '0')}
                      </p>
                      <p className="text-xs text-gray-400">{formatDate(p.data)}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-45 truncate">
                      {p.cliente?.razaoSocialOuNome}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.vendedor?.nome}</td>
                    <td className="px-4 py-3">
                      <Badge className={statusPedidoVisivel(p).className}>
                        {statusPedidoVisivel(p).label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-600">
                        {FORMA_PAGAMENTO_LABEL[p.formaPagamento]}
                      </p>
                      <Badge className={`mt-0.5 ${STATUS_PAGAMENTO_COLOR[p.statusPagamento]}`}>
                        {p.statusPagamento?.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={
                          p.necessitaNF
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                        }
                      >
                        {p.necessitaNF ? 'Sim' : 'Não'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {formatBRL(p.totalFinal)}
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" onClick={() => abrirPedido(p)}>
                        <ChevronDown className="w-3.5 h-3.5" /> Ações
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>

      {/* Modal de detalhe + ações */}
      <Modal
        open={!!pedidoSelecionado}
        onClose={() => setPedidoSelecionado(null)}
        title={`Pedido #${String(pedidoSelecionado?.numero ?? '').padStart(6, '0')}`}
        size="lg"
      >
        {pedidoSelecionado && (
          <div className="space-y-4">
            <Badge className={statusPedidoVisivel(pedidoSelecionado).className}>
              {statusPedidoVisivel(pedidoSelecionado).label}
            </Badge>
            {(pedidoSelecionado.entregueEm ||
              pedidoSelecionado.recebidoPor ||
              pedidoSelecionado.fotoEntrega) && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm space-y-1">
                <p className="text-xs font-semibold text-gray-500">Comprovante de entrega</p>
                {pedidoSelecionado.entregueEm && (
                  <p>
                    <span className="text-gray-500">Quando: </span>
                    {formatDate(pedidoSelecionado.entregueEm)}
                  </p>
                )}
                {pedidoSelecionado.recebidoPor && (
                  <p>
                    <span className="text-gray-500">Recebido por: </span>
                    {pedidoSelecionado.recebidoPor}
                  </p>
                )}
                {pedidoSelecionado.observacaoEntrega && (
                  <p>
                    <span className="text-gray-500">Obs.: </span>
                    {pedidoSelecionado.observacaoEntrega}
                  </p>
                )}
                {pedidoSelecionado.fotoEntrega && (
                  <img
                    src={resolveAssetUrl(pedidoSelecionado.fotoEntrega)}
                    alt="Foto da entrega"
                    className="mt-2 max-h-56 w-full rounded-lg object-contain bg-white"
                  />
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 sm:gap-4">
              <div>
                <span className="text-gray-500">Cliente:</span>{' '}
                <strong>{pedidoSelecionado.cliente?.razaoSocialOuNome}</strong>
              </div>
              <div>
                <span className="text-gray-500">Vendedor:</span>{' '}
                <strong>{pedidoSelecionado.vendedor?.nome}</strong>
              </div>
              <div>
                <span className="text-gray-500">Data:</span> {formatDate(pedidoSelecionado.data)}
              </div>
              <div>
                <span className="text-gray-500">Pagamento:</span>{' '}
                {FORMA_PAGAMENTO_LABEL[pedidoSelecionado.formaPagamento]}
              </div>
              <div className="col-span-2 flex flex-wrap items-center gap-2">
                <span className="text-gray-500">Situação:</span>
                <Badge className={STATUS_PAGAMENTO_COLOR[pedidoSelecionado.statusPagamento]}>
                  {pedidoSelecionado.statusPagamento?.replace('_', ' ')}
                </Badge>
                {pedidoSelecionado.statusPagamento === 'PAGO' &&
                  pedidoSelecionado.pagamentos?.length > 0 && (
                    <span className="text-xs text-gray-500">
                      em {formatDate(pedidoSelecionado.pagamentos.at(-1).data)}
                    </span>
                  )}
                {pedidoSelecionado.statusPagamento !== 'PAGO' &&
                  !['CANCELADO', 'REJEITADO'].includes(pedidoSelecionado.status) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        setPagando({
                          id: pedidoSelecionado.id,
                          numero: pedidoSelecionado.numero,
                          totalFinal: pedidoSelecionado.totalFinal,
                          saldoDevedor: saldoEmAberto(pedidoSelecionado),
                        })
                      }
                    >
                      Registrar pagamento
                    </Button>
                  )}
              </div>
              <div>
                <span className="text-gray-500">Nota fiscal:</span>{' '}
                <strong>{pedidoSelecionado.necessitaNF ? 'Sim' : 'Não'}</strong>
              </div>
              {pedidoSelecionado.observacoes && (
                <div className="col-span-2">
                  <span className="text-gray-500">Obs:</span> {pedidoSelecionado.observacoes}
                </div>
              )}
            </div>

            {((pedidoSelecionado.devolucoes as any[] | undefined)?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
                  HISTÓRICO DE DEVOLUÇÕES
                </div>
                <div className="divide-y divide-gray-100">
                  {(pedidoSelecionado.devolucoes as any[]).map((d) => (
                    <div key={d.id} className="px-3 py-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-gray-800">
                          {new Date(d.data).toLocaleDateString('pt-BR')} · Etiqueta{' '}
                          {d.etiquetaToken ?? '—'}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${DEVOL_COLOR[d.status] ?? 'bg-gray-100 text-gray-700'}`}
                        >
                          {DEVOL_LABEL[d.status] ?? d.status}
                        </span>
                      </div>
                      {d.itensDevolvidos && (
                        <p className="mt-1 text-xs text-gray-600">{d.itensDevolvidos}</p>
                      )}
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        {d.quantidadeCaixas ? <span>Caixas: {d.quantidadeCaixas}</span> : null}
                        {d.valorDevolucao ? (
                          <span>Valor: {formatBRL(d.valorDevolucao)}</span>
                        ) : null}
                        <span>Fotos: {Array.isArray(d.fotos) ? d.fotos.length : 0}</span>
                      </div>
                      {Array.isArray(d.fotos) && d.fotos.length > 0 && (
                        <div className="mt-2 flex gap-1.5">
                          {d.fotos.slice(0, 3).map((foto: string) => {
                            const fotoUrl = resolveAssetUrl(foto)
                            return (
                              <a
                                key={foto}
                                href={fotoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block"
                              >
                                <img
                                  src={fotoUrl}
                                  alt="Foto da devolução"
                                  className="h-9 w-9 rounded-md border border-gray-200 object-cover"
                                />
                              </a>
                            )
                          })}
                        </div>
                      )}
                      {d.observacao && (
                        <p className="mt-1 text-xs text-gray-600">Obs.: {d.observacao}</p>
                      )}
                      {d.resposta && (
                        <p className="mt-1 text-xs text-gray-600">Resposta: {d.resposta}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {carregandoPedidoDetalhe && (
              <p className="text-xs text-gray-400">Atualizando detalhes do pedido...</p>
            )}

            {/* Itens */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-105 text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                      Produto
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Qtd</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                      Unitário
                    </th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pedidoSelecionado.itens?.map((i: any) => (
                    <tr key={i.id}>
                      <td className="px-3 py-2">
                        {i.produto?.nome}
                        {i.lote && (
                          <p className="text-xs text-gray-500">
                            {formatDate(i.lote.dataEntrada).slice(0, 5)} - lote {i.lote.numero}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">{Number(i.quantidade).toFixed(0)} cx</td>
                      <td className="px-3 py-2 text-right">{formatBRL(i.valorUnitario)}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatBRL(i.valorTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 text-sm">
                  <tr>
                    <td colSpan={3} className="px-3 py-1.5 text-right text-gray-500">
                      Subtotal
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {formatBRL(pedidoSelecionado.subtotal)}
                    </td>
                  </tr>
                  {Number(pedidoSelecionado.valorFrete) > 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-1 text-right text-gray-500">
                        Frete
                      </td>
                      <td className="px-3 py-1 text-right">
                        +{formatBRL(pedidoSelecionado.valorFrete)}
                      </td>
                    </tr>
                  )}
                  {Number(pedidoSelecionado.descontoValor) > 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-1 text-right text-gray-500">
                        Desconto
                      </td>
                      <td className="px-3 py-1 text-right text-red-600">
                        -{formatBRL(pedidoSelecionado.descontoValor)}
                      </td>
                    </tr>
                  )}
                  <tr className="font-bold">
                    <td colSpan={3} className="px-3 py-2 text-right">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right text-green-700">
                      {formatBRL(pedidoSelecionado.totalFinal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {pedidoSelecionado.status === 'AGUARDANDO_APROVACAO' &&
              pedidoSelecionado.itens?.some((i: any) => !i.loteId) && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Há produto sem lote. Use "Editar Pedido" e selecione o lote antes de aprovar.
                </p>
              )}

            {!['AGUARDANDO_APROVACAO', 'REJEITADO'].includes(pedidoSelecionado.status) && (
              <RastreioLotesPedido pedidoId={pedidoSelecionado.id} />
            )}

            {/* Edição antes de aprovar */}
            {STATUS_EDITAVEL.includes(pedidoSelecionado.status) && !editando && (
              <div className="pt-2 border-t border-gray-100">
                <Button variant="secondary" onClick={() => abrirEdicao(pedidoSelecionado)}>
                  <Pencil className="w-3.5 h-3.5" /> Editar Pedido
                </Button>
              </div>
            )}

            {editando && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const { dataPedido, ...resto } = formEdit
                  editarPedido.mutate({
                    ...resto,
                    // Só manda a data quando mudou, para não mexer no horário do pedido
                    data:
                      dataPedido && dataPedido !== diaISO(pedidoSelecionado.data)
                        ? dataPedido
                        : undefined,
                    valorFrete: Number(formEdit.valorFrete),
                    descontoValor: Number(formEdit.descontoValor),
                    itens: formEdit.itens.map((i) => ({
                      produtoId: i.produtoId,
                      loteId: i.loteId || null,
                      quantidade: i.quantidade,
                      valorUnitario: i.valorUnitario,
                    })),
                  })
                }}
                className="pt-2 border-t border-gray-100 space-y-3"
              >
                <p className="text-xs font-semibold text-gray-500 uppercase">Editar Pedido</p>
                <p className="text-xs text-gray-500">
                  Depois da aprovação, mudanças de quantidade entram em Solicitações de Alteração.
                </p>
                <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-medium text-gray-600">Lote e quantidade (caixas)</p>
                  {formEdit.itens.map((item, index) => {
                    const linhasProduto = formEdit.itens.filter(
                      (i) => i.produtoId === item.produtoId,
                    )
                    const usados = new Set(
                      linhasProduto.filter((i) => i !== item).map((i) => i.loteId),
                    )
                    const opcoes = lotesDisponiveis.filter(
                      (l) => l.produtoId === item.produtoId && !usados.has(l.id),
                    )
                    // Lote já escolhido mas sem saldo hoje continua aparecendo
                    const atualForaDaLista =
                      item.loteId && !opcoes.some((l) => l.id === item.loteId)
                    const noLote = lotesDisponiveis.find((l) => l.id === item.loteId)
                    const doPedido = baixadoPeloPedido(item.loteId)
                    const saldo =
                      noLote || doPedido > 0
                        ? (noLote?.quantidadeDisponivel ?? 0) + doPedido
                        : undefined
                    return (
                      <div
                        key={index}
                        className="space-y-1.5 border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="min-w-0 truncate text-sm text-gray-800">{item.nome}</p>
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => alterarQtdItem(index, -1)}
                              disabled={item.quantidade <= 1}
                            >
                              −
                            </Button>
                            <span className="w-8 text-center text-sm font-semibold">
                              {item.quantidade}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => alterarQtdItem(index, 1)}
                            >
                              +
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={item.loteId}
                            onChange={(e) => alterarItem(index, { loteId: e.target.value })}
                            className={`min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm ${item.loteId ? 'border-gray-300' : 'border-amber-400'}`}
                          >
                            <option value="">Selecione o lote</option>
                            {atualForaDaLista && (
                              <option value={item.loteId}>
                                {doPedido > 0
                                  ? `Lote atual • ${doPedido} cx`
                                  : 'Lote atual (sem saldo)'}
                              </option>
                            )}
                            {opcoes.map((l) => (
                              <option key={l.id} value={l.id}>
                                {rotuloLote(l)} • {l.quantidadeDisponivel + baixadoPeloPedido(l.id)}{' '}
                                cx
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => dividirItem(index)}
                          >
                            Dividir lote
                          </Button>
                          {linhasProduto.length > 1 && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removerItem(index)}
                            >
                              Remover
                            </Button>
                          )}
                        </div>
                        {item.loteId && saldo != null && item.quantidade > saldo && (
                          <p className="text-xs text-red-600">
                            Saldo insuficiente: o lote tem {saldo} cx. Selecione outro lote ou
                            divida.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
                {editarPedido.isError && (
                  <p className="text-xs text-red-600">
                    {Array.isArray((editarPedido.error as any)?.response?.data?.message)
                      ? (editarPedido.error as any).response.data.message.join(' ')
                      : ((editarPedido.error as any)?.response?.data?.message ??
                        'Não foi possível salvar o pedido.')}
                  </p>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Frete (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formEdit.valorFrete}
                      onChange={(e) => setFormEdit((f) => ({ ...f, valorFrete: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Desconto (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formEdit.descontoValor}
                      onChange={(e) =>
                        setFormEdit((f) => ({ ...f, descontoValor: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Data do pedido
                  </label>
                  <input
                    type="date"
                    value={formEdit.dataPedido}
                    max={hojeISO()}
                    required
                    onChange={(e) => setFormEdit((f) => ({ ...f, dataPedido: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Pagamento
                    </label>
                    <select
                      value={formEdit.formaPagamento}
                      onChange={(e) =>
                        setFormEdit((f) => ({ ...f, formaPagamento: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {['PIX', 'BOLETO', 'DINHEIRO', 'OUTROS'].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Vencimento
                    </label>
                    <input
                      type="date"
                      value={formEdit.dataVencimento}
                      onChange={(e) =>
                        setFormEdit((f) => ({ ...f, dataVencimento: e.target.value }))
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Observações
                  </label>
                  <textarea
                    rows={2}
                    value={formEdit.observacoes}
                    onChange={(e) => setFormEdit((f) => ({ ...f, observacoes: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formEdit.necessitaNF}
                    onChange={(e) => setFormEdit((f) => ({ ...f, necessitaNF: e.target.checked }))}
                    className="accent-green-600"
                  />
                  Necessita Nota Fiscal
                </label>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => setEditando(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={editarPedido.isPending}>
                    {editarPedido.isPending ? 'Salvando...' : 'Salvar Alterações'}
                  </Button>
                </div>
              </form>
            )}

            {/* Ações disponíveis */}
            {mudarStatus.isError && (
              <p className="text-xs text-red-600">
                {Array.isArray((mudarStatus.error as any)?.response?.data?.message)
                  ? (mudarStatus.error as any).response.data.message.join(' ')
                  : ((mudarStatus.error as any)?.response?.data?.message ??
                    'Não foi possível atualizar o pedido.')}
              </p>
            )}
            {pedidoSelecionado.aguardandoAlteracao && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Ações bloqueadas até a solicitação ser aprovada ou negada.{' '}
                <button
                  type="button"
                  className="font-medium underline"
                  onClick={() => navigate('/solicitacoes')}
                >
                  Ir para Solicitações de Alteração
                </button>
              </div>
            )}
            {STATUS_PODE_ATRIBUIR.includes(pedidoSelecionado.status) && (
              <div className="space-y-2 rounded-xl border border-gray-200 bg-linear-to-r from-white to-gray-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-gray-500">MOTORISTA</p>
                    <p className="mt-1 text-sm text-gray-800">
                      {pedidoSelecionado.entregador?.nome
                        ? `Atribuído: ${pedidoSelecionado.entregador.nome}`
                        : 'Nenhum motorista atribuído ainda'}
                    </p>
                  </div>
                  {mudarStatus.isPending ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                      Salvando...
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                      Atribuição automática
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Select
                    value={entregadorId}
                    onChange={(e) => {
                      const novoEntregadorId = e.target.value
                      setEntregadorId(novoEntregadorId)

                      if (!novoEntregadorId || !pedidoSelecionado?.id) return
                      if (
                        novoEntregadorId ===
                        (pedidoSelecionado.entregadorId ?? pedidoSelecionado.entregador?.id)
                      ) {
                        return
                      }

                      mudarStatus.mutate({
                        id: pedidoSelecionado.id,
                        acao: 'atribuir',
                        body: { entregadorId: novoEntregadorId },
                      })
                    }}
                    className="flex-1"
                    disabled={mudarStatus.isPending}
                  >
                    <option value="">Selecionar motorista</option>
                    {motoristas.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                        {m.papel === 'SUPERVISOR' ? ' (supervisor)' : ''}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-gray-500">
                    Ao selecionar um motorista, a atribuição é salva automaticamente. Se trocar o
                    nome, o novo motorista assume na hora.
                  </p>
                </div>
              </div>
            )}
            {(STATUS_ACOES[pedidoSelecionado.status] ||
              pedidoSelecionado.etiqueta ||
              STATUS_COM_ETIQUETA.includes(pedidoSelecionado.status)) && (
              <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap border-t border-gray-100">
                {STATUS_ACOES[pedidoSelecionado.status]?.map(({ label, next }) => (
                  <Button
                    key={next}
                    variant={next === 'cancelar' || next === 'rejeitar' ? 'danger' : 'primary'}
                    className="w-full sm:w-auto"
                    onClick={async () => {
                      // Cancelar/rejeitar não têm volta: pede confirmação antes
                      if (next === 'cancelar' || next === 'rejeitar') {
                        setMotivoRejeicao('')
                        setConfirmarAcao(next)
                        return
                      }
                      if (next === 'em-entrega') {
                        const motoristaId =
                          entregadorId ||
                          pedidoSelecionado.entregadorId ||
                          pedidoSelecionado.entregador?.id
                        if (!motoristaId) {
                          window.alert(
                            'Selecione um motorista para atribuição automática antes de sair para entrega.',
                          )
                          return
                        }
                        if (motoristaId !== pedidoSelecionado.entregadorId) {
                          await api.post(`/pedidos/${pedidoSelecionado.id}/atribuir`, {
                            entregadorId: motoristaId,
                          })
                        }
                      }
                      mudarStatus.mutate({ id: pedidoSelecionado.id, acao: next })
                    }}
                    disabled={mudarStatus.isPending || pedidoSelecionado.aguardandoAlteracao}
                  >
                    {label}
                  </Button>
                ))}
                {podeMarcarEntregue && STATUS_ENTREGAVEL.includes(pedidoSelecionado.status) && (
                  <Button
                    className="w-full sm:w-auto"
                    disabled={mudarStatus.isPending || pedidoSelecionado.aguardandoAlteracao}
                    onClick={() => {
                      if (!entregaSemFoto) {
                        setEntregando({
                          id: pedidoSelecionado.id,
                          numero: pedidoSelecionado.numero,
                        })
                        return
                      }
                      if (
                        window.confirm(
                          `Marcar o pedido ${numeroPedido(pedidoSelecionado)} como entregue?`,
                        )
                      )
                        mudarStatus.mutate({ id: pedidoSelecionado.id, acao: 'entregue', body: {} })
                    }}
                  >
                    Marcar como entregue
                  </Button>
                )}
                {pedidoSelecionado.etiqueta ? (
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(`/etiqueta/${pedidoSelecionado.etiqueta.id}`)}
                    disabled={pedidoSelecionado.aguardandoAlteracao}
                  >
                    <Printer className="w-3.5 h-3.5" /> Gerar {totalCaixasPedido(pedidoSelecionado)}{' '}
                    etiqueta{totalCaixasPedido(pedidoSelecionado) === 1 ? '' : 's'}
                  </Button>
                ) : (
                  STATUS_COM_ETIQUETA.includes(pedidoSelecionado.status) && (
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => gerarEtiqueta.mutate(pedidoSelecionado.id)}
                      disabled={gerarEtiqueta.isPending || pedidoSelecionado.aguardandoAlteracao}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      {gerarEtiqueta.isPending
                        ? 'Gerando...'
                        : `Gerar ${totalCaixasPedido(pedidoSelecionado)} etiqueta${totalCaixasPedido(pedidoSelecionado) === 1 ? '' : 's'}`}
                    </Button>
                  )
                )}
              </div>
            )}
            {pedidoSelecionado.status === 'CANCELADO' && podeExcluirPedido && (
              <div className="space-y-2 border-t border-gray-100 pt-2">
                {excluirPedido.isError && (
                  <p className="text-xs text-red-600">
                    {(excluirPedido.error as any)?.response?.data?.message ??
                      'Não foi possível excluir o pedido.'}
                  </p>
                )}
                <Button
                  variant="danger"
                  className="w-full sm:w-auto"
                  disabled={excluirPedido.isPending}
                  onClick={() => {
                    const numero = String(pedidoSelecionado.numero).padStart(6, '0')
                    if (
                      !window.confirm(
                        `Excluir definitivamente o pedido #${numero}? Essa ação não pode ser desfeita.`,
                      )
                    )
                      return
                    excluirPedido.mutate(pedidoSelecionado.id)
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {excluirPedido.isPending ? 'Excluindo...' : 'Excluir pedido'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmarAcao && !!pedidoSelecionado}
        onClose={() => setConfirmarAcao(null)}
        title={confirmarAcao === 'rejeitar' ? 'Rejeitar pedido?' : 'Cancelar pedido?'}
        size="sm"
      >
        {pedidoSelecionado && (
          <form
            className="space-y-4 p-4 sm:p-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (confirmarAcao === 'rejeitar') {
                if (!motivoRejeicao.trim()) return
                mudarStatus.mutate({
                  id: pedidoSelecionado.id,
                  acao: 'rejeitar',
                  body: { motivo: motivoRejeicao.trim() },
                })
              } else {
                mudarStatus.mutate({ id: pedidoSelecionado.id, acao: 'cancelar' })
              }
              setConfirmarAcao(null)
            }}
          >
            <p className="text-sm text-gray-700">
              Tem certeza que deseja{' '}
              <strong>{confirmarAcao === 'rejeitar' ? 'rejeitar' : 'cancelar'}</strong> o pedido{' '}
              <strong>#{String(pedidoSelecionado.numero).padStart(6, '0')}</strong> de{' '}
              {pedidoSelecionado.cliente?.razaoSocialOuNome ?? 'cliente'}?
            </p>
            {confirmarAcao === 'cancelar' && (
              <p className="text-xs text-gray-500">
                O pedido fica como Cancelado e as caixas que já saíram do estoque voltam para o
                lote.
              </p>
            )}
            {confirmarAcao === 'rejeitar' && (
              <label className="block space-y-1">
                <span className="text-xs font-medium text-gray-600">Motivo da rejeição</span>
                <textarea
                  autoFocus
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none"
                />
              </label>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setConfirmarAcao(null)}>
                Voltar, não {confirmarAcao === 'rejeitar' ? 'rejeitar' : 'cancelar'}
              </Button>
              <Button
                type="submit"
                variant="danger"
                disabled={confirmarAcao === 'rejeitar' && !motivoRejeicao.trim()}
              >
                Sim, {confirmarAcao === 'rejeitar' ? 'rejeitar' : 'cancelar'} pedido
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Depois do modal de detalhe para abrir por cima dele */}
      <MarcarEntregueModal
        pedido={entregando}
        onClose={() => setEntregando(null)}
        onEntregue={() => setPedidoSelecionado(null)}
      />
      <Modal
        open={!!resultadoLote}
        onClose={() => setResultadoLote(null)}
        title={resultadoLote ? ACOES_LOTE[resultadoLote.acao].label : ''}
        size="sm"
      >
        {resultadoLote && (
          <div className="space-y-3 text-sm">
            <p className="font-medium text-green-700">
              {resultadoLote.feitos.length} pedido(s) {ACOES_LOTE[resultadoLote.acao].feito}
            </p>
            {resultadoLote.pulados.length > 0 && (
              <p className="text-gray-600">
                Ignorados pelo status atual: {resultadoLote.pulados.join(', ')}
              </p>
            )}
            {resultadoLote.erros.length > 0 && (
              <div className="space-y-1 rounded-lg bg-red-50 p-3 text-red-700">
                <p className="font-medium">Não foi possível:</p>
                {resultadoLote.erros.map((e) => (
                  <p key={e} className="text-xs">
                    {e}
                  </p>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={() => setResultadoLote(null)}>OK</Button>
            </div>
          </div>
        )}
      </Modal>
      <RegistrarPagamentoModal
        pedido={pagando}
        onClose={() => setPagando(null)}
        onPago={async (id) => {
          const { data } = await api.get(`/pedidos/${id}`)
          setPedidoSelecionado((atual: any) => (atual?.id === id ? data : atual))
        }}
      />
    </div>
  )
}
