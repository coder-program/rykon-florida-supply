import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DollarSign, AlertCircle, Clock, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api } from '../lib/api'
import { formatBRL, formatDate, FORMA_PAGAMENTO_LABEL } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'

const SITUACAO_CONFIG: Record<string, { label: string; badge: string; row: string }> = {
  PAGO:     { label: 'Pago',             badge: 'bg-green-100 text-green-700',  row: '' },
  EM_ABERTO:{ label: 'Em aberto',        badge: 'bg-blue-100 text-blue-700',    row: '' },
  A_VENCER: { label: 'A vencer (7d)',    badge: 'bg-yellow-100 text-yellow-800',row: 'bg-yellow-50' },
  VENCIDO:  { label: 'Vencido',          badge: 'bg-red-100 text-red-700',      row: 'bg-red-50' },
}

function KpiCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

const PERIODOS = [
  { label: 'Hoje',          value: 'hoje' },
  { label: 'Últimos 7d',   value: '7d' },
  { label: 'Últimos 30d',  value: '30d' },
  { label: 'Este mês',     value: 'mes' },
]

function getPeriodoDates(p: string) {
  const hoje = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (p === 'hoje') return { dataInicio: fmt(hoje), dataFim: fmt(hoje) }
  if (p === '7d') { const i = new Date(hoje); i.setDate(hoje.getDate() - 7); return { dataInicio: fmt(i), dataFim: fmt(hoje) } }
  if (p === '30d') { const i = new Date(hoje); i.setDate(hoje.getDate() - 30); return { dataInicio: fmt(i), dataFim: fmt(hoje) } }
  // mes
  const i = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  return { dataInicio: fmt(i), dataFim: fmt(hoje) }
}

export function FinanceiroPage() {
  const qc = useQueryClient()
  const [periodo, setPeriodo] = useState('mes')
  const [filtroSituacao, setFiltroSituacao] = useState('')
  const [filtroForma, setFiltroForma] = useState('')
  const [expandido, setExpandido] = useState<string | null>(null)
  const datas = getPeriodoDates(periodo)

  const { data: resumo, isLoading: loadingResumo } = useQuery({
    queryKey: ['financeiro-resumo', periodo],
    queryFn: () => api.get('/financeiro/resumo', { params: datas }).then((r) => r.data),
  })

  const { data: contas = [], isLoading: loadingContas } = useQuery({
    queryKey: ['contas-a-receber', filtroSituacao, filtroForma],
    queryFn: () => api.get('/financeiro/contas-a-receber', {
      params: {
        ...(filtroSituacao ? { situacao: filtroSituacao } : {}),
        ...(filtroForma ? { formaPagamento: filtroForma } : {}),
      },
    }).then((r) => r.data),
  })

  const marcarPago = useMutation({
    mutationFn: (pedidoId: string) => api.post(`/financeiro/marcar-pago/${pedidoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-a-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] })
    },
  })

  const reabrir = useMutation({
    mutationFn: (pedidoId: string) => api.post(`/financeiro/reabrir/${pedidoId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-a-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] })
    },
  })

  function formatarDataArquivo() {
    return new Date().toISOString().slice(0, 10)
  }

  async function exportarExcel() {
    const linhas = contas.map((c: any) => ({
      Pedido: `#${String(c.numero ?? '').padStart(6, '0')}`,
      Cliente: c.cliente?.razaoSocialOuNome ?? '',
      Vendedor: c.vendedor?.nome ?? '',
      Forma: FORMA_PAGAMENTO_LABEL[c.formaPagamento] ?? c.formaPagamento,
      Vencimento: c.dataVencimento ? formatDate(c.dataVencimento) : '',
      Situacao: SITUACAO_CONFIG[c.situacaoCalculada]?.label ?? c.situacaoCalculada,
      Valor: Number(c.totalFinal ?? 0),
    }))

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Financeiro')
    worksheet.columns = [
      { header: 'Pedido', key: 'Pedido', width: 16 },
      { header: 'Cliente', key: 'Cliente', width: 26 },
      { header: 'Vendedor', key: 'Vendedor', width: 20 },
      { header: 'Forma', key: 'Forma', width: 18 },
      { header: 'Vencimento', key: 'Vencimento', width: 14 },
      { header: 'Situacao', key: 'Situacao', width: 20 },
      { header: 'Valor', key: 'Valor', width: 16 },
    ]
    worksheet.addRows(linhas)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `financeiro-${formatarDataArquivo()}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Relatório Financeiro', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Pedido', 'Cliente', 'Vendedor', 'Forma', 'Vencimento', 'Situação', 'Valor']],
      body: contas.map((c: any) => [
        `#${String(c.numero ?? '').padStart(6, '0')}`,
        c.cliente?.razaoSocialOuNome ?? '',
        c.vendedor?.nome ?? '',
        FORMA_PAGAMENTO_LABEL[c.formaPagamento] ?? c.formaPagamento,
        c.dataVencimento ? formatDate(c.dataVencimento) : '',
        SITUACAO_CONFIG[c.situacaoCalculada]?.label ?? c.situacaoCalculada,
        formatBRL(c.totalFinal),
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74] },
      margin: { left: 10, right: 10 },
    })

    doc.save(`financeiro-${formatarDataArquivo()}.pdf`)
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        subtitle="Contas a receber e fluxo de caixa"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {PERIODOS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriodo(p.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    periodo === p.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button variant="secondary" onClick={exportarExcel} disabled={contas.length === 0}>
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </Button>
            <Button variant="secondary" onClick={exportarPdf} disabled={contas.length === 0}>
              <FileText className="w-4 h-4" /> PDF
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPIs */}
        {loadingResumo ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label={`Recebido (${PERIODOS.find(p => p.value === periodo)?.label})`}
              value={formatBRL(resumo?.recebido?.total ?? 0)}
              sub={`${resumo?.recebido?.qtd ?? 0} pedido(s)`}
              icon={CheckCircle2}
              color="bg-green-100 text-green-600"
            />
            <KpiCard
              label="Em aberto"
              value={formatBRL(resumo?.emAberto?.total ?? 0)}
              sub={`${resumo?.emAberto?.qtd ?? 0} pedido(s)`}
              icon={DollarSign}
              color="bg-blue-100 text-blue-600"
            />
            <KpiCard
              label="A vencer (7 dias)"
              value={formatBRL(resumo?.aVencer7dias?.total ?? 0)}
              sub={`${resumo?.aVencer7dias?.qtd ?? 0} pedido(s)`}
              icon={Clock}
              color="bg-yellow-100 text-yellow-600"
            />
            <KpiCard
              label="Vencidos"
              value={formatBRL(resumo?.vencido?.total ?? 0)}
              sub={`${resumo?.vencido?.qtd ?? 0} pedido(s)`}
              icon={AlertCircle}
              color="bg-red-100 text-red-600"
            />
          </div>
        )}

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="w-48">
            <Select value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}>
              <option value="">Todas as situações</option>
              <option value="VENCIDO">Vencidos</option>
              <option value="A_VENCER">A vencer (7d)</option>
              <option value="EM_ABERTO">Em aberto</option>
              <option value="PAGO">Pagos</option>
            </Select>
          </div>
          <div className="w-48">
            <Select value={filtroForma} onChange={(e) => setFiltroForma(e.target.value)}>
              <option value="">Todas as formas</option>
              <option value="PIX">PIX</option>
              <option value="BOLETO">Boleto</option>
              <option value="DINHEIRO">Dinheiro</option>
              <option value="OUTROS">Outros</option>
            </Select>
          </div>
        </div>

        {/* Tabela de contas */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Pagamento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vencimento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Situação</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingContas && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Carregando...</td></tr>
              )}
              {!loadingContas && contas.length === 0 && (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">Nenhuma conta encontrada</td></tr>
              )}
              {contas.map((c: any) => {
                const sit = SITUACAO_CONFIG[c.situacaoCalculada] ?? SITUACAO_CONFIG['EM_ABERTO']
                const aberto = expandido === c.id
                return (
                  <>
                    <tr key={c.id} className={`hover:brightness-95 transition ${sit.row}`}>
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs text-gray-500">#{String(c.numero).padStart(6, '0')}</p>
                        <p className="text-xs text-gray-400">{formatDate(c.data)}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="font-medium text-gray-900 truncate">{c.cliente?.razaoSocialOuNome}</p>
                        {c.cliente?.nomeFantasia && <p className="text-xs text-gray-400 truncate">{c.cliente.nomeFantasia}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.vendedor?.nome}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{FORMA_PAGAMENTO_LABEL[c.formaPagamento] ?? c.formaPagamento}</td>
                      <td className="px-4 py-3 text-xs">
                        {c.dataVencimento
                          ? <span className={c.situacaoCalculada === 'VENCIDO' ? 'text-red-600 font-semibold' : 'text-gray-600'}>{formatDate(c.dataVencimento)}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={sit.badge}>{sit.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatBRL(c.totalFinal)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {c.situacaoCalculada !== 'PAGO' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => marcarPago.mutate(c.id)}
                              disabled={marcarPago.isPending}
                            >
                              Pago
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => { if (confirm('Reabrir esta conta como em aberto?')) reabrir.mutate(c.id) }}
                              disabled={reabrir.isPending}
                            >
                              Reabrir
                            </Button>
                          )}
                          <button
                            onClick={() => setExpandido(aberto ? null : c.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 rounded"
                          >
                            {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {aberto && (
                      <tr key={`${c.id}-detail`} className={sit.row}>
                        <td colSpan={8} className="px-6 pb-4 pt-1">
                          <div className="text-xs text-gray-500 space-y-1 bg-white/70 rounded-lg p-3 border border-gray-100">
                            <div className="grid grid-cols-3 gap-4">
                              <div><span className="text-gray-400">Subtotal:</span> {formatBRL(c.subtotal)}</div>
                              {Number(c.valorFrete) > 0 && <div><span className="text-gray-400">Frete:</span> {formatBRL(c.valorFrete)}</div>}
                              {Number(c.descontoValor) > 0 && <div><span className="text-gray-400">Desconto:</span> -{formatBRL(c.descontoValor)}</div>}
                              <div><span className="text-gray-400">NF:</span> {c.necessitaNF ? '✅ Sim' : 'Não'}</div>
                              {c.condicaoNegociada && <div><span className="text-gray-400">Condição:</span> {c.condicaoNegociada}</div>}
                              {c.cliente?.telefone && <div><span className="text-gray-400">Tel cliente:</span> {c.cliente.telefone}</div>}
                            </div>
                            {c.observacoes && <p className="mt-2 text-gray-600 italic">"{c.observacoes}"</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>

          {/* Totalizador */}
          {contas.length > 0 && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-sm">
              <span className="text-gray-500">{contas.length} registro(s)</span>
              <div className="flex gap-6">
                <span className="text-gray-500">
                  Em aberto: <strong className="text-gray-900">
                    {formatBRL(contas.filter((c: any) => c.situacaoCalculada !== 'PAGO').reduce((s: number, c: any) => s + Number(c.totalFinal), 0))}
                  </strong>
                </span>
                <span className="text-gray-500">
                  Total: <strong className="text-gray-900">
                    {formatBRL(contas.reduce((s: number, c: any) => s + Number(c.totalFinal), 0))}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
