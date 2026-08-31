import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, History, Trash2, RotateCcw, FileSpreadsheet, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { api } from '../lib/api'
import { formatBRL, formatDateTime } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, MoneyInput } from '../components/ui/Input'

const EMPTY = { codigoInterno: '', nome: '', categoria: '', unidadeVenda: 'CAIXA', precoSugerido: '', custo: '', estoqueMinimo: '' }

export function ProdutosPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos', { params: { incluirInativos: true } }).then((r) => r.data),
  })

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
        categoria: data.categoria || undefined,
        unidadeVenda: data.unidadeVenda || 'CAIXA',
        precoSugerido: Number(data.precoSugerido) || 0,
        custo: data.custo ? Number(data.custo) : undefined,
        estoqueMinimo: data.estoqueMinimo ? Number(data.estoqueMinimo) : undefined,
      }
      return editando ? api.put(`/produtos/${editando.id}`, payload) : api.post('/produtos', payload)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); fechar() },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/produtos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  })

  const reativar = useMutation({
    mutationFn: (id: string) => api.post(`/produtos/${id}/reativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['produtos'] }),
  })

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModal(true) }
  function abrirEditar(p: any) { setForm({ ...p, precoSugerido: Number(p.precoSugerido) || '', custo: p.custo != null ? Number(p.custo) : '', estoqueMinimo: String(p.estoqueMinimo ?? '') }); setEditando(p); setModal(true) }
  function abrirHistorico(p: any) { setEditando(p); setModalHistorico(true) }
  function fechar() { setModal(false); setModalHistorico(false); setEditando(null) }
  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  function formatarDataArquivo() {
    return new Date().toISOString().slice(0, 10)
  }

  function exportarExcel() {
    const linhas = produtos.map((p: any) => ({
      Código: p.codigoInterno ?? '',
      Nome: p.nome ?? '',
      Categoria: p.categoria ?? '',
      Unidade: p.unidadeVenda ?? '',
      'Preço Sugerido': Number(p.precoSugerido ?? 0),
      Custo: Number(p.custo ?? 0),
      Estoque: Number(p.estoqueAtual ?? 0),
      Status: p.ativo === false ? 'Inativo' : 'Ativo',
    }))

    const ws = XLSX.utils.json_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produtos')
    XLSX.writeFile(wb, `produtos-${formatarDataArquivo()}.xlsx`)
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Relatório de Produtos', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Código', 'Nome', 'Categoria', 'Unidade', 'Preço', 'Custo', 'Status']],
      body: produtos.map((p: any) => [
        p.codigoInterno ?? '',
        p.nome ?? '',
        p.categoria ?? '',
        p.unidadeVenda ?? '',
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
        subtitle={`${produtos.length} produto(s) ativo(s)`}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="secondary" onClick={exportarExcel} disabled={produtos.length === 0}>
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button variant="secondary" onClick={exportarPdf} disabled={produtos.length === 0}>
              <FileText className="w-4 h-4" /> Exportar PDF
            </Button>
            <Button onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Produto</Button>
          </div>
        }
      />

      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Código</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Categoria</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Unidade</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Preço Sugerido</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Custo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <tr><td colSpan={8} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
              {produtos.map((p: any) => (
                <tr key={p.id} className={`hover:bg-gray-50 ${p.ativo === false ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-mono text-gray-600">{p.codigoInterno}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{p.categoria ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.unidadeVenda}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-semibold">{formatBRL(p.precoSugerido)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.custo ? formatBRL(p.custo) : '—'}</td>
                  <td className="px-4 py-3">
                    {p.ativo === false
                      ? <span className="text-xs font-medium text-red-600">Inativo</span>
                      : <span className="text-xs font-medium text-green-600">Ativo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => abrirHistorico(p)}><History className="w-3.5 h-3.5" /></Button>
                      {p.ativo === false ? (
                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => reativar.mutate(p.id)}><RotateCcw className="w-3.5 h-3.5" /></Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => { if (confirm(`Desativar ${p.nome}? Pedidos antigos continuam no histórico.`)) excluir.mutate(p.id) }}><Trash2 className="w-3.5 h-3.5" /></Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={fechar} title={editando ? 'Editar Produto' : 'Novo Produto'}>
        <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(form) }} className="space-y-3">
          <Input label="Código Interno *" value={form.codigoInterno} onChange={(e) => set('codigoInterno', e.target.value)} required />
          <Input label="Nome *" value={form.nome} onChange={(e) => set('nome', e.target.value)} required />
          <Input label="Categoria" value={form.categoria} onChange={(e) => set('categoria', e.target.value)} />
          <Input label="Unidade de Venda" value={form.unidadeVenda} onChange={(e) => set('unidadeVenda', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Preço Sugerido (R$) *" value={form.precoSugerido} onValueChange={(v) => set('precoSugerido', v)} required />
            <MoneyInput label="Custo (R$)" value={form.custo} onValueChange={(v) => set('custo', v)} />
          </div>
          <Input label="Estoque mínimo (caixas)" type="number" min="0" value={form.estoqueMinimo} onChange={(e) => set('estoqueMinimo', e.target.value)} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={fechar}>Cancelar</Button>
            <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={modalHistorico} onClose={fechar} title={`Histórico de Preços — ${editando?.nome}`}>
        {historico.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">Nenhuma alteração de preço registrada</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-left py-2 text-xs text-gray-500">Data</th>
              <th className="text-right py-2 text-xs text-gray-500">Anterior</th>
              <th className="text-right py-2 text-xs text-gray-500">Novo</th>
              <th className="text-left py-2 text-xs text-gray-500">Usuário</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {historico.map((h: any) => (
                <tr key={h.id}>
                  <td className="py-2 text-gray-600">{formatDateTime(h.data)}</td>
                  <td className="py-2 text-right text-gray-400">{formatBRL(h.valorAnterior)}</td>
                  <td className="py-2 text-right font-semibold text-green-700">{formatBRL(h.valorNovo)}</td>
                  <td className="py-2 text-gray-600">{h.usuario?.nome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Modal>
    </div>
  )
}
