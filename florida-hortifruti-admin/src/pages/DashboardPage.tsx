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
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { useAuth } from '../contexts/useAuth'

const PERIODOS = [
  { label: 'Hoje', value: 'hoje' },
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
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

function getPeriodoDates(periodo: Periodo) {
  const hoje = new Date()
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  if (periodo === 'hoje') return { dataInicio: fmt(hoje), dataFim: fmt(hoje) }
  if (periodo === '7d') {
    const inicio = new Date(hoje)
    inicio.setDate(hoje.getDate() - 6)
    return { dataInicio: fmt(inicio), dataFim: fmt(hoje) }
  }
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - 29)
  return { dataInicio: fmt(inicio), dataFim: fmt(hoje) }
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

function rotuloPeriodo(periodo: Periodo) {
  const hoje = new Date()
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  if (periodo === 'hoje') {
    return hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  }
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - (periodo === '7d' ? 6 : 29))
  return `${fmt(inicio)} — ${fmt(hoje)}`
}

function hintPeriodo(periodo: Periodo) {
  if (periodo === 'hoje') return 'hoje'
  if (periodo === '7d') return 'nos últimos 7 dias'
  return 'nos últimos 30 dias'
}

function statusEstoque(item: EstoqueItem) {
  const saldo = Number(item.saldoAtual)
  if (saldo <= 0) return { label: 'Zerado', className: 'bg-red-100 text-red-700', tone: 'zerado' as const }
  if (item.abaixoMinimo) return { label: 'Baixo', className: 'bg-amber-100 text-amber-800', tone: 'baixo' as const }
  return { label: 'OK', className: 'bg-emerald-100 text-emerald-700', tone: 'ok' as const }
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
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
          ? 'border-green-200 bg-gradient-to-br from-green-600 to-green-700 text-white shadow-sm'
          : 'border-gray-200 bg-white hover:shadow-sm'
      } ${to ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl p-2.5 ${emphasize ? 'bg-white/15 text-white' : accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        {to && (
          <ArrowRight className={`h-4 w-4 shrink-0 ${emphasize ? 'text-green-100' : 'text-gray-300'}`} />
        )}
      </div>
      <p className={`mt-4 text-xs font-medium ${emphasize ? 'text-green-100' : 'text-gray-500'}`}>{title}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${emphasize ? 'text-white' : 'text-gray-900'}`}>
        {value}
      </p>
      {hint && (
        <p className={`mt-1.5 text-xs leading-relaxed ${emphasize ? 'text-green-100/90' : 'text-gray-400'}`}>{hint}</p>
      )}
    </div>
  )

  return to ? <Link to={to} className="block h-full">{body}</Link> : body
}

export function DashboardPage() {
  const { usuario } = useAuth()
  const [periodo, setPeriodo] = useState<Periodo>('hoje')
  const datas = getPeriodoDates(periodo)
  const nome = primeiroNome(usuario?.nome)

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['dashboard', periodo],
    queryFn: () => api.get('/dashboard', { params: datas }).then((r) => r.data),
  })

  const { data: vendasProduto = [] } = useQuery<VendaProduto[]>({
    queryKey: ['vendas-produto', periodo],
    queryFn: () => api.get('/relatorios/vendas/por-produto', { params: datas }).then((r) => r.data),
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
          <h1 className="text-lg font-semibold text-gray-900">Não foi possível carregar o painel</h1>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-green-700">Dashboard</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
              {saudacao()}
              {nome ? `, ${nome}` : ''}
            </h1>
            <p className="mt-1 text-sm capitalize text-gray-500">{rotuloPeriodo(periodo)}</p>
          </div>
          <div className="flex items-center gap-3">
            {isFetching && <span className="text-xs text-gray-400">Atualizando…</span>}
            <div className="flex rounded-xl bg-gray-100 p-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriodo(p.value)}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all ${
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
                  <strong className="font-semibold">{formatBRL(vencidos)}</strong> em títulos vencidos
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
              hint={totalPedidos === 0 ? `Nenhum pedido ${hintPeriodo(periodo)}` : `Registrados ${hintPeriodo(periodo)}`}
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
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">Financeiro e catálogo</p>
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
              hint={zerados > 0 ? `${zerados} zerado${zerados === 1 ? '' : 's'} no estoque` : 'Itens no catálogo'}
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
              <Link to="/estoque" className="text-xs font-medium text-green-700 hover:text-green-800">
                Ver estoque
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {estoque.length === 0 ? (
                <div className="px-5 py-12 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-700">Nenhum produto ativo</p>
                  <Link to="/produtos" className="mt-2 inline-block text-xs font-medium text-green-700">
                    Cadastrar produto
                  </Link>
                </div>
              ) : (
                <ul className="max-h-[380px] divide-y divide-gray-50 overflow-auto">
                  {estoque.map((e) => {
                    const status = statusEstoque(e)
                    const saldo = Number(e.saldoAtual)
                    const minimo = e.estoqueMinimo ? Number(e.estoqueMinimo) : null
                    const pct = minimo && minimo > 0 ? Math.min(100, (Math.max(saldo, 0) / minimo) * 100) : null
                    return (
                      <li key={e.produtoId} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-medium text-gray-800">{e.nome}</p>
                          <Badge className={status.className}>{status.label}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <p className={`text-sm font-semibold tabular-nums ${
                            status.tone === 'zerado' ? 'text-red-600' : status.tone === 'baixo' ? 'text-amber-700' : 'text-gray-900'
                          }`}>
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
                                status.tone === 'zerado' ? 'bg-red-400' : status.tone === 'baixo' ? 'bg-amber-400' : 'bg-green-500'
                              }`}
                              style={{ width: `${status.tone === 'zerado' ? 4 : Math.max(pct, 6)}%` }}
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
              <Link to="/relatorios" className="text-xs font-medium text-green-700 hover:text-green-800">
                Relatórios
              </Link>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="flex h-[280px] flex-col items-center justify-center px-6 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100">
                    <BarChart3 className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-800">Sem faturamento neste período</p>
                  <p className="mt-1 max-w-xs text-xs leading-relaxed text-gray-500">
                    Quando houver pedidos no filtro selecionado, o gráfico dos produtos aparece aqui.
                  </p>
                  <Link to="/pedidos" className="mt-4 text-xs font-medium text-green-700 hover:text-green-800">
                    Ir para pedidos
                  </Link>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 4, right: 12, top: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => (v >= 1000 ? `R$ ${(v / 1000).toFixed(0)}k` : formatBRL(v))}
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
                    <Bar dataKey="faturamento" fill="#16a34a" radius={[0, 6, 6, 0]} maxBarSize={22} />
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
