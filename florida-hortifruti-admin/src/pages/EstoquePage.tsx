import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, History, Minus, AlertTriangle, FileSpreadsheet, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const MOTIVOS_AJUSTE = ['Correção de cadastro', 'Perda', 'Avaria', 'Divergência', 'Contagem física', 'Ajuste inicial']

export function EstoquePage() {
  const qc = useQueryClient()
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [produtoHistorico, setProdutoHistorico] = useState<any>(null)
  const [formEntrada, setFormEntrada] = useState({ produtoId: '', fornecedor: '', quantidade: '', custoTotal: '', observacao: '' })
  const [formAjuste, setFormAjuste] = useState({ produtoId: '', quantidade: '', motivo: MOTIVOS_AJUSTE[0], observacao: '' })

  const { data: saldos = [] } = useQuery({
    queryKey: ['estoque-saldos'],
    queryFn: () => api.get('/estoque/saldos').then((r) => r.data),
  })

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => r.data),
  })

  const { data: historico = [] } = useQuery({
    queryKey: ['historico', produtoHistorico?.produtoId],
    queryFn: () => api.get(`/estoque/${produtoHistorico.produtoId}/historico`).then((r) => r.data),
    enabled: !!produtoHistorico,
  })

  const entrada = useMutation({
    mutationFn: (d: any) => api.post('/estoque/entrada', { ...d, quantidade: Number(d.quantidade), custoTotal: Number(d.custoTotal) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-saldos'] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setModalEntrada(false)
    },
  })

  const ajuste = useMutation({
    mutationFn: (d: any) => api.post('/estoque/ajuste', { ...d, quantidade: Number(d.quantidade) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-saldos'] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setModalAjuste(false)
    },
  })

  const tipoCor: Record<string, string> = {
    ENTRADA: 'bg-green-100 text-green-700',
    SAIDA: 'bg-red-100 text-red-700',
    AJUSTE: 'bg-yellow-100 text-yellow-700',
  }

  function formatarDataArquivo() {
    return new Date().toISOString().slice(0, 10)
  }

  function exportarExcel() {
    const linhas = saldos.map((s: any) => ({
      Produto: s.nome ?? '',
      Unidade: s.unidadeVenda ?? '',
      Saldo: Number(s.saldoAtual ?? 0),
      'Estoque mínimo': Number(s.estoqueMinimo ?? 0),
      Status: s.abaixoMinimo ? 'Abaixo do mínimo' : Number(s.saldoAtual) <= 0 ? 'Sem estoque' : 'Normal',
    }))

    const ws = XLSX.utils.json_to_sheet(linhas)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Estoque')
    XLSX.writeFile(wb, `estoque-${formatarDataArquivo()}.xlsx`)
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Relatório de Estoque', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Produto', 'Unidade', 'Saldo Atual', 'Estoque Mínimo', 'Status']],
      body: saldos.map((s: any) => [
        s.nome ?? '',
        s.unidadeVenda ?? '',
        Number(s.saldoAtual ?? 0).toFixed(0),
        Number(s.estoqueMinimo ?? 0).toFixed(0),
        s.abaixoMinimo ? 'Abaixo do mínimo' : Number(s.saldoAtual) <= 0 ? 'Sem estoque' : 'Normal',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74] },
      margin: { left: 10, right: 10 },
    })

    doc.save(`estoque-${formatarDataArquivo()}.pdf`)
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        subtitle="Saldo atual e movimentações — o histórico nunca é apagado"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportarExcel} disabled={saldos.length === 0}>
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button variant="secondary" onClick={exportarPdf} disabled={saldos.length === 0}>
              <FileText className="w-4 h-4" /> Exportar PDF
            </Button>
            <Button variant="secondary" onClick={() => setModalAjuste(true)}><Minus className="w-4 h-4" /> Ajuste</Button>
            <Button onClick={() => setModalEntrada(true)}><Plus className="w-4 h-4" /> Registrar Entrada</Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {/* Alerta global de estoque mínimo */}
        {saldos.some((s: any) => s.abaixoMinimo) && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {saldos.filter((s: any) => s.abaixoMinimo).map((s: any) => s.nome).join(', ')} — abaixo do estoque mínimo
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {saldos.map((s: any) => (
            <div
              key={s.produtoId}
              className={`bg-white rounded-xl border p-4 ${
                s.abaixoMinimo ? 'border-amber-400 bg-amber-50' : Number(s.saldoAtual) <= 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs text-gray-500 leading-tight">{s.nome}</p>
                {s.abaixoMinimo && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              </div>
              <p className={`text-2xl font-bold ${Number(s.saldoAtual) <= 0 ? 'text-red-600' : s.abaixoMinimo ? 'text-amber-700' : 'text-gray-900'}`}>
                {Number(s.saldoAtual).toFixed(0)}
              </p>
              <p className="text-xs text-gray-400">{s.unidadeVenda}</p>
              {s.estoqueMinimo !== null && (
                <p className="text-xs text-gray-400 mt-0.5">Mínimo: {s.estoqueMinimo} {s.unidadeVenda}</p>
              )}
              <button
                onClick={() => setProdutoHistorico(s)}
                className="mt-3 flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
              >
                <History className="w-3 h-3" /> Ver histórico
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Entrada */}
      <Modal open={modalEntrada} onClose={() => setModalEntrada(false)} title="Registrar Entrada de Estoque">
        <form onSubmit={(e) => { e.preventDefault(); entrada.mutate(formEntrada) }} className="space-y-3">
          <Select label="Produto *" value={formEntrada.produtoId} onChange={(e) => setFormEntrada((f) => ({ ...f, produtoId: e.target.value }))} required>
            <option value="">Selecione</option>
            {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <Input label="Fornecedor *" value={formEntrada.fornecedor} onChange={(e) => setFormEntrada((f) => ({ ...f, fornecedor: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Quantidade (caixas) *" type="number" min="1" value={formEntrada.quantidade} onChange={(e) => setFormEntrada((f) => ({ ...f, quantidade: e.target.value }))} required />
            <Input label="Custo Total (R$) *" type="number" step="0.01" value={formEntrada.custoTotal} onChange={(e) => setFormEntrada((f) => ({ ...f, custoTotal: e.target.value }))} required />
          </div>
          <Input label="Observação" value={formEntrada.observacao} onChange={(e) => setFormEntrada((f) => ({ ...f, observacao: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setModalEntrada(false)}>Cancelar</Button>
            <Button type="submit" disabled={entrada.isPending}>{entrada.isPending ? 'Salvando...' : 'Registrar Entrada'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Ajuste */}
      <Modal open={modalAjuste} onClose={() => setModalAjuste(false)} title="Ajuste de Estoque">
        <form onSubmit={(e) => { e.preventDefault(); ajuste.mutate(formAjuste) }} className="space-y-3">
          <Select label="Produto *" value={formAjuste.produtoId} onChange={(e) => setFormAjuste((f) => ({ ...f, produtoId: e.target.value }))} required>
            <option value="">Selecione</option>
            {produtos.map((p: any) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <Input label="Quantidade (positivo = entrada, negativo = saída) *" type="number" value={formAjuste.quantidade} onChange={(e) => setFormAjuste((f) => ({ ...f, quantidade: e.target.value }))} required />
          <Select label="Motivo *" value={formAjuste.motivo} onChange={(e) => setFormAjuste((f) => ({ ...f, motivo: e.target.value }))}>
            {MOTIVOS_AJUSTE.map((m) => <option key={m} value={m}>{m}</option>)}
          </Select>
          <Input label="Observação" value={formAjuste.observacao} onChange={(e) => setFormAjuste((f) => ({ ...f, observacao: e.target.value }))} />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setModalAjuste(false)}>Cancelar</Button>
            <Button type="submit" disabled={ajuste.isPending}>{ajuste.isPending ? 'Salvando...' : 'Salvar Ajuste'}</Button>
          </div>
        </form>
      </Modal>

      {/* Modal Histórico */}
      <Modal open={!!produtoHistorico} onClose={() => setProdutoHistorico(null)} title={`Histórico — ${produtoHistorico?.nome}`} size="lg">
        <table className="w-full text-sm">
          <thead><tr className="border-b">
            <th className="text-left py-2 text-xs text-gray-500">Data</th>
            <th className="text-left py-2 text-xs text-gray-500">Tipo</th>
            <th className="text-right py-2 text-xs text-gray-500">Qtd</th>
            <th className="text-left py-2 text-xs text-gray-500">Origem</th>
            <th className="text-left py-2 text-xs text-gray-500">Usuário</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {historico.map((m: any) => (
              <tr key={m.id}>
                <td className="py-2 text-gray-600">{formatDate(m.data)}</td>
                <td className="py-2"><Badge className={tipoCor[m.tipo]}>{m.tipo}</Badge></td>
                <td className={`py-2 text-right font-semibold ${Number(m.quantidade) > 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {Number(m.quantidade) > 0 ? '+' : ''}{Number(m.quantidade).toFixed(0)}
                </td>
                <td className="py-2 text-gray-600">{m.origem}</td>
                <td className="py-2 text-gray-500">{m.usuario?.nome}</td>
              </tr>
            ))}
            {historico.length === 0 && <tr><td colSpan={5} className="text-center py-4 text-gray-400">Nenhuma movimentação</td></tr>}
          </tbody>
        </table>
      </Modal>
    </div>
  )
}
