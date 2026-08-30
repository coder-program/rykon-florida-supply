import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { api } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'

const EMPTY_FORM = { razaoSocialOuNome: '', nomeFantasia: '', cnpjCpf: '', telefone: '', whatsapp: '', email: '', endereco: '', cidade: '', estado: '', responsavelContato: '', condicaoPagamento: '', formaPagamentoUsual: '', necessitaNF: false, observacoes: '' }

export function ClientesPage() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ['clientes', busca],
    queryFn: () => api.get('/clientes', { params: busca ? { busca } : { incluirInativos: true } }).then((r) => r.data),
  })

  const salvar = useMutation({
    mutationFn: (data: any) => editando ? api.put(`/clientes/${editando.id}`, data) : api.post('/clientes', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clientes'] }); fecharModal() },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/clientes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })

  const reativar = useMutation({
    mutationFn: (id: string) => api.post(`/clientes/${id}/reativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })

  function abrirNovo() { setForm(EMPTY_FORM); setEditando(null); setModal(true) }
  function abrirEditar(c: any) { setForm({ ...c }); setEditando(c); setModal(true) }
  function fecharModal() { setModal(false); setEditando(null) }
  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clientes.length} cliente(s) cadastrado(s)`}
        actions={<Button onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Cliente</Button>}
      />

      <div className="p-6 space-y-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, CNPJ ou telefone..." className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome / Fantasia</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">CNPJ/CPF</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cidade</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Pagamento</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">NF</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
              {!isLoading && clientes.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-gray-400">Nenhum cliente encontrado</td></tr>}
              {clientes.map((c: any) => (
                <tr key={c.id} className={`hover:bg-gray-50 ${c.ativo === false ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{c.razaoSocialOuNome}</p>
                    {c.nomeFantasia && <p className="text-xs text-gray-400">{c.nomeFantasia}</p>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.cnpjCpf}</td>
                  <td className="px-4 py-3 text-gray-600">{c.cidade}{c.estado ? `/${c.estado}` : ''}</td>
                  <td className="px-4 py-3 text-gray-600">{c.formaPagamentoUsual ?? '—'}</td>
                  <td className="px-4 py-3">{c.necessitaNF ? <span className="text-green-600 font-medium text-xs">Sim</span> : <span className="text-gray-400 text-xs">Não</span>}</td>
                  <td className="px-4 py-3">
                    {c.ativo === false
                      ? <span className="text-xs font-medium text-red-600">Inativo</span>
                      : <span className="text-xs font-medium text-green-600">Ativo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)}><Pencil className="w-3.5 h-3.5" /></Button>
                      {c.ativo === false ? (
                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => reativar.mutate(c.id)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => { if (confirm(`Desativar ${c.razaoSocialOuNome}? O cadastro permanece no histórico.`)) excluir.mutate(c.id) }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal} onClose={fecharModal} title={editando ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
        <form onSubmit={(e) => { e.preventDefault(); salvar.mutate(form) }} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Input label="Razão Social / Nome *" value={form.razaoSocialOuNome} onChange={(e) => set('razaoSocialOuNome', e.target.value)} required /></div>
            <Input label="Nome Fantasia" value={form.nomeFantasia} onChange={(e) => set('nomeFantasia', e.target.value)} />
            <Input label="CNPJ / CPF *" value={form.cnpjCpf} onChange={(e) => set('cnpjCpf', e.target.value)} required />
            <Input label="Telefone" value={form.telefone} onChange={(e) => set('telefone', e.target.value)} />
            <Input label="WhatsApp" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
            <Input label="E-mail" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} />
            <Input label="Responsável pelo Contato" value={form.responsavelContato} onChange={(e) => set('responsavelContato', e.target.value)} />
            <div className="col-span-2"><Input label="Endereço" value={form.endereco} onChange={(e) => set('endereco', e.target.value)} /></div>
            <Input label="Cidade" value={form.cidade} onChange={(e) => set('cidade', e.target.value)} />
            <Input label="Estado (UF)" value={form.estado} onChange={(e) => set('estado', e.target.value)} maxLength={2} />
            <Input label="Condição de Pagamento" value={form.condicaoPagamento} onChange={(e) => set('condicaoPagamento', e.target.value)} placeholder="Ex: 30 dias" />
            <Select label="Forma de Pagamento Habitual" value={form.formaPagamentoUsual ?? ''} onChange={(e) => set('formaPagamentoUsual', e.target.value)}>
              <option value="">Selecione</option>
              <option>PIX</option><option>Boleto</option><option>Dinheiro</option><option>Outros</option>
            </Select>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="nf" checked={form.necessitaNF} onChange={(e) => set('necessitaNF', e.target.checked)} className="accent-green-600" />
              <label htmlFor="nf" className="text-sm text-gray-700">Necessita Nota Fiscal</label>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Observações</label>
              <textarea value={form.observacoes ?? ''} onChange={(e) => set('observacoes', e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={fecharModal}>Cancelar</Button>
            <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
