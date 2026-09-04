import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Pencil,
  History,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  Search,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api } from '../lib/api'
import { formatBRL, formatDateTime } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, MoneyInput, Select } from '../components/ui/Input'

const EMPTY = {
  codigoInterno: '',
  nome: '',
  categoriaId: '',
  unidadeVenda: 'CAIXA',
  precoSugerido: '',
  custo: '',
  estoqueMinimo: '',
  limiteEstoqueBaixo: '',
  exibirQuantidadeAproximada: false,
  exibirNoPortalCliente: true,
}

const UNIDADES = ['CAIXA', 'KG', 'UNIDADE', 'SACO', 'BANDEJA', 'DUZIA']

type StatusFiltro = 'ativos' | 'inativos' | 'todos'
type EstoqueFiltro = 'todos' | 'sem-estoque' | 'baixo' | 'normal'

export function ProdutosPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('ativos')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [estoqueFiltro, setEstoqueFiltro] = useState<EstoqueFiltro>('todos')

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos', statusFiltro],
    queryFn: () =>
      api
        .get('/produtos', {
          params: { incluirInativos: statusFiltro === 'todos' || statusFiltro === 'inativos' },
        })
        .then((r) => r.data),
  })

  const { data: categorias = [] } = useQuery({
    queryKey: ['categorias'],
    queryFn: () => api.get('/categorias').then((r) => r.data),
  })

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()

    return (produtos || []).filter((p: any) => {
      const matchBusca =
        !termo ||
        [p.nome, p.codigoInterno, p.categoria?.nome ?? ''].join(' ').toLowerCase().includes(termo)
      const matchCategoria =
        !categoriaFiltro || p.categoriaId === categoriaFiltro || p.categoria?.id === categoriaFiltro
      const estoqueAtual = Number(p.estoqueAtual ?? 0)
      const estoqueMinimo = Number(p.estoqueMinimo ?? 0)
      const matchEstoque = (() => {
        if (estoqueFiltro === 'todos') return true
        if (estoqueFiltro === 'sem-estoque') return estoqueAtual <= 0
        if (estoqueFiltro === 'baixo')
          return estoqueAtual > 0 && estoqueAtual <= (estoqueMinimo || 1)
        return estoqueAtual > (estoqueMinimo || 1)
      })()

      if (statusFiltro === 'ativos')
        return p.ativo !== false && matchBusca && matchCategoria && matchEstoque
      if (statusFiltro === 'inativos')
        return p.ativo === false && matchBusca && matchCategoria && matchEstoque
      return matchBusca && matchCategoria && matchEstoque
    })
  }, [produtos, busca, categoriaFiltro, estoqueFiltro, statusFiltro])

  const { data: historico = [] } = useQuery({
    queryKey: ['historico-precos', editando?.id],
    queryFn: () => api.get(`/produtos/${editando?.id}/historico-precos`).then((r) => r.data),
    enabled: !!editando?.id && modalHistorico,
  })

  const salvar = useMutation({
    mutationFn: (data: any) => {
      const payload = {
        codigoInterno: data.codigoInterno,
        nome: data.nome,
        categoriaId: data.categoriaId || undefined,
        unidadeVenda: data.unidadeVenda || 'CAIXA',
        precoSugerido: Number(data.precoSugerido) || 0,
        custo: data.custo ? Number(data.custo) : undefined,
        estoqueMinimo: data.estoqueMinimo ? Number(data.estoqueMinimo) : undefined,
        limiteEstoqueBaixo: data.limiteEstoqueBaixo ? Number(data.limiteEstoqueBaixo) : undefined,
        exibirQuantidadeAproximada: !!data.exibirQuantidadeAproximada,
        exibirNoPortalCliente: data.exibirNoPortalCliente !== false,
      }
      return editando
        ? api.put(`/produtos/${editando.id}`, payload)
        : api.post('/produtos', payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] })
      fechar()
    },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/produtos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  })

  const reativar = useMutation({
    mutationFn: (id: string) => api.post(`/produtos/${id}/reativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  })

  function abrirNovo() {
    setForm(EMPTY)
    setEditando(null)
    setModal(true)
  }
  function abrirEditar(p: any) {
    setForm({
      ...p,
      precoSugerido: Number(p.precoSugerido) || '',
      custo: p.custo != null ? Number(p.custo) : '',
      estoqueMinimo: String(p.estoqueMinimo ?? ''),
      categoriaId: p.categoriaId ?? p.categoria?.id ?? '',
      limiteEstoqueBaixo: String(p.limiteEstoqueBaixo ?? ''),
      exibirQuantidadeAproximada: !!p.exibirQuantidadeAproximada,
      exibirNoPortalCliente: p.exibirNoPortalCliente !== false,
    })
    setEditando(p)
    setModal(true)
  }
  function abrirHistorico(p: any) {
    setEditando(p)
    setModalHistorico(true)
  }
  function fechar() {
    setModal(false)
    setModalHistorico(false)
    setEditando(null)
  }
  function set(k: string, v: any) {
    setForm((f: any) => ({ ...f, [k]: v }))
  }

  function formatarDataArquivo() {
    return new Date().toISOString().slice(0, 10)
  }

  async function exportarExcel() {
    const linhas = produtosFiltrados.map((p: any) => ({
      Código: p.codigoInterno ?? '',
      Nome: p.nome ?? '',
      Categoria: p.categoria?.nome ?? '',
      Unidade: p.unidadeVenda ?? '',
      'Preço Sugerido': Number(p.precoSugerido ?? 0),
      Custo: Number(p.custo ?? 0),
      Estoque: Number(p.estoqueAtual ?? 0),
      'Estoque Mínimo': Number(p.estoqueMinimo ?? 0),
      Status: p.ativo === false ? 'Inativo' : 'Ativo',
    }))

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Produtos')
    worksheet.columns = [
      { header: 'Código', key: 'Código', width: 16 },
      { header: 'Nome', key: 'Nome', width: 28 },
      { header: 'Categoria', key: 'Categoria', width: 18 },
      { header: 'Unidade', key: 'Unidade', width: 12 },
      { header: 'Preço Sugerido', key: 'Preço Sugerido', width: 18 },
      { header: 'Custo', key: 'Custo', width: 14 },
      { header: 'Estoque', key: 'Estoque', width: 12 },
      { header: 'Estoque Mínimo', key: 'Estoque Mínimo', width: 18 },
      { header: 'Status', key: 'Status', width: 12 },
    ]
    worksheet.addRows(linhas)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `produtos-${formatarDataArquivo()}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Relatório de Produtos', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Código', 'Nome', 'Categoria', 'Unidade', 'Estoque', 'Preço', 'Custo', 'Status']],
      body: produtosFiltrados.map((p: any) => [
        p.codigoInterno ?? '',
        p.nome ?? '',
        p.categoria?.nome ?? '',
        p.unidadeVenda ?? '',
        Number(p.estoqueAtual ?? 0),
        formatBRL(p.precoSugerido),
        p.custo ? formatBRL(p.custo) : '—',
        p.ativo === false ? 'Inativo' : 'Ativo',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74] },
      margin: { left: 10, right: 10 },
    })

    doc.save(`produtos-${formatarDataArquivo()}.pdf`)
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle={`${produtosFiltrados.length} produto(s) exibido(s) • Status padrão: ativos`}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={exportarExcel}
              disabled={produtosFiltrados.length === 0}
            >
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button
              variant="secondary"
              onClick={exportarPdf}
              disabled={produtosFiltrados.length === 0}
            >
              <FileText className="w-4 h-4" /> Exportar PDF
            </Button>
            <Button onClick={abrirNovo}>
              <Plus className="w-4 h-4" /> Novo Produto
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
            <div className="relative xl:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, código ou categoria"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <Select
              label="Status"
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value as StatusFiltro)}
            >
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
              <option value="todos">Todos</option>
            </Select>

            <Select
              label="Categoria"
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
            >
              <option value="">Todas</option>
              {categorias.map((categoria: any) => (
                <option key={categoria.id} value={categoria.id}>
                  {categoria.nome}
                </option>
              ))}
            </Select>

            <Select
              label="Estoque"
              value={estoqueFiltro}
              onChange={(e) => setEstoqueFiltro(e.target.value as EstoqueFiltro)}
            >
              <option value="todos">Todos</option>
              <option value="sem-estoque">Sem estoque</option>
              <option value="baixo">Baixo</option>
              <option value="normal">Normal</option>
            </Select>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {isLoading && <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>}
          {!isLoading && produtosFiltrados.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum produto encontrado</p>
          )}
          {produtosFiltrados.map((p: any) => (
            <div
              key={p.id}
              className={`rounded-xl border border-gray-200 bg-white p-4 ${p.ativo === false ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{p.nome}</p>
                  <p className="text-xs text-gray-400">
                    {p.codigoInterno} · {p.categoria?.nome ?? '—'}
                  </p>
                </div>
                <p className="text-sm font-semibold text-green-700">{formatBRL(p.precoSugerido)}</p>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Estoque {Number(p.estoqueAtual ?? 0)} {p.unidadeVenda}
              </p>
              <div className="mt-3 flex justify-end gap-1">
                <Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => abrirHistorico(p)}>
                  <History className="w-3.5 h-3.5" />
                </Button>
                {p.ativo === false ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-green-600"
                    onClick={() => reativar.mutate(p.id)}
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:bg-red-50"
                    onClick={() => {
                      if (confirm(`Desativar ${p.nome}?`)) excluir.mutate(p.id)
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Código</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Categoria
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Unidade</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                    Estoque
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                    Preço Sugerido
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Custo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
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
                {!isLoading && produtosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-gray-400">
                      Nenhum produto encontrado
                    </td>
                  </tr>
                )}
                {produtosFiltrados.map((p: any) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-gray-50 ${p.ativo === false ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-gray-600">{p.codigoInterno}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{p.categoria?.nome ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{p.unidadeVenda}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {Number(p.estoqueAtual ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-700 font-semibold">
                      {formatBRL(p.precoSugerido)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {p.custo ? formatBRL(p.custo) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {p.ativo === false ? (
                        <span className="text-xs font-medium text-red-600">Inativo</span>
                      ) : (
                        <span className="text-xs font-medium text-green-600">Ativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => abrirHistorico(p)}>
                          <History className="w-3.5 h-3.5" />
                        </Button>
                        {p.ativo === false ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-600"
                            onClick={() => reativar.mutate(p.id)}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:bg-red-50"
                            onClick={() => {
                              if (
                                confirm(
                                  `Desativar ${p.nome}? Pedidos antigos continuam no histórico.`,
                                )
                              )
                                excluir.mutate(p.id)
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>

      <Modal open={modal} onClose={fechar} title={editando ? 'Editar Produto' : 'Novo Produto'}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvar.mutate(form)
          }}
          className="space-y-3"
        >
          <Input
            label="Código Interno *"
            value={form.codigoInterno}
            onChange={(e) => set('codigoInterno', e.target.value)}
            required
          />
          <Input
            label="Nome *"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            required
          />
          <Select
            label="Categoria"
            value={form.categoriaId}
            onChange={(e) => set('categoriaId', e.target.value)}
          >
            <option value="">Sem categoria</option>
            {categorias.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
          <Select
            label="Unidade de Venda"
            value={form.unidadeVenda}
            onChange={(e) => set('unidadeVenda', e.target.value)}
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyInput
              label="Preço Sugerido (R$) *"
              value={form.precoSugerido}
              onValueChange={(v) => set('precoSugerido', v)}
              required
            />
            <MoneyInput
              label="Custo (R$)"
              value={form.custo}
              onValueChange={(v) => set('custo', v)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Estoque mínimo"
              type="number"
              min="0"
              value={form.estoqueMinimo}
              onChange={(e) => set('estoqueMinimo', e.target.value)}
            />
            <Input
              label="Limite de estoque baixo"
              type="number"
              min="0"
              value={form.limiteEstoqueBaixo}
              onChange={(e) => set('limiteEstoqueBaixo', e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={!!form.exibirQuantidadeAproximada}
              onChange={(e) => set('exibirQuantidadeAproximada', e.target.checked)}
            />
            Mostrar quantidade aproximada no portal do cliente
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.exibirNoPortalCliente !== false}
              onChange={(e) => set('exibirNoPortalCliente', e.target.checked)}
            />
            Exibir no portal do cliente
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modalHistorico}
        onClose={fechar}
        title={`Histórico de Preços — ${editando?.nome}`}
      >
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            Nenhuma alteração de preço registrada
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 text-xs text-gray-500">Data</th>
                  <th className="text-right py-2 text-xs text-gray-500">Anterior</th>
                  <th className="text-right py-2 text-xs text-gray-500">Novo</th>
                  <th className="text-left py-2 text-xs text-gray-500">Usuário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {historico.map((h: any) => (
                  <tr key={h.id}>
                    <td className="py-2 text-gray-600">{formatDateTime(h.data)}</td>
                    <td className="py-2 text-right text-gray-400">{formatBRL(h.valorAnterior)}</td>
                    <td className="py-2 text-right font-semibold text-green-700">
                      {formatBRL(h.valorNovo)}
                    </td>
                    <td className="py-2 text-gray-600">{h.usuario?.nome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
