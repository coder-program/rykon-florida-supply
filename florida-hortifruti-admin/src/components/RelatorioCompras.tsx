import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate } from '../lib/utils'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import {
  VERDE_OK,
  VERMELHO,
  exportarRelatorioExcel,
  exportarRelatorioPdf,
  type Relatorio,
} from '../lib/relatorioMarca'

type Totais = {
  caixas: number
  mercadorias: number
  comissoes: number
  fretes: number
  custoTotal: number
  custoMedioCaixa: number
}
type ItemCompra = {
  id: string
  compraId: string
  data: string
  fornecedor: string
  lote: string | null
  produto: string
  quantidade: number
  valorUnitario: number
  mercadorias: number
  comissao: number
  frete: number
  custoTotal: number
  pago: boolean
  dataPagamento: string | null
}
type ComprasResponse = {
  resumo: Totais & { compras: number; pago: number; pendente: number }
  itens: ItemCompra[]
  porTipo: (Totais & { produto: string })[]
}

const cx = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} cx`
const dataBR = (d: string) => d.split('-').reverse().join('/')

function montarRelatorio(d: ComprasResponse, filtros: string): Relatorio {
  const r = d.resumo
  return {
    titulo: 'Relatório de Compras por Período',
    subtitulo: filtros,
    arquivo: `relatorio-compras-${new Date().toISOString().slice(0, 10)}`,
    resumo: [
      { label: 'Compras realizadas', valor: String(r.compras) },
      { label: 'Caixas adquiridas', valor: cx(r.caixas) },
      { label: 'Gasto em caixas de morango', valor: formatBRL(r.mercadorias) },
      { label: 'Gasto em comissões', valor: formatBRL(r.comissoes) },
      { label: 'Gasto em fretes', valor: formatBRL(r.fretes) },
      { label: 'Custo total das compras', valor: formatBRL(r.custoTotal) },
      { label: 'Custo médio final por caixa', valor: formatBRL(r.custoMedioCaixa) },
      { label: 'Valor pago', valor: formatBRL(r.pago), cor: VERDE_OK },
      { label: 'Pendente de pagamento', valor: formatBRL(r.pendente), cor: VERMELHO },
    ],
    secoes: [
      {
        titulo: 'Detalhamento das compras',
        headers: [
          'Data',
          'Fornecedor',
          'Lote',
          'Tipo de morango',
          'Caixas',
          'Valor unit.',
          'Mercadorias',
          'Comissão',
          'Frete',
          'Custo total',
          'Pagamento',
        ],
        moeda: [5, 6, 7, 8, 9],
        linhas: d.itens.map((i) => [
          formatDate(i.data),
          i.fornecedor,
          i.lote ?? '—',
          i.produto,
          i.quantidade,
          i.valorUnitario,
          i.mercadorias,
          i.comissao,
          i.frete,
          i.custoTotal,
          i.pago ? `Pago em ${formatDate(i.dataPagamento!)}` : 'Pendente',
        ]),
        cores: d.itens.map((i) => [...Array(10).fill(undefined), i.pago ? VERDE_OK : VERMELHO]),
        totais: [
          'Total',
          '',
          '',
          '',
          r.caixas,
          '',
          r.mercadorias,
          r.comissoes,
          r.fretes,
          r.custoTotal,
          '',
        ],
      },
      {
        titulo: 'Consolidado por tipo de morango',
        headers: [
          'Tipo de morango',
          'Caixas',
          'Mercadorias',
          'Comissões',
          'Fretes',
          'Custo total',
          'Custo médio/cx',
        ],
        moeda: [2, 3, 4, 5, 6],
        linhas: d.porTipo.map((t) => [
          t.produto,
          t.caixas,
          t.mercadorias,
          t.comissoes,
          t.fretes,
          t.custoTotal,
          t.custoMedioCaixa,
        ]),
      },
    ],
  }
}

export function RelatorioCompras({ produtos }: { produtos: { id: string; nome: string }[] }) {
  const qc = useQueryClient()
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [fornecedorId, setFornecedorId] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [statusPagamento, setStatusPagamento] = useState('')
  const [gerando, setGerando] = useState<'pdf' | 'excel' | null>(null)

  const params = {
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    fornecedorId: fornecedorId || undefined,
    produtoId: produtoId || undefined,
    statusPagamento: statusPagamento || undefined,
  }

  const { data: fornecedores = [] } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ['fornecedores-relatorio'],
    queryFn: () =>
      api.get('/fornecedores', { params: { incluirInativos: true } }).then((r) => r.data),
  })

  const { data, isLoading } = useQuery<ComprasResponse>({
    queryKey: ['rel-compras', params],
    queryFn: () => api.get('/relatorios/compras', { params }).then((r) => r.data),
  })

  const pagar = useMutation({
    mutationFn: ({ compraId, pago }: { compraId: string; pago: boolean }) =>
      api.patch(`/estoque/compras/${compraId}/pagamento`, { pago }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rel-compras'] }),
  })

  const filtros = useMemo(() => {
    const partes = [
      dataInicio || dataFim
        ? `${dataInicio ? dataBR(dataInicio) : 'início'} a ${dataFim ? dataBR(dataFim) : 'hoje'}`
        : 'Todo o período',
    ]
    const f = fornecedores.find((x) => x.id === fornecedorId)?.nome
    const p = produtos.find((x) => x.id === produtoId)?.nome
    if (f) partes.push(f)
    if (p) partes.push(p)
    if (statusPagamento) partes.push(statusPagamento === 'PAGO' ? 'Pagas' : 'Pendentes')
    return partes.join(' · ')
  }, [dataInicio, dataFim, fornecedorId, produtoId, statusPagamento, fornecedores, produtos])

  async function exportar(formato: 'pdf' | 'excel') {
    if (!data) return
    setGerando(formato)
    try {
      const rel = montarRelatorio(data, filtros)
      await (formato === 'pdf' ? exportarRelatorioPdf(rel) : exportarRelatorioExcel(rel))
    } finally {
      setGerando(null)
    }
  }

  const r = data?.resumo
  const cards = r
    ? [
        ['Compras realizadas', String(r.compras)],
        ['Caixas adquiridas', cx(r.caixas)],
        ['Gasto em caixas', formatBRL(r.mercadorias)],
        ['Comissões', formatBRL(r.comissoes)],
        ['Fretes', formatBRL(r.fretes)],
        ['Custo total', formatBRL(r.custoTotal)],
        ['Custo médio por caixa', formatBRL(r.custoMedioCaixa)],
      ]
    : []

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Input
            label="Data inicial"
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
          <Input
            label="Data final"
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
          <Select
            label="Fornecedor"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
          >
            <option value="">Todos</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
          <Select
            label="Tipo de morango"
            value={produtoId}
            onChange={(e) => setProdutoId(e.target.value)}
          >
            <option value="">Todos</option>
            {produtos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
          <Select
            label="Status do pagamento"
            value={statusPagamento}
            onChange={(e) => setStatusPagamento(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
          </Select>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!data?.itens.length || !!gerando}
              onClick={() => exportar('pdf')}
            >
              <FileText className="h-3.5 w-3.5" /> {gerando === 'pdf' ? 'Gerando…' : 'PDF'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!data?.itens.length || !!gerando}
              onClick={() => exportar('excel')}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />{' '}
              {gerando === 'excel' ? 'Gerando…' : 'Excel'}
            </Button>
          </div>
        </div>
      </div>

      {isLoading || !r ? (
        <p className="brand-loading py-8 text-center text-sm text-gray-400">Carregando...</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {cards.map(([label, valor]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{valor}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs text-gray-500">Valor das compras</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{formatBRL(r.custoTotal)}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
              <p className="text-xs opacity-80">Efetivamente pago</p>
              <p className="mt-1 text-xl font-bold">{formatBRL(r.pago)}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
              <p className="text-xs opacity-80">Pendente de pagamento</p>
              <p className="mt-1 text-xl font-bold">{formatBRL(r.pendente)}</p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento das compras</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[1100px] text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                  <tr>
                    {['Data', 'Fornecedor', 'Lote', 'Tipo'].map((h) => (
                      <th key={h} className="px-3 py-3 text-left font-medium">
                        {h}
                      </th>
                    ))}
                    {[
                      'Caixas',
                      'Valor unit.',
                      'Mercadorias',
                      'Comissão',
                      'Frete',
                      'Custo total',
                    ].map((h) => (
                      <th key={h} className="px-3 py-3 text-right font-medium">
                        {h}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-left font-medium">Pagamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.itens.map((i) => (
                    <tr key={i.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-600">{formatDate(i.data)}</td>
                      <td className="px-3 py-2.5 text-gray-800">{i.fornecedor}</td>
                      <td className="px-3 py-2.5 text-gray-600">{i.lote ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-800">{i.produto}</td>
                      <td className="px-3 py-2.5 text-right">{cx(i.quantidade)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">
                        {formatBRL(i.valorUnitario)}
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatBRL(i.mercadorias)}</td>
                      <td className="px-3 py-2.5 text-right">{formatBRL(i.comissao)}</td>
                      <td className="px-3 py-2.5 text-right">{formatBRL(i.frete)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold">
                        {formatBRL(i.custoTotal)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {i.pago ? (
                            <span className="text-xs font-semibold text-green-700">
                              Pago em {formatDate(i.dataPagamento!)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-red-600">Pendente</span>
                          )}
                          <button
                            type="button"
                            disabled={pagar.isPending}
                            onClick={() => {
                              const msg = i.pago
                                ? 'Voltar esta compra para pendente?'
                                : `Marcar a compra de ${i.fornecedor} como paga hoje? (vale para todos os lotes desta compra)`
                              if (window.confirm(msg))
                                pagar.mutate({ compraId: i.compraId, pago: !i.pago })
                            }}
                            className="text-xs font-medium text-gray-500 hover:text-green-700 hover:underline"
                          >
                            {i.pago ? 'Reabrir' : 'Marcar paga'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {data.itens.length === 0 && (
                    <tr>
                      <td colSpan={11} className="py-8 text-center text-gray-400">
                        Nenhuma compra no período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consolidado por tipo de morango</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Tipo de morango</th>
                    <th className="px-4 py-3 text-right font-medium">Caixas</th>
                    <th className="px-4 py-3 text-right font-medium">Valor gasto</th>
                    <th className="px-4 py-3 text-right font-medium">Custo médio/cx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.porTipo.map((t) => (
                    <tr key={t.produto}>
                      <td className="px-4 py-3 font-medium">{t.produto}</td>
                      <td className="px-4 py-3 text-right">{cx(t.caixas)}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {formatBRL(t.custoTotal)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {formatBRL(t.custoMedioCaixa)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
