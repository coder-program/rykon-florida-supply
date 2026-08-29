import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, BarChart3, Package, DollarSign, Users } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card'
import { Input } from '../components/ui/Input'

type Aba = 'vendas' | 'produto' | 'vendedor' | 'financeiro'

export function RelatoriosPage() {
  const [aba, setAba] = useState<Aba>('vendas')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')

  const params = { dataInicio: dataInicio || undefined, dataFim: dataFim || undefined }

  const { data: vendas = [], isLoading: loadVendas } = useQuery({
    queryKey: ['rel-vendas', params],
    queryFn: () => api.get('/relatorios/vendas', { params }).then((r) => r.data),
    enabled: aba === 'vendas',
  })

  const { data: porProduto = [] } = useQuery({
    queryKey: ['rel-produto', params],
    queryFn: () => api.get('/relatorios/vendas/por-produto', { params }).then((r) => r.data),
    enabled: aba === 'produto',
  })

  const { data: porVendedor = [] } = useQuery({
    queryKey: ['rel-vendedor', params],
    queryFn: () => api.get('/relatorios/vendas/por-vendedor', { params }).then((r) => r.data),
    enabled: aba === 'vendedor',
  })

  const { data: financeiro } = useQuery({
    queryKey: ['rel-financeiro', params],
    queryFn: () => api.get('/relatorios/financeiro', { params }).then((r) => r.data),
    enabled: aba === 'financeiro',
  })

  function exportarCsv(tipo: 'vendas' | 'estoque') {
    const url = new URL(`/api/relatorios/${tipo}/csv`, window.location.origin)
    if (dataInicio) url.searchParams.set('dataInicio', dataInicio)
    if (dataFim) url.searchParams.set('dataFim', dataFim)
    const a = document.createElement('a')
    a.href = url.toString()
    a.click()
  }

  const abas: { key: Aba; label: string; icon: any }[] = [
    { key: 'vendas', label: 'Pedidos/Vendas', icon: BarChart3 },
    { key: 'produto', label: 'Por Produto', icon: Package },
    { key: 'vendedor', label: 'Por Vendedor', icon: Users },
    { key: 'financeiro', label: 'Financeiro', icon: DollarSign },
  ]

  return (
    <div>
      <PageHeader
        title="Relatórios"
        subtitle="Exportação e análise de dados"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => exportarCsv('vendas')}>
              <Download className="w-3.5 h-3.5" /> Exportar Vendas CSV
            </Button>
            <Button variant="secondary" size="sm" onClick={() => exportarCsv('estoque')}>
              <Download className="w-3.5 h-3.5" /> Exportar Estoque CSV
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Filtro de período */}
        <div className="flex gap-3 flex-wrap items-end bg-white border border-gray-200 rounded-xl p-4">
          <Input label="Data Início" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-40" />
          <Input label="Data Fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-40" />
          <Button variant="ghost" size="sm" onClick={() => { setDataInicio(''); setDataFim('') }}>Limpar</Button>
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-gray-200">
          {abas.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                aba === key ? 'border-green-600 text-green-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Vendas */}
        {aba === 'vendas' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nº</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vendedor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Pagamento</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadVendas && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
                {vendas.map((v: any) => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-600">#{String(v.numero).padStart(6, '0')}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(v.data)}</td>
                    <td className="px-4 py-3 text-gray-700">{v.cliente?.razaoSocialOuNome}</td>
                    <td className="px-4 py-3 text-gray-600">{v.vendedor?.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{v.formaPagamento}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatBRL(v.totalFinal)}</td>
                  </tr>
                ))}
                {!loadVendas && vendas.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Nenhum dado no período</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Por Produto */}
        {aba === 'produto' && (
          <Card>
            <CardHeader><CardTitle>Faturamento por Produto</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Produto</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Qtd Vendida</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Preço Médio</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Faturamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {porProduto.map((p: any) => (
                    <tr key={p.codigoInterno}>
                      <td className="px-4 py-3 font-medium">{p.produto}</td>
                      <td className="px-4 py-3 text-right">{Number(p.quantidadeVendida).toFixed(0)} cx</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatBRL(p.precoMedioVenda)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatBRL(p.faturamento)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Por Vendedor */}
        {aba === 'vendedor' && (
          <Card>
            <CardHeader><CardTitle>Vendas por Vendedor</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Vendedor</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Pedidos</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Total Vendido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {porVendedor.map((v: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium">{v.vendedor}</td>
                      <td className="px-4 py-3 text-right">{v.totalPedidos}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700">{formatBRL(v.totalVendido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Financeiro */}
        {aba === 'financeiro' && financeiro && (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Recebidos (Pagos)', data: financeiro.pagos, color: 'text-green-700 border-green-200 bg-green-50' },
              { label: 'Em Aberto', data: financeiro.emAberto, color: 'text-yellow-700 border-yellow-200 bg-yellow-50' },
              { label: 'Vencidos', data: financeiro.vencidos, color: 'text-red-700 border-red-200 bg-red-50' },
            ].map(({ label, data, color }) => (
              <div key={label} className={`rounded-xl border p-5 ${color}`}>
                <p className="text-xs font-medium mb-1 opacity-70">{label}</p>
                <p className="text-2xl font-bold">{formatBRL(data.total)}</p>
                <p className="text-xs opacity-60 mt-1">{data.quantidade} pedido(s)</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
