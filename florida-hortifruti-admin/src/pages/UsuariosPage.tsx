import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, UserX, RotateCcw } from 'lucide-react'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const PAPEL_COLOR: Record<string, string> = {
  ADMINISTRADOR: 'bg-purple-100 text-purple-700',
  ADMINISTRATIVO: 'bg-blue-100 text-blue-700',
  VENDEDOR: 'bg-green-100 text-green-700',
}

const EMPTY = { nome: '', email: '', senha: '', papel: 'VENDEDOR' }

export function UsuariosPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>(EMPTY)

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  })

  const salvar = useMutation({
    mutationFn: (data: any) => editando ? api.put(`/usuarios/${editando.id}`, data) : api.post('/usuarios', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['usuarios'] }); fechar() },
  })

  const desativar = useMutation({
    mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const reativar = useMutation({
    mutationFn: (id: string) => api.post(`/usuarios/${id}/reativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  function abrirNovo() { setForm(EMPTY); setEditando(null); setModal(true) }
  function abrirEditar(u: any) { setForm({ ...u, senha: '' }); setEditando(u); setModal(true) }
  function fechar() { setModal(false); setEditando(null) }
  function set(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })) }

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Gerenciar vendedores e administradores"
        actions={<Button onClick={abrirNovo}><Plus className="w-4 h-4" /> Novo Usuário</Button>}
      />

      <div className="p-6">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">E-mail</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Papel</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cadastrado em</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && <tr><td colSpan={6} className="text-center py-8 text-gray-400">Carregando...</td></tr>}
              {usuarios.map((u: any) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${u.ativo === false ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.nome}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><Badge className={PAPEL_COLOR[u.papel]}>{u.papel}</Badge></td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(u.criadoEm)}</td>
                  <td className="px-4 py-3">
                    {u.ativo === false
                      ? <span className="text-xs font-medium text-red-600">Inativo</span>
                      : <span className="text-xs font-medium text-green-600">Ativo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => abrirEditar(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                      {u.ativo === false ? (
                        <Button size="sm" variant="ghost" className="text-green-600" onClick={() => reativar.mutate(u.id)}>
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50"
                          onClick={() => { if (confirm(`Desativar ${u.nome}? O usuário deixa de acessar o sistema, mas o histórico permanece.`)) desativar.mutate(u.id) }}
                        >
                          <UserX className="w-3.5 h-3.5" />
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

      <Modal open={modal} onClose={fechar} title={editando ? 'Editar Usuário' : 'Novo Usuário'}>
        <form onSubmit={(e) => {
          e.preventDefault()
          const payload: any = { nome: form.nome, email: form.email, papel: form.papel }
          if (form.senha) payload.senha = form.senha
          salvar.mutate(payload)
        }} className="space-y-3">
          <Input label="Nome *" value={form.nome} onChange={(e) => set('nome', e.target.value)} required />
          <Input label="E-mail *" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required />
          <Input
            label={editando ? 'Nova Senha (deixe em branco para manter)' : 'Senha *'}
            type="password"
            value={form.senha}
            onChange={(e) => set('senha', e.target.value)}
            required={!editando}
            minLength={6}
          />
          <Select label="Papel *" value={form.papel} onChange={(e) => set('papel', e.target.value)}>
            <option value="VENDEDOR">Vendedor</option>
            <option value="ADMINISTRATIVO">Administrativo/Financeiro</option>
            <option value="ADMINISTRADOR">Administrador</option>
          </Select>
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={fechar}>Cancelar</Button>
            <Button type="submit" disabled={salvar.isPending}>{salvar.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
