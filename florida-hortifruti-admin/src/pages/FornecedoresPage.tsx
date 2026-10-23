import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, RotateCcw, Search } from 'lucide-react'
import { api } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import type { Fornecedor } from '../components/FornecedorSelect'

const EMPTY = { nome: '', documento: '', telefone: '', observacao: '' }

type StatusFiltro = 'ativos' | 'inativos' | 'todos'

// Fornecedores escolhidos na entrada de cada lote (Estoque/Lotes)
export function FornecedoresPage() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('ativos')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Fornecedor | null>(null)
  const [form, setForm] = useState(EMPTY)

  const { data: fornecedores = [], isLoading } = useQuery<Fornecedor[]>({
    queryKey: ['fornecedores', 'todos'],
    queryFn: () =>
      api.get('/fornecedores', { params: { incluirInativos: true } }).then((r) => r.data),
  })

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return fornecedores.filter((f) => {
      if (statusFiltro === 'ativos' && !f.ativo) return false
      if (statusFiltro === 'inativos' && f.ativo) return false
      if (!termo) return true
      return [f.nome, f.documento, f.telefone].some((v) => v?.toLowerCase().includes(termo))
    })
  }, [fornecedores, busca, statusFiltro])

  function atualizarListas() {
    qc.invalidateQueries({ queryKey: ['fornecedores'] })
  }

  const salvar = useMutation({
    mutationFn: (data: typeof EMPTY) =>
      editando ? api.put(`/fornecedores/${editando.id}`, data) : api.post('/fornecedores', data),
    onSuccess: () => {
      atualizarListas()
      fechar()
    },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/fornecedores/${id}`),
    onSuccess: atualizarListas,
  })

  const reativar = useMutation({
    mutationFn: (id: string) => api.post(`/fornecedores/${id}/reativar`),
    onSuccess: atualizarListas,
  })

  function abrirNovo() {
    setForm(EMPTY)
    setEditando(null)
    salvar.reset()
    setModal(true)
  }

  function abrirEditar(f: Fornecedor) {
    setForm({
      nome: f.nome,
      documento: f.documento ?? '',
      telefone: f.telefone ?? '',
      observacao: f.observacao ?? '',
    })
    setEditando(f)
    salvar.reset()
    setModal(true)
  }

  function fechar() {
    setModal(false)
    setEditando(null)
  }

  function set(campo: keyof typeof EMPTY, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }))
  }

  function acoes(f: Fornecedor) {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => abrirEditar(f)}>
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        {f.ativo ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:bg-red-50"
            onClick={() => {
              if (confirm(`Desativar ${f.nome}? As compras antigas continuam no histórico.`))
                excluir.mutate(f.id)
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="text-green-600"
            onClick={() => reativar.mutate(f.id)}
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle={`${filtrados.length} fornecedor(es) exibido(s)`}
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4" /> Novo Fornecedor
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, documento ou telefone"
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
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {isLoading && (
            <p className="brand-loading py-8 text-center text-sm text-gray-400">Carregando...</p>
          )}
          {!isLoading && filtrados.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum fornecedor encontrado</p>
          )}
          {filtrados.map((f) => (
            <div
              key={f.id}
              className={`rounded-xl border border-gray-200 bg-white p-4 ${f.ativo ? '' : 'opacity-60'}`}
            >
              <p className="font-semibold text-gray-900">{f.nome}</p>
              <p className="text-xs text-gray-400">
                {[f.documento, f.telefone].filter(Boolean).join(' · ') ||
                  'Sem documento ou telefone'}
              </p>
              {f.observacao && <p className="mt-2 text-xs text-gray-500">{f.observacao}</p>}
              <div className="mt-3">{acoes(f)}</div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    CNPJ/CPF
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Telefone
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Observação
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      Nenhum fornecedor encontrado
                    </td>
                  </tr>
                )}
                {filtrados.map((f) => (
                  <tr key={f.id} className={`hover:bg-gray-50 ${f.ativo ? '' : 'opacity-60'}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{f.documento ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.telefone ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{f.observacao ?? '—'}</td>
                    <td className="px-4 py-3">
                      {f.ativo ? (
                        <span className="text-xs font-medium text-green-600">Ativo</span>
                      ) : (
                        <span className="text-xs font-medium text-red-600">Inativo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{acoes(f)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={fechar}
        title={editando ? 'Editar Fornecedor' : 'Novo Fornecedor'}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvar.mutate(form)
          }}
          className="space-y-3"
        >
          <Input
            label="Nome *"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="CNPJ/CPF"
              value={form.documento}
              onChange={(e) => set('documento', e.target.value)}
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => set('telefone', e.target.value)}
            />
          </div>
          <Input
            label="Observação"
            value={form.observacao}
            onChange={(e) => set('observacao', e.target.value)}
          />
          {salvar.isError && (
            <p className="text-xs text-red-600">
              {(salvar.error as any)?.response?.data?.message ??
                'Não foi possível salvar o fornecedor.'}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending || !form.nome.trim()}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
