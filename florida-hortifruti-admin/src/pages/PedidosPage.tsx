import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, Printer, Pencil, Plus, FileSpreadsheet, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api } from '../lib/api'
import {
  formatBRL,
  formatDate,
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

const STATUS_ACOES: Record<string, { label: string; next: string }[]> = {
  AGUARDANDO_APROVACAO: [
    { label: 'Aprovar', next: 'aprovar' },
    { label: 'Rejeitar', next: 'rejeitar' },
    { label: 'Cancelar', next: 'cancelar' },
  ],
  APROVADO: [
    { label: 'Em separação', next: 'separacao' },
    { label: 'Cancelar', next: 'cancelar' },
  ],
  EM_SEPARACAO: [
    { label: 'Pronto para entrega', next: 'pronto-para-entrega' },
    { label: 'Cancelar', next: 'cancelar' },
  ],
  PRONTO_PARA_ENTREGA: [
    { label: 'Saiu para entrega', next: 'em-entrega' },
    { label: 'Cancelar', next: 'cancelar' },
  ],
}

const STATUS_EDITAVEL = ['AGUARDANDO_APROVACAO']
const STATUS_COM_ETIQUETA = [
  'APROVADO',
  'EM_SEPARACAO',
  'PRONTO_PARA_ENTREGA',
  'EM_ENTREGA',
  'ENTREGUE',
]
const STATUS_PODE_ATRIBUIR = ['APROVADO', 'EM_SEPARACAO', 'PRONTO_PARA_ENTREGA', 'EM_ENTREGA']

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
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [pedidoSelecionado, setPedidoSelecionado] = useState<any>(null)
  const [novoPedido, setNovoPedido] = useState(false)
  const [entregadorId, setEntregadorId] = useState('')
  const [editando, setEditando] = useState(false)
  const [formEdit, setFormEdit] = useState({
    valorFrete: '',
    descontoValor: '',
    formaPagamento: '',
    dataVencimento: '',
    necessitaNF: false,
    observacoes: '',
    itens: [] as {
      produtoId: string
      nome: string
      quantidade: number
      valorUnitario: number
    }[],
  })

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['pedidos', filtroStatus],
    queryFn: () =>
      api
        .get('/pedidos', { params: filtroStatus ? { status: filtroStatus } : {} })
        .then((r) => r.data),
  })

  const { data: usuarios = [] } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  })
  const motoristas = (usuarios as any[]).filter((u) => u.papel === 'MOTORISTA' && u.ativo)

  function abrirPedido(p: any) {
    setPedidoSelecionado(p)
    setEntregadorId(p.entregadorId ?? p.entregador?.id ?? '')
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
        nome: i.produto?.nome ?? '',
        quantidade: Math.max(1, Math.round(Number(i.quantidade) || 0)),
        valorUnitario: Number(i.valorUnitario),
      })),
    })
    setEditando(true)
  }

  function alterarQtdItem(produtoId: string, delta: number) {
    setFormEdit((f) => ({
      ...f,
      itens: f.itens.map((item) =>
        item.produtoId === produtoId
          ? { ...item, quantidade: Math.max(1, item.quantidade + delta) }
          : item,
      ),
    }))
  }

  const pedidosFiltrados = pedidos.filter(
    (p: any) =>
      !busca ||
      p.numero?.toString().includes(busca) ||
      p.cliente?.razaoSocialOuNome?.toLowerCase().includes(busca.toLowerCase()) ||
      p.vendedor?.nome?.toLowerCase().includes(busca.toLowerCase()),
  )

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
      head: [['Nº', 'Cliente', 'Vendedor', 'Status', 'Pagamento', 'Total']],
      body: pedidosFiltrados.map((p: any) => [
        `#${String(p.numero ?? '').padStart(6, '0')}`,
        p.cliente?.razaoSocialOuNome ?? '',
        p.vendedor?.nome ?? '',
        STATUS_PEDIDO_LABEL[p.status] ?? p.status,
        FORMA_PAGAMENTO_LABEL[p.formaPagamento] ?? p.formaPagamento,
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

        <div className="space-y-3 md:hidden">
          {isLoading && <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>}
          {!isLoading && pedidosFiltrados.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum pedido encontrado</p>
          )}
          {pedidosFiltrados.map((p: any) => (
            <button
              key={p.id}
              type="button"
              onClick={() => abrirPedido(p)}
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left"
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
              </div>
            </button>
          ))}
        </div>

        <div className="hidden md:block">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
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
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && pedidosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Nenhum pedido encontrado
                    </td>
                  </tr>
                )}
                {pedidosFiltrados.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50">
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
                    src={pedidoSelecionado.fotoEntrega}
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
              {pedidoSelecionado.observacoes && (
                <div className="col-span-2">
                  <span className="text-gray-500">Obs:</span> {pedidoSelecionado.observacoes}
                </div>
              )}
            </div>

            {/* Itens */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm border border-gray-200 rounded-lg overflow-hidden">
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
                      <td className="px-3 py-2">{i.produto?.nome}</td>
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
                  editarPedido.mutate({
                    ...formEdit,
                    valorFrete: Number(formEdit.valorFrete),
                    descontoValor: Number(formEdit.descontoValor),
                    itens: formEdit.itens.map((i) => ({
                      produtoId: i.produtoId,
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
                  <p className="text-xs font-medium text-gray-600">Quantidade (caixas)</p>
                  {formEdit.itens.map((item) => (
                    <div key={item.produtoId} className="flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate text-sm text-gray-800">{item.nome}</p>
                      <div className="flex shrink-0 items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => alterarQtdItem(item.produtoId, -1)}
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
                          onClick={() => alterarQtdItem(item.produtoId, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
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
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-gray-500">Motorista</p>
                <p className="text-sm">
                  {pedidoSelecionado.entregador?.nome
                    ? `Atribuído: ${pedidoSelecionado.entregador.nome}`
                    : 'Nenhum motorista atribuído — selecione e clique em Atribuir'}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    value={entregadorId}
                    onChange={(e) => setEntregadorId(e.target.value)}
                    className="flex-1"
                  >
                    <option value="">Selecionar motorista</option>
                    {motoristas.map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!entregadorId || mudarStatus.isPending}
                    onClick={() =>
                      mudarStatus.mutate({
                        id: pedidoSelecionado.id,
                        acao: 'atribuir',
                        body: { entregadorId },
                      })
                    }
                  >
                    Atribuir
                  </Button>
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
                      if (next === 'rejeitar') {
                        const motivo = window.prompt('Motivo da rejeição')
                        if (!motivo?.trim()) return
                        mudarStatus.mutate({
                          id: pedidoSelecionado.id,
                          acao: next,
                          body: { motivo: motivo.trim() },
                        })
                        return
                      }
                      if (next === 'em-entrega') {
                        const motoristaId =
                          entregadorId ||
                          pedidoSelecionado.entregadorId ||
                          pedidoSelecionado.entregador?.id
                        if (!motoristaId) {
                          window.alert(
                            'Selecione um motorista e clique em Atribuir antes de sair para entrega.',
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
          </div>
        )}
      </Modal>
    </div>
  )
}
