import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, ShoppingCart, Package, AlertCircle, DollarSign, Boxes, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { api } from '../lib/api'
import { formatBRL } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { PageHeader } from '../components/ui/PageHeader'

const PERIODOS = [
  { label: 'Hoje', value: 'hoje' },
  { label: 'Últimos 7 dias', value: '7d' },
  { label: 'Últimos 30 dias', value: '30d' },
]

function getPeriodoDates(periodo: string) {
  const hoje = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  if (periodo === 'hoje') return { dataInicio: fmt(hoje), dataFim: fmt(hoje) }
  if (periodo === '7d') {
    const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 7)
    return { dataInicio: fmt(inicio), dataFim: fmt(hoje) }
  }
  const inicio = new Date(hoje); inicio.setDate(hoje.getDate() - 30)
  return { dataInicio: fmt(inicio), dataFim: fmt(hoje) }
}

function StatCard({ title, value, sub, icon: Icon, color }: { title: string; value: string; sub?: string; icon: any; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

export function DashboardPage() {
  const [periodo, setPeriodo] = useState('hoje')
  const datas = getPeriodoDates(periodo)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', periodo],
    queryFn: () => api.get('/dashboard', { params: datas }).then((r) => r.data),
  })

  const { data: vendasProduto } = useQuery({
    queryKey: ['vendas-produto', periodo],
    queryFn: () => api.get('/relatorios/vendas/por-produto', { params: datas }).then((r) => r.data),
  })

  if (isLoading) return (
    <div className="p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Visão geral das operações"
        actions={
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
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Total de Vendas" value={formatBRL(data?.totalVendas ?? 0)} icon={TrendingUp} color="bg-green-100 text-green-600" />
          <StatCard title="Pedidos" value={data?.totalPedidos ?? 0} icon={ShoppingCart} color="bg-blue-100 text-blue-600" />
          <StatCard title="Caixas Vendidas" value={`${Number(data?.caixasVendidas ?? 0).toFixed(0)} cx`} icon={Boxes} color="bg-purple-100 text-purple-600" />
          <StatCard title="Em Aberto" value={formatBRL(data?.valoresEmAberto ?? 0)} icon={DollarSign} color="bg-yellow-100 text-yellow-600" />
          <StatCard title="Vencidos" value={formatBRL(data?.valoresVencidos ?? 0)} icon={AlertCircle} color="bg-red-100 text-red-600" />
          <StatCard title="Produtos Ativos" value={data?.estoque?.length ?? 0} icon={Package} color="bg-gray-100 text-gray-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Estoque atual */}
          <Card>
            <CardHeader><CardTitle>Estoque Atual</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500">Produto</th>
                    <th className="text-right px-5 py-2.5 text-xs font-medium text-gray-500">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.estoque?.map((e: any) => (
                    <tr key={e.produtoId} className="border-b border-gray-50 last:border-0">
                      <td className="px-5 py-3 text-gray-700 flex items-center gap-2">
                        {e.abaixoMinimo && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {e.nome}
                      </td>
                      <td className="px-5 py-3 text-right font-semibold">
                        <span className={Number(e.saldoAtual) <= 0 ? 'text-red-600' : e.abaixoMinimo ? 'text-amber-600' : 'text-gray-900'}>
                          {Number(e.saldoAtual).toFixed(0)} {e.unidadeVenda}
                        </span>
                        {e.estoqueMinimo && (
                          <span className="block text-xs font-normal text-gray-400">mín: {e.estoqueMinimo}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Vendas por produto */}
          {vendasProduto?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Faturamento por Produto</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={vendasProduto?.slice(0, 6)} layout="vertical" margin={{ left: 0, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="produto" tick={{ fontSize: 11 }} width={100} />
                    <Tooltip formatter={(v) => formatBRL(Number(v ?? 0))} />
                    <Bar dataKey="faturamento" fill="#16a34a" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
