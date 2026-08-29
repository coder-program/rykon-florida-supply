import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, History } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDateTime } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'

const EMPTY = { codigoInterno: '', nome: '', categoria: '', unidadeVenda: 'CAIXA', precoSugerido: '', custo: '' }

export function ProdutosPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [modalHistorico, setModalHistorico] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => r.data),
  })

  const { data: historico = [] } = useQuery({
    queryKey: ['historico-precos', editando?.id],
    queryFn: () => api.get(`/produtos/${editando?.id}/historico-precos`).then((r) => r.data),
    enabled: !!editando?.id && modalHistorico,
  })

  const salvar = useMutation({
    mutationFn: (data: any) => editando
      ? api.put(`/produtos/${editando.id}`, { ...data, precoSugerido: Number(data.precoSugerido), custo: data.custo ? Number(data.custo) : undefined })
      : api.post('/produtos', { ...data, precoSugerido: Number(data.precoSugerido), custo: data.custo ? Number(data.custo) : undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['produtos'] }); fechar() },
  })

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModal(true) }
  function abrirEditar(p: any) { setForm({ ...p, precoSugerido: String(p.precoSugerido), custo: String(p.custo ?? '') }); setEditando(p); setModal(true) }
  function abrirHistorico(p: any) { setEditando(p); setModalHistorico(true) }
  function fechar() { setModal(false); setModalHistorico(false); setEditando(null) }
  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle={`${produtos.length} produto(s) ativo(s)`}
        actions={<Button onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Produto</Button>}
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
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
              {produtos.map((p: any) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-600">{p.codigoInterno}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{p.categoria ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{p.unidadeVenda}</td>
                  <td className="px-4 py-3 text-right text-green-700 font-semibold">{formatBRL(p.precoSugerido)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.custo ? formatBRL(p.custo) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => abrirHistorico(p)}><History className="w-3.5 h-3.5" /></Button>
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
            <Input label="Preço Sugerido (R$) *" type="number" step="0.01" value={form.precoSugerido} onChange={(e) => set('precoSugerido', e.target.value)} required />
            <Input label="Custo (R$)" type="number" step="0.01" value={form.custo} onChange={(e) => set('custo', e.target.value)} />
          </div>
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
