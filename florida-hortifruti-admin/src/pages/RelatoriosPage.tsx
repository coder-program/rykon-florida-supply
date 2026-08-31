import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  Download,
  BarChart3,
  Package,
  DollarSign,
  Users,
  FileSpreadsheet,
  FileText,
  FileJson,
  FileCode2,
  ChevronDown,
  Check,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { api } from '../lib/api'
import { formatBRL, formatDate, FORMA_PAGAMENTO_LABEL, STATUS_PEDIDO_LABEL } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Input, Select } from '../components/ui/Input'

type Aba = 'vendas' | 'estoque' | 'produto' | 'vendedor' | 'financeiro'
type Formato = 'excel' | 'pdf' | 'csv' | 'json' | 'xml'

const STATUS_PAGAMENTO_LABEL: Record<string, string> = {
  PAGO: 'Pago',
  EM_ABERTO: 'Em aberto',
  VENCIDO: 'Vencido',
}

const statusPedidoOptions = ['TODOS', 'RASCUNHO', 'ENVIADO', 'EM_CONFERENCIA', 'APROVADO', 'SEPARACAO_ENTREGA', 'ENTREGUE', 'FATURADO', 'PAGO', 'CANCELADO']
const statusPagamentoOptions = ['TODOS', 'PAGO', 'EM_ABERTO', 'VENCIDO']

const ABAS: { key: Aba; label: string; icon: LucideIcon }[] = [
  { key: 'vendas', label: 'Pedidos/Vendas', icon: BarChart3 },
  { key: 'estoque', label: 'Estoque', icon: Package },
  { key: 'produto', label: 'Por Produto', icon: Package },
  { key: 'vendedor', label: 'Por Vendedor', icon: Users },
  { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
]

const FORMATOS_PRINCIPAIS: { id: Formato; label: string; ext: string; hint: string; icon: LucideIcon }[] = [
  { id: 'excel', label: 'Excel', ext: '.xlsx', hint: 'Melhor para conferir e filtrar', icon: FileSpreadsheet },
  { id: 'pdf', label: 'PDF', ext: '.pdf', hint: 'Pronto para imprimir ou enviar', icon: FileText },
  { id: 'csv', label: 'CSV', ext: '.csv', hint: 'Abre em qualquer planilha', icon: Download },
]

const FORMATOS_INTEGRACAO: { id: Formato; label: string; ext: string; icon: LucideIcon }[] = [
  { id: 'json', label: 'JSON', ext: '.json', icon: FileJson },
  { id: 'xml', label: 'XML', ext: '.xml', icon: FileCode2 },
]

function downloadBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}

function dataArquivo() {
  return new Date().toISOString().slice(0, 10)
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function buildXml(titulo: string, records: Record<string, string | number>[]) {
  const itens = records
    .map((item) => {
      const campos = Object.entries(item)
        .map(([key, value]) => `      <${key}>${escapeXml(value)}</${key}>`)
        .join('\n')
      return `    <item>\n${campos}\n    </item>`
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<relatorio tipo="${escapeXml(titulo)}">\n${itens}\n</relatorio>`
}

interface Visao {
  titulo: string
  slug: string
  contagem: number
  carregando: boolean
  headers: string[]
  excelRows: Record<string, string | number>[]
  pdfRows: (string | number)[][]
}

function MenuExportar({ visao, resumoFiltros }: { visao: Visao; resumoFiltros: string }) {
  const [aberto, setAberto] = useState(false)
  const [exportando, setExportando] = useState<Formato | null>(null)
  const [erro, setErro] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const vazio = visao.contagem === 0 || visao.carregando

  useEffect(() => {
    function fechar(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false)
    }
    function esc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fechar)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fechar)
      document.removeEventListener('keydown', esc)
    }
  }, [])

  function exportar(formato: Formato) {
    if (vazio) return
    setErro('')
    setExportando(formato)
    try {
      const nome = `relatorio-${visao.slug}-${dataArquivo()}`
      const { excelRows, pdfRows, headers, titulo } = visao

      if (formato === 'excel') {
        const ws = XLSX.utils.json_to_sheet(excelRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31))
        XLSX.writeFile(wb, `${nome}.xlsx`)
      } else if (formato === 'csv') {
        const ws = XLSX.utils.json_to_sheet(excelRows)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, titulo.slice(0, 31))
        XLSX.writeFile(wb, `${nome}.csv`)
      } else if (formato === 'pdf') {
        const doc = new jsPDF({ orientation: headers.length > 5 ? 'landscape' : 'portrait' })
        doc.setFontSize(14)
        doc.text(titulo, 14, 16)
        doc.setFontSize(9)
        doc.setTextColor(90)
        doc.text(resumoFiltros, 14, 22)
        doc.text(`${visao.contagem} registro(s) · gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 27)
        doc.setTextColor(0)
        autoTable(doc, {
          startY: 32,
          head: [headers],
          body: pdfRows,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [22, 163, 74] },
        })
        doc.save(`${nome}.pdf`)
      } else if (formato === 'json') {
        downloadBlob(
          new Blob([JSON.stringify(excelRows, null, 2)], { type: 'application/json;charset=utf-8' }),
          `${nome}.json`,
        )
      } else {
        downloadBlob(new Blob([buildXml(visao.slug, excelRows)], { type: 'application/xml;charset=utf-8' }), `${nome}.xml`)
      }
      setAberto(false)
    } catch {
      setErro('Não foi possível gerar o arquivo.')
    } finally {
      setExportando(null)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        size="sm"
        disabled={vazio}
        aria-expanded={aberto}
        aria-haspopup="menu"
        onClick={() => setAberto((v) => !v)}
      >
        <Download className="h-3.5 w-3.5" />
        Exportar
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </Button>

      {aberto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          <div className="border-b border-gray-100 px-3.5 py-3">
            <p className="text-sm font-semibold text-gray-900">Exportar {visao.titulo.toLowerCase()}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
              {visao.contagem} registro{visao.contagem === 1 ? '' : 's'} desta tela, com os filtros atuais
            </p>
          </div>

          <div className="p-1.5">
            {FORMATOS_PRINCIPAIS.map((f, i) => (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                disabled={!!exportando}
                onClick={() => exportar(f.id)}
                className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <div className={`mt-0.5 rounded-lg p-1.5 ${i === 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  <f.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    {f.label}
                    <span className="text-xs font-normal text-gray-400">{f.ext}</span>
                    {i === 0 && (
                      <span className="rounded-full bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                        Recomendado
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{exportando === f.id ? 'Gerando…' : f.hint}</p>
                </div>
                {i === 0 && <Check className="mt-1 h-3.5 w-3.5 text-green-600" />}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 p-1.5">
            <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">Integração</p>
            {FORMATOS_INTEGRACAO.map((f) => (
              <button
                key={f.id}
                type="button"
                role="menuitem"
                disabled={!!exportando}
                onClick={() => exportar(f.id)}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-gray-50 disabled:opacity-50"
              >
                <f.icon className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-700">{f.label}</span>
                <span className="ml-auto text-xs text-gray-400">{f.ext}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {erro && <p className="absolute right-0 mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  )
}

export function RelatoriosPage() {
  const [aba, setAba] = useState<Aba>('vendas')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [status, setStatus] = useState('TODOS')
  const [statusPagamento, setStatusPagamento] = useState('TODOS')
  const [vendedorId, setVendedorId] = useState('')
  const [produtoId, setProdutoId] = useState('')

  const params = useMemo(() => ({
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    status: status === 'TODOS' ? undefined : status,
    statusPagamento: statusPagamento === 'TODOS' ? undefined : statusPagamento,
    vendedorId: vendedorId || undefined,
    produtoId: produtoId || undefined,
  }), [dataInicio, dataFim, status, statusPagamento, vendedorId, produtoId])

  const { data: vendedores = [] } = useQuery({
    queryKey: ['usuarios-relatorios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  })

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos-relatorios'],
    queryFn: () => api.get('/produtos', { params: { incluirInativos: true } }).then((r) => r.data),
  })

  const { data: vendas = [], isLoading: loadVendas } = useQuery({
    queryKey: ['rel-vendas', params],
    queryFn: () => api.get('/relatorios/vendas', { params }).then((r) => r.data),
    enabled: aba === 'vendas',
  })

  const { data: estoque = [], isLoading: loadEstoque } = useQuery({
    queryKey: ['rel-estoque', params],
    queryFn: () => api.get('/relatorios/estoque', { params }).then((r) => r.data),
    enabled: aba === 'estoque',
  })

  const { data: porProduto = [], isLoading: loadProduto } = useQuery({
    queryKey: ['rel-produto', params],
    queryFn: () => api.get('/relatorios/vendas/por-produto', { params }).then((r) => r.data),
    enabled: aba === 'produto',
  })

  const { data: porVendedor = [], isLoading: loadVendedor } = useQuery({
    queryKey: ['rel-vendedor', params],
    queryFn: () => api.get('/relatorios/vendas/por-vendedor', { params }).then((r) => r.data),
    enabled: aba === 'vendedor',
  })

  const { data: financeiro, isLoading: loadFinanceiro } = useQuery({
    queryKey: ['rel-financeiro', params],
    queryFn: () => api.get('/relatorios/financeiro', { params }).then((r) => r.data),
    enabled: aba === 'financeiro',
  })

  const nomeVendedor = vendedores.find((v: { id: string }) => v.id === vendedorId)?.nome
  const nomeProduto = produtos.find((p: { id: string }) => p.id === produtoId)?.nome

  const resumoFiltros = useMemo(() => {
    const partes: string[] = []
    if (dataInicio || dataFim) {
      const fmt = (d: string) => d.split('-').reverse().join('/')
      partes.push(`${dataInicio ? fmt(dataInicio) : 'início'} — ${dataFim ? fmt(dataFim) : 'hoje'}`)
    } else {
      partes.push('Todo o período')
    }
    if (status !== 'TODOS') partes.push(STATUS_PEDIDO_LABEL[status] ?? status)
    if (statusPagamento !== 'TODOS') partes.push(STATUS_PAGAMENTO_LABEL[statusPagamento] ?? statusPagamento)
    if (nomeVendedor) partes.push(nomeVendedor)
    if (nomeProduto) partes.push(nomeProduto)
    return partes.join(' · ')
  }, [dataInicio, dataFim, status, statusPagamento, nomeVendedor, nomeProduto])

  const visao = useMemo<Visao>(() => {
    if (aba === 'estoque') {
      return {
        titulo: 'Estoque',
        slug: 'estoque',
        contagem: estoque.length,
        carregando: loadEstoque,
        headers: ['Produto', 'Código', 'Categoria', 'Saldo', 'Unidade'],
        excelRows: estoque.map((item: any) => ({
          Produto: item.nome ?? '',
          Código: item.codigoInterno ?? '',
          Categoria: item.categoria ?? '',
          Saldo: Number(item.saldoAtual ?? 0),
          Unidade: item.unidadeVenda ?? '',
        })),
        pdfRows: estoque.map((item: any) => [
          item.nome ?? '',
          item.codigoInterno ?? '',
          item.categoria ?? '—',
          Number(item.saldoAtual ?? 0),
          item.unidadeVenda ?? '',
        ]),
      }
    }

    if (aba === 'produto') {
      return {
        titulo: 'Por produto',
        slug: 'por-produto',
        contagem: porProduto.length,
        carregando: loadProduto,
        headers: ['Produto', 'Qtd vendida', 'Preço médio', 'Faturamento'],
        excelRows: porProduto.map((p: any) => ({
          Produto: p.produto ?? '',
          'Qtd vendida': Number(p.quantidadeVendida ?? 0),
          'Preço médio': Number(p.precoMedioVenda ?? 0),
          Faturamento: Number(p.faturamento ?? 0),
        })),
        pdfRows: porProduto.map((p: any) => [
          p.produto ?? '',
          `${Number(p.quantidadeVendida ?? 0).toFixed(0)} cx`,
          formatBRL(p.precoMedioVenda),
          formatBRL(p.faturamento),
        ]),
      }
    }

    if (aba === 'vendedor') {
      return {
        titulo: 'Por vendedor',
        slug: 'por-vendedor',
        contagem: porVendedor.length,
        carregando: loadVendedor,
        headers: ['Vendedor', 'Pedidos', 'Total vendido'],
        excelRows: porVendedor.map((v: any) => ({
          Vendedor: v.vendedor ?? '',
          Pedidos: Number(v.totalPedidos ?? 0),
          'Total vendido': Number(v.totalVendido ?? 0),
        })),
        pdfRows: porVendedor.map((v: any) => [
          v.vendedor ?? '',
          v.totalPedidos ?? 0,
          formatBRL(v.totalVendido),
        ]),
      }
    }

    if (aba === 'financeiro') {
      const blocos = financeiro
        ? [
            { Situação: 'Recebidos (pagos)', Total: Number(financeiro.pagos?.total ?? 0), Pedidos: Number(financeiro.pagos?.quantidade ?? 0) },
            { Situação: 'Em aberto', Total: Number(financeiro.emAberto?.total ?? 0), Pedidos: Number(financeiro.emAberto?.quantidade ?? 0) },
            { Situação: 'Vencidos', Total: Number(financeiro.vencidos?.total ?? 0), Pedidos: Number(financeiro.vencidos?.quantidade ?? 0) },
          ]
        : []
      return {
        titulo: 'Financeiro',
        slug: 'financeiro',
        contagem: blocos.length,
        carregando: loadFinanceiro,
        headers: ['Situação', 'Total', 'Pedidos'],
        excelRows: blocos,
        pdfRows: blocos.map((b) => [b.Situação, formatBRL(b.Total), b.Pedidos]),
      }
    }

    return {
      titulo: 'Pedidos e vendas',
      slug: 'vendas',
      contagem: vendas.length,
      carregando: loadVendas,
      headers: ['Nº', 'Data', 'Cliente', 'Vendedor', 'Pagamento', 'Total'],
      excelRows: vendas.map((v: any) => ({
        Nº: `#${String(v.numero).padStart(6, '0')}`,
        Data: formatDate(v.data),
        Cliente: v.cliente?.razaoSocialOuNome ?? '',
        Vendedor: v.vendedor?.nome ?? '',
        Pagamento: FORMA_PAGAMENTO_LABEL[v.formaPagamento] ?? v.formaPagamento ?? '',
        Total: Number(v.totalFinal ?? 0),
      })),
      pdfRows: vendas.map((v: any) => [
        `#${String(v.numero).padStart(6, '0')}`,
        formatDate(v.data),
        v.cliente?.razaoSocialOuNome ?? '',
        v.vendedor?.nome ?? '',
        FORMA_PAGAMENTO_LABEL[v.formaPagamento] ?? v.formaPagamento ?? '',
        formatBRL(v.totalFinal),
      ]),
    }
  }, [aba, vendas, estoque, porProduto, porVendedor, financeiro, loadVendas, loadEstoque, loadProduto, loadVendedor, loadFinanceiro])

  function limparFiltros() {
    setDataInicio('')
    setDataFim('')
    setStatus('TODOS')
    setStatusPagamento('TODOS')
    setVendedorId('')
    setProdutoId('')
  }

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Consulta e exportação da visualização atual"
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
          <Input label="Data início" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-40" />
          <Input label="Data fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40" />
          <Select label="Status do pedido" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
            {statusPedidoOptions.map((item) => (
              <option key={item} value={item}>{item === 'TODOS' ? 'Todos' : (STATUS_PEDIDO_LABEL[item] ?? item)}</option>
            ))}
          </Select>
          <Select label="Status do pagamento" value={statusPagamento} onChange={(e) => setStatusPagamento(e.target.value)} className="w-48">
            {statusPagamentoOptions.map((item) => (
              <option key={item} value={item}>{item === 'TODOS' ? 'Todos' : (STATUS_PAGAMENTO_LABEL[item] ?? item)}</option>
            ))}
          </Select>
          <Select label="Vendedor" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)} className="w-52">
            <option value="">Todos</option>
            {vendedores.map((v: any) => <option key={v.id} value={v.id}>{v.nome}</option>)}
          </Select>
          <Select label="Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} className="w-52">
            <option value="">Todos</option>
            {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <Button variant="ghost" size="sm" onClick={limparFiltros}>Limpar</Button>
        </div>

        <div className="flex gap-1 border-b border-gray-200">
          {ABAS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setAba(key)}
              className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                aba === key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-900">{visao.titulo}</p>
            <p className="text-xs text-gray-500">
              {visao.carregando
                ? 'Carregando…'
                : `${visao.contagem} registro${visao.contagem === 1 ? '' : 's'} · ${resumoFiltros}`}
            </p>
          </div>
          <MenuExportar visao={visao} resumoFiltros={resumoFiltros} />
        </div>

        {aba === 'vendas' && (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nº</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Data</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vendedor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Pagamento</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadVendas && <tr><td colSpan={6} className="py-8 text-center text-gray-400">Carregando...</td></tr>}
                {vendas.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">#{String(v.numero).padStart(6, '0')}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(v.data)}</td>
                    <td className="px-4 py-3 text-gray-700">{v.cliente?.razaoSocialOuNome}</td>
                    <td className="px-4 py-3 text-gray-600">{v.vendedor?.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{FORMA_PAGAMENTO_LABEL[v.formaPagamento] ?? v.formaPagamento}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatBRL(v.totalFinal)}</td>
                  </tr>
                ))}
                {!loadVendas && vendas.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-gray-400">Nenhum dado no período</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {aba === 'estoque' && (
          <Card>
            <CardHeader><CardTitle>Estoque atual</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Produto</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Código</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Categoria</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Saldo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Unidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadEstoque && <tr><td colSpan={5} className="py-8 text-center text-gray-400">Carregando...</td></tr>}
                  {estoque.map((item: any) => (
                    <tr key={item.produtoId}>
                      <td className="px-4 py-3 font-medium">{item.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{item.codigoInterno}</td>
                      <td className="px-4 py-3 text-gray-600">{item.categoria ?? '—'}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{Number(item.saldoAtual ?? 0)}</td>
                      <td className="px-4 py-3 text-gray-600">{item.unidadeVenda}</td>
                    </tr>
                  ))}
                  {!loadEstoque && estoque.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-gray-400">Nenhum dado no período</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {aba === 'produto' && (
          <Card>
            <CardHeader><CardTitle>Faturamento por produto</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Produto</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Qtd vendida</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Preço médio</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Faturamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadProduto && <tr><td colSpan={4} className="py-8 text-center text-gray-400">Carregando...</td></tr>}
                  {porProduto.map((p: any) => (
                    <tr key={p.codigoInterno ?? p.produto}>
                      <td className="px-4 py-3 font-medium">{p.produto}</td>
                      <td className="px-4 py-3 text-right">{Number(p.quantidadeVendida).toFixed(0)} cx</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatBRL(p.precoMedioVenda)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatBRL(p.faturamento)}</td>
                    </tr>
                  ))}
                  {!loadProduto && porProduto.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-gray-400">Nenhum dado no período</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {aba === 'vendedor' && (
          <Card>
            <CardHeader><CardTitle>Vendas por vendedor</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Vendedor</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Pedidos</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Total vendido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadVendedor && <tr><td colSpan={3} className="py-8 text-center text-gray-400">Carregando...</td></tr>}
                  {porVendedor.map((v: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium">{v.vendedor}</td>
                      <td className="px-4 py-3 text-right">{v.totalPedidos}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatBRL(v.totalVendido)}</td>
                    </tr>
                  ))}
                  {!loadVendedor && porVendedor.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-gray-400">Nenhum dado no período</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {aba === 'financeiro' && (
          loadFinanceiro ? (
            <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>
          ) : financeiro ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {[
                { label: 'Recebidos (pagos)', data: financeiro.pagos, color: 'text-green-700 border-green-200 bg-green-50' },
                { label: 'Em aberto', data: financeiro.emAberto, color: 'text-yellow-700 border-yellow-200 bg-yellow-50' },
                { label: 'Vencidos', data: financeiro.vencidos, color: 'text-red-700 border-red-200 bg-red-50' },
              ].map(({ label, data, color }) => (
                <div key={label} className={`rounded-xl border p-5 ${color}`}>
                  <p className="mb-1 text-xs font-medium opacity-70">{label}</p>
                  <p className="text-2xl font-bold">{formatBRL(data.total)}</p>
                  <p className="mt-1 text-xs opacity-60">{data.quantidade} pedido(s)</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum dado no período</p>
          )
        )}
      </div>
    </div>
  )
}
