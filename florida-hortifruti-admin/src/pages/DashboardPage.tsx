import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import {
  TrendingUp,
  ShoppingCart,
  Package,
  AlertCircle,
  DollarSign,
  Boxes,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  RefreshCw,
  Download,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../contexts/useAuth'

const PERIODOS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Ontem', value: 'ontem' },
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: 'Personalizado', value: 'custom' },
] as const

type Periodo = (typeof PERIODOS)[number]['value']

interface EstoqueItem {
  produtoId: string
  nome: string
  saldoAtual: number
  unidadeVenda?: string
  estoqueMinimo?: number | null
  abaixoMinimo?: boolean
}

interface VendaProduto {
  produto: string
  faturamento: number
  quantidadeVendida?: number
}

interface VendaTipoItem {
  produtoId: string
  produto: string
  quantidade: number
  faturamento: number
  custoTotal: number
  lucro: number
  margemPercentual: number
}

interface LucroDiarioResponse {
  periodo: {
    dataInicio?: string
    dataFim?: string
  }
  geral: {
    totalVendido: number
    custoTotal: number
    lucroTotal: number
    margemPercentual: number
    quantidadeTotal: number
  }
  porProduto?: VendaTipoItem[]
  porTipoMorango?: VendaTipoItem[]
}

function isoLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateFromIso(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

function hojeIso() {
  return isoLocal(new Date())
}

function getPeriodoDates(periodo: Periodo, custom?: { dataInicio: string; dataFim: string }) {
  const hoje = new Date()
  if (periodo === 'custom' && custom?.dataInicio && custom?.dataFim) return custom
  if (periodo === 'hoje') return { dataInicio: isoLocal(hoje), dataFim: isoLocal(hoje) }
  if (periodo === 'ontem') {
    const ontem = new Date(hoje)
    ontem.setDate(hoje.getDate() - 1)
    return { dataInicio: isoLocal(ontem), dataFim: isoLocal(ontem) }
  }
  if (periodo === '7d') {
    const inicio = new Date(hoje)
    inicio.setDate(hoje.getDate() - 6)
    return { dataInicio: isoLocal(inicio), dataFim: isoLocal(hoje) }
  }
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - 29)
  return { dataInicio: isoLocal(inicio), dataFim: isoLocal(hoje) }
}

function saudacao() {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function primeiroNome(nome?: string) {
  return nome?.trim().split(/\s+/)[0] ?? ''
}

function formatarIso(iso: string) {
  return dateFromIso(iso).toLocaleDateString('pt-BR')
}

function getPeriodoAnterior(datas: { dataInicio: string; dataFim: string }) {
  const inicio = dateFromIso(datas.dataInicio)
  const fim = dateFromIso(datas.dataFim)
  const msPorDia = 24 * 60 * 60 * 1000
  const dias = Math.max(1, Math.round((fim.getTime() - inicio.getTime()) / msPorDia) + 1)

  const fimAnterior = new Date(inicio)
  fimAnterior.setDate(fimAnterior.getDate() - 1)

  const inicioAnterior = new Date(fimAnterior)
  inicioAnterior.setDate(inicioAnterior.getDate() - (dias - 1))

  return { dataInicio: isoLocal(inicioAnterior), dataFim: isoLocal(fimAnterior) }
}

function csvEscape(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

function rotuloPeriodo(periodo: Periodo, datas: { dataInicio: string; dataFim: string }) {
  if (datas.dataInicio === datas.dataFim) {
    if (periodo === 'hoje') {
      return new Date(`${datas.dataInicio}T00:00:00`).toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    }
    return formatarIso(datas.dataInicio)
  }
  return `${formatarIso(datas.dataInicio)} — ${formatarIso(datas.dataFim)}`
}

function hintPeriodo(periodo: Periodo) {
  if (periodo === 'hoje') return 'hoje'
  if (periodo === 'ontem') return 'ontem'
  if (periodo === '7d') return 'nos últimos 7 dias'
  if (periodo === '30d') return 'nos últimos 30 dias'
  return 'no período selecionado'
}

function statusEstoque(item: EstoqueItem) {
  const saldo = Number(item.saldoAtual)
  if (saldo <= 0)
    return { label: 'Zerado', className: 'bg-red-100 text-red-700', tone: 'zerado' as const }
  if (item.abaixoMinimo)
    return { label: 'Baixo', className: 'bg-amber-100 text-amber-800', tone: 'baixo' as const }
  return { label: 'OK', className: 'bg-emerald-100 text-emerald-700', tone: 'ok' as const }
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.[0]) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-gray-800">{label}</p>
      <p className="mt-0.5 text-green-700">{formatBRL(Number(payload[0].value ?? 0))}</p>
    </div>
  )
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  accent,
  to,
  emphasize,
}: {
  title: string
  value: string
  hint?: string
  icon: LucideIcon
  accent: string
  to?: string
  emphasize?: boolean
}) {
  const body = (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 transition-shadow ${
        emphasize
          ? 'border-green-200 bg-linear-to-br from-green-600 to-green-700 text-white shadow-sm'
          : 'border-gray-200 bg-white hover:shadow-sm'
      } ${to ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl p-2.5 ${emphasize ? 'bg-white/15 text-white' : accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        {to && (
          <ArrowRight
            className={`h-4 w-4 shrink-0 ${emphasize ? 'text-green-100' : 'text-gray-300'}`}
          />
        )}
      </div>
      <p className={`mt-4 text-xs font-medium ${emphasize ? 'text-green-100' : 'text-gray-500'}`}>
        {title}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${emphasize ? 'text-white' : 'text-gray-900'}`}
      >
        {value}
      </p>
      {hint && (
        <p
          className={`mt-1.5 text-xs leading-relaxed ${emphasize ? 'text-green-100/90' : 'text-gray-400'}`}
        >
          {hint}
        </p>
      )}
    </div>
  )

  return to ? (
    <Link to={to} className="block h-full">
      {body}
    </Link>
  ) : (
    body
  )
}

export function DashboardPage() {
  const { usuario } = useAuth()
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const [customInicio, setCustomInicio] = useState(hojeIso)
  const [customFim, setCustomFim] = useState(hojeIso)
  const datas = getPeriodoDates(periodo, { dataInicio: customInicio, dataFim: customFim })
  const nome = primeiroNome(usuario?.nome)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', datas.dataInicio, datas.dataFim],
    queryFn: () => api.get('/dashboard', { params: datas }).then((r) => r.data),
  })

  const { data: vendasProduto = [] } = useQuery<VendaProduto[]>({
    queryKey: ['vendas-produto', datas.dataInicio, datas.dataFim],
    queryFn: () => api.get('/relatorios/vendas/por-produto', { params: datas }).then((r) => r.data),
  })

  const {
    data: lucroDiario,
    isLoading: lucroCarregando,
    isFetching: lucroAtualizando,
  } = useQuery<LucroDiarioResponse>({
    queryKey: ['lucro-diario-dashboard', datas.dataInicio, datas.dataFim],
    queryFn: () => api.get('/relatorios/lucro-diario', { params: datas }).then((r) => r.data),
  })

  const datasAnterior = getPeriodoAnterior(datas)
  const { data: lucroAnterior, isFetching: lucroAnteriorAtualizando } =
    useQuery<LucroDiarioResponse>({
      queryKey: [
        'lucro-diario-dashboard-anterior',
        datasAnterior.dataInicio,
        datasAnterior.dataFim,
      ],
      queryFn: () =>
        api.get('/relatorios/lucro-diario', { params: datasAnterior }).then((r) => r.data),
    })

  const estoque: EstoqueItem[] = [...(data?.estoque ?? [])].sort((a, b) => {
    const rank = (e: EstoqueItem) => (Number(e.saldoAtual) <= 0 ? 0 : e.abaixoMinimo ? 1 : 2)
    return rank(a) - rank(b) || a.nome.localeCompare(b.nome, 'pt-BR')
  })

  const totalVendas = Number(data?.totalVendas ?? 0)
  const totalPedidos = Number(data?.totalPedidos ?? 0)
  const caixas = Number(data?.caixasVendidas ?? 0)
  const emAberto = Number(data?.valoresEmAberto ?? 0)
  const vencidos = Number(data?.valoresVencidos ?? 0)
  const zerados = estoque.filter((e) => Number(e.saldoAtual) <= 0).length
  const baixos = estoque.filter((e) => Number(e.saldoAtual) > 0 && e.abaixoMinimo).length
  const ticketMedio = totalPedidos > 0 ? totalVendas / totalPedidos : null
  const chartData = [...vendasProduto]
    .sort((a, b) => Number(b.faturamento) - Number(a.faturamento))
    .slice(0, 6)
    .map((v) => ({
      ...v,
      produtoCurto: v.produto.length > 18 ? `${v.produto.slice(0, 16)}…` : v.produto,
    }))

  const lucroGeral = lucroDiario?.geral
  const vendasPorTipo =
    (lucroDiario?.porProduto?.length ? lucroDiario.porProduto : lucroDiario?.porTipoMorango) ?? []
  const lucroAnteriorTotal = Number(lucroAnterior?.geral?.lucroTotal ?? 0)
  const lucroAtualTotal = Number(lucroGeral?.lucroTotal ?? 0)
  const variacaoLucro =
    lucroAnteriorTotal > 0
      ? ((lucroAtualTotal - lucroAnteriorTotal) / lucroAnteriorTotal) * 100
      : null
  const variacaoPositiva = variacaoLucro !== null && variacaoLucro >= 0

  function exportarCsvLucro() {
    const cabecalho = ['Produto', 'Quantidade', 'Faturamento', 'Custo', 'Lucro', 'Margem_%']
    const linhas = vendasPorTipo.map((item) => [
      csvEscape(item.produto),
      Number(item.quantidade).toFixed(0),
      Number(item.faturamento ?? 0).toFixed(2),
      Number(item.custoTotal ?? 0).toFixed(2),
      Number(item.lucro ?? 0).toFixed(2),
      Number(item.margemPercentual ?? 0).toFixed(2),
    ])

    const csv = [cabecalho.join(','), ...linhas.map((linha) => linha.join(','))].join('\n')
    const nome = `lucro-diario-${datas.dataInicio}-${datas.dataFim}.csv`
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nome
    a.click()
    URL.revokeObjectURL(url)
  }

  function escolherPeriodo(proximo: Periodo) {
    setPeriodo(proximo)
    if (proximo !== 'custom') {
      const proximoDatas = getPeriodoDates(proximo)
      setCustomInicio(proximoDatas.dataInicio)
      setCustomFim(proximoDatas.dataFim)
    }
  }

  function alterarDataCustom(campo: 'inicio' | 'fim', valor: string) {
    const inicio = campo === 'inicio' ? valor : customInicio
    const fim = campo === 'fim' ? valor : customFim
    if (inicio && fim && new Date(inicio) > new Date(fim)) {
      setCustomInicio(fim)
      setCustomFim(inicio)
    } else {
      if (campo === 'inicio') setCustomInicio(valor)
      else setCustomFim(valor)
    }
    setPeriodo('custom')
  }

  if (isLoading) {
    return (
      <div>
        <div className="border-b border-gray-200 bg-white px-6 py-6">
          <div className="h-7 w-56 animate-pulse rounded-lg bg-gray-200" />
          <div className="mt-2 h-4 w-40 animate-pulse rounded bg-gray-100" />
        </div>
        <div className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-200" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-28 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="h-72 animate-pulse rounded-2xl bg-gray-200" />
            <div className="h-72 animate-pulse rounded-2xl bg-gray-200" />
          </div>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            Não foi possível carregar o painel
          </h1>
          <p className="mt-1 text-sm text-gray-500">Confira se a API está no ar e tente de novo.</p>
          <Button className="mt-4" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <header className="border-b border-gray-200 bg-white px-6 py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-700">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
              {saudacao()}
              {nome ? `, ${nome}` : ''}
            </h1>
            <p className="mt-1 text-sm capitalize text-gray-500">{rotuloPeriodo(periodo, datas)}</p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {(isFetching || lucroAtualizando) && (
                <span className="text-xs text-gray-400">Atualizando…</span>
              )}
              <div className="flex flex-wrap rounded-xl bg-gray-100 p-1">
                {PERIODOS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => escolherPeriodo(p.value)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      periodo === p.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {periodo === 'custom' && (
              <div className="flex flex-wrap items-end justify-end gap-2">
                <Input
                  type="date"
                  label="De"
                  value={customInicio}
                  onChange={(e) => alterarDataCustom('inicio', e.target.value)}
                  className="h-9 w-40"
                />
                <Input
                  type="date"
                  label="Até"
                  value={customFim}
                  onChange={(e) => alterarDataCustom('fim', e.target.value)}
                  className="h-9 w-40"
                />
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="space-y-6 p-6">
        {(zerados > 0 || vencidos > 0) && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {zerados > 0 && (
              <Link
                to="/estoque"
                className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 transition-colors hover:bg-red-100/70"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  <strong className="font-semibold">{zerados}</strong>
                  {zerados === 1 ? ' produto sem estoque' : ' produtos sem estoque'}
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs font-medium">
                  Ver estoque <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            )}
            {vencidos > 0 && (
              <Link
                to="/financeiro"
                className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100/70"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  <strong className="font-semibold">{formatBRL(vencidos)}</strong> em títulos
                  vencidos
                </span>
                <span className="ml-auto flex items-center gap-1 text-xs font-medium">
                  Financeiro <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            )}
          </div>
        )}

        <section>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiCard
              title="Vendas"
              value={formatBRL(totalVendas)}
              hint={
                ticketMedio
                  ? `Ticket médio ${formatBRL(ticketMedio)} · ${totalPedidos} pedido${totalPedidos === 1 ? '' : 's'}`
                  : `Nenhuma venda ${hintPeriodo(periodo)}`
              }
              icon={TrendingUp}
              accent="bg-green-100 text-green-700"
              to="/relatorios"
              emphasize
            />
            <KpiCard
              title="Pedidos"
              value={String(totalPedidos)}
              hint={
                totalPedidos === 0
                  ? `Nenhum pedido ${hintPeriodo(periodo)}`
                  : `Registrados ${hintPeriodo(periodo)}`
              }
              icon={ShoppingCart}
              accent="bg-blue-100 text-blue-600"
              to="/pedidos"
            />
            <KpiCard
              title="Caixas vendidas"
              value={`${caixas.toFixed(0)} cx`}
              hint={caixas === 0 ? 'Sem volume no período' : 'Volume total do período'}
              icon={Boxes}
              accent="bg-violet-100 text-violet-600"
            />
          </div>
        </section>

        <section>
          <Card className="overflow-hidden rounded-2xl border-green-100">
            <CardHeader className="border-b border-green-50 bg-linear-to-r from-green-50 via-white to-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>O que vendemos</CardTitle>
                  <p className="mt-1 text-xs text-gray-500">
                    Total do período e quanto saiu de cada tipo de produto ·{' '}
                    {rotuloPeriodo(periodo, datas)}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={vendasPorTipo.length === 0}
                  onClick={exportarCsvLucro}
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              {lucroCarregando ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Vendido
                      </p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {formatBRL(Number(lucroGeral?.totalVendido ?? totalVendas))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Caixas
                      </p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {Number(lucroGeral?.quantidadeTotal ?? caixas).toFixed(0)} cx
                      </p>
                    </div>
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-green-700">
                        Lucro
                      </p>
                      <p className="mt-1 text-xl font-semibold text-green-800">
                        {formatBRL(Number(lucroGeral?.lucroTotal ?? 0))}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Margem
                      </p>
                      <p className="mt-1 text-xl font-semibold text-gray-900">
                        {Number(lucroGeral?.margemPercentual ?? 0).toFixed(1)}%
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                        Vs período anterior
                      </p>
                      <p
                        className={`mt-1 text-xl font-semibold ${variacaoLucro === null ? 'text-gray-900' : variacaoPositiva ? 'text-green-700' : 'text-red-700'}`}
                      >
                        {variacaoLucro === null
                          ? 'Sem base'
                          : `${variacaoLucro >= 0 ? '+' : ''}${variacaoLucro.toFixed(1)}%`}
                      </p>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {formatarIso(datasAnterior.dataInicio)} —{' '}
                        {formatarIso(datasAnterior.dataFim)}
                        {lucroAnteriorAtualizando ? ' · atualizando…' : ''}
                      </p>
                    </div>
                  </div>

                  {vendasPorTipo.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center">
                      <p className="text-sm font-medium text-gray-700">
                        Nenhuma venda neste período
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Mude o filtro de data no topo para ver outro dia ou intervalo.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="min-w-full divide-y divide-gray-100 text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-3 py-2.5 font-medium">Tipo de produto</th>
                            <th className="px-3 py-2.5 font-medium text-right">Qtd.</th>
                            <th className="px-3 py-2.5 font-medium text-right">Faturamento</th>
                            <th className="px-3 py-2.5 font-medium text-right">Custo</th>
                            <th className="px-3 py-2.5 font-medium text-right">Lucro</th>
                            <th className="px-3 py-2.5 font-medium text-right">Margem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {vendasPorTipo.map((item) => (
                            <tr key={item.produtoId}>
                              <td className="px-3 py-2.5 font-medium text-gray-800">
                                {item.produto}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                                {Number(item.quantidade).toFixed(0)}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                                {formatBRL(Number(item.faturamento ?? 0))}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                                {formatBRL(Number(item.custoTotal ?? 0))}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-green-700">
                                {formatBRL(Number(item.lucro ?? 0))}
                              </td>
                              <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">
                                {Number(item.margemPercentual ?? 0).toFixed(1)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            Financeiro e catálogo
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              title="Em aberto"
              value={formatBRL(emAberto)}
              hint={emAberto === 0 ? 'Nada a receber neste período' : 'Aguardando pagamento'}
              icon={DollarSign}
              accent="bg-amber-100 text-amber-700"
              to="/financeiro"
            />
            <KpiCard
              title="Vencidos"
              value={formatBRL(vencidos)}
              hint={vencidos === 0 ? 'Nenhum título vencido' : 'Precisa de cobrança'}
              icon={AlertCircle}
              accent={vencidos > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}
              to="/financeiro"
            />
            <KpiCard
              title="Produtos ativos"
              value={String(estoque.length)}
              hint={
                zerados > 0
                  ? `${zerados} zerado${zerados === 1 ? '' : 's'} no estoque`
                  : 'Itens no catálogo'
              }
              icon={Package}
              accent="bg-gray-100 text-gray-600"
              to="/produtos"
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Estoque atual</CardTitle>
                <p className="mt-0.5 text-xs text-gray-400">
                  {estoque.length} produto{estoque.length === 1 ? '' : 's'}
                  {baixos > 0 ? ` · ${baixos} abaixo do mínimo` : ''}
                </p>
              </div>
              <Link
                to="/estoque"
                className="text-xs font-medium text-green-700 hover:text-green-800"
              >
                Ver estoque
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {estoque.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">Nenhum produto ativo</p>
                  <Link
                    to="/produtos"
                    className="mt-2 inline-block text-xs font-medium text-green-700"
                  >
                    Cadastrar produto
                  </Link>
                </div>
              ) : (
                <ul className="max-h-95 divide-y divide-gray-50 overflow-auto">
                  {estoque.map((e) => {
                    const status = statusEstoque(e)
                    const saldo = Number(e.saldoAtual)
                    const minimo = e.estoqueMinimo ? Number(e.estoqueMinimo) : null
                    const pct =
                      minimo && minimo > 0
                        ? Math.min(100, (Math.max(saldo, 0) / minimo) * 100)
                        : null
                    return (
                      <li key={e.produtoId} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-gray-800">{e.nome}</p>
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p
                            className={`text-sm font-semibold tabular-nums ${
                              status.tone === 'zerado'
                                ? 'text-red-600'
                                : status.tone === 'baixo'
                                  ? 'text-amber-700'
                                  : 'text-gray-900'
                            }`}
                          >
                            {saldo.toFixed(0)} {e.unidadeVenda}
                          </p>
                          {minimo !== null && (
                            <p className="text-xs text-gray-400">mín. {minimo.toFixed(0)}</p>
                          )}
                        </div>
                        {pct !== null && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full ${
                                status.tone === 'zerado'
                                  ? 'bg-red-400'
                                  : status.tone === 'baixo'
                                    ? 'bg-amber-400'
                                    : 'bg-green-500'
                              }`}
                              style={{
                                width: `${status.tone === 'zerado' ? 4 : Math.max(pct, 6)}%`,
                              }}
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-2xl">
            <CardHeader className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Faturamento por produto</CardTitle>
                <p className="mt-0.5 text-xs text-gray-400">Top produtos {hintPeriodo(periodo)}</p>
              </div>
              <Link
                to="/relatorios"
                className="text-xs font-medium text-green-700 hover:text-green-800"
              >
                Relatórios
              </Link>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-70 flex-col items-center justify-center px-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                    <BarChart3 className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-800">Sem faturamento neste período</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">
                    Quando houver pedidos no filtro selecionado, o gráfico dos produtos aparece
                    aqui.
                  </p>
                  <Link
                    to="/pedidos"
                    className="mt-4 text-xs font-medium text-green-700 hover:text-green-800"
                  >
                    Ir para pedidos
                  </Link>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ left: 4, right: 12, top: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) =>
                        v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : formatBRL(v)
                      }
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="produtoCurto"
                      tick={{ fontSize: 11, fill: '#4b5563' }}
                      width={112}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: '#f0fdf4' }} content={<ChartTooltip />} />
                    <Bar
                      dataKey="faturamento"
                      fill="#16a34a"
                      radius={[0, 6, 6, 0]}
                      maxBarSize={22}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
