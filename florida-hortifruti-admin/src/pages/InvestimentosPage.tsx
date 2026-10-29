import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Undo2, Search } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate, hojeISO } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, MoneyInput, Select } from '../components/ui/Input'

type StatusInvestimento = 'FALTA_DEVOLVER' | 'PARCIAL' | 'DEVOLVIDO'

type Investimento = {
  id: string
  nome: string
  data: string
  valor: number
  motivo: string
  valorDevolvido: number
  valorRestante: number
  status: StatusInvestimento
  devolvidoEm: string | null
  devolucoes: { id: string; valor: number; data: string; observacao: string | null }[]
}

const STATUS_LABEL: Record<StatusInvestimento, string> = {
  FALTA_DEVOLVER: 'Falta devolver',
  PARCIAL: 'Devolvido em parte',
  DEVOLVIDO: 'Devolvido',
}

const STATUS_CLASS: Record<StatusInvestimento, string> = {
  FALTA_DEVOLVER: 'bg-amber-100 text-amber-800',
  PARCIAL: 'bg-blue-100 text-blue-700',
  DEVOLVIDO: 'bg-green-100 text-green-700',
}

const FORM_VAZIO = { nome: '', data: hojeISO(), valor: 0 as number | '', motivo: '' }

// Datas vêm como meio-dia de Brasília; o input date quer YYYY-MM-DD
function paraInputData(data: string) {
  return new Date(data).toLocaleDateString('en-CA')
}

function mensagemErro(erro: unknown, padrao: string) {
  const msg = (erro as any)?.response?.data?.message
  return Array.isArray(msg) ? msg.join(' ') : (msg ?? padrao)
}

// Aportes dos sócios na empresa e as devoluções desses valores (só admin e financeiro)
export function InvestimentosPage() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'' | 'ABERTOS' | StatusInvestimento>('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Investimento | null>(null)
  const [form, setForm] = useState(FORM_VAZIO)
  const [devolvendo, setDevolvendo] = useState<Investimento | null>(null)
  const [formDevolucao, setFormDevolucao] = useState({
    valor: 0 as number | '',
    data: hojeISO(),
    observacao: '',
  })

  const { data: investimentos = [], isLoading } = useQuery<Investimento[]>({
    queryKey: ['investimentos'],
    queryFn: () => api.get('/investimentos').then((r) => r.data),
  })

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return investimentos.filter((inv) => {
      if (filtroStatus === 'ABERTOS' && inv.status === 'DEVOLVIDO') return false
      if (filtroStatus && filtroStatus !== 'ABERTOS' && inv.status !== filtroStatus) return false
      if (!termo) return true
      return [inv.nome, inv.motivo].some((v) => v.toLowerCase().includes(termo))
    })
  }, [investimentos, busca, filtroStatus])

  const totais = useMemo(
    () =>
      filtrados.reduce(
        (acc, inv) => ({
          aportado: acc.aportado + inv.valor,
          devolvido: acc.devolvido + inv.valorDevolvido,
          restante: acc.restante + inv.valorRestante,
        }),
        { aportado: 0, devolvido: 0, restante: 0 },
      ),
    [filtrados],
  )

  // Mantém o modal de devolução com os dados atualizados depois de cada alteração
  function atualizarAberto(atualizado: Investimento) {
    setDevolvendo((atual) => (atual?.id === atualizado.id ? atualizado : atual))
  }

  const salvar = useMutation({
    mutationFn: () => {
      const corpo = { ...form, valor: Number(form.valor || 0) }
      return editando
        ? api.put(`/investimentos/${editando.id}`, corpo)
        : api.post('/investimentos', corpo)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investimentos'] })
      fechar()
    },
  })

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/investimentos/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['investimentos'] }),
  })

  const registrarDevolucao = useMutation({
    mutationFn: () =>
      api
        .post(`/investimentos/${devolvendo!.id}/devolucoes`, {
          ...formDevolucao,
          valor: Number(formDevolucao.valor || 0),
        })
        .then((r) => r.data as Investimento),
    onSuccess: (atualizado) => {
      qc.invalidateQueries({ queryKey: ['investimentos'] })
      atualizarAberto(atualizado)
      setFormDevolucao({ valor: atualizado.valorRestante, data: hojeISO(), observacao: '' })
    },
  })

  const excluirDevolucao = useMutation({
    mutationFn: (devolucaoId: string) =>
      api
        .delete(`/investimentos/${devolvendo!.id}/devolucoes/${devolucaoId}`)
        .then((r) => r.data as Investimento),
    onSuccess: (atualizado) => {
      qc.invalidateQueries({ queryKey: ['investimentos'] })
      atualizarAberto(atualizado)
    },
  })

  function abrirNovo() {
    setForm({ ...FORM_VAZIO, data: hojeISO() })
    setEditando(null)
    salvar.reset()
    setModal(true)
  }

  function abrirEditar(inv: Investimento) {
    setForm({ nome: inv.nome, data: paraInputData(inv.data), valor: inv.valor, motivo: inv.motivo })
    setEditando(inv)
    salvar.reset()
    setModal(true)
  }

  function fechar() {
    setModal(false)
    setEditando(null)
  }

  function abrirDevolucao(inv: Investimento) {
    setDevolvendo(inv)
    setFormDevolucao({ valor: inv.valorRestante, data: hojeISO(), observacao: '' })
    registrarDevolucao.reset()
  }

  const valorDevolucaoInvalido =
    !(Number(formDevolucao.valor) > 0) ||
    Number(formDevolucao.valor) > (devolvendo?.valorRestante ?? 0) + 0.001

  function badge(inv: Investimento) {
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[inv.status]}`}>
        {STATUS_LABEL[inv.status]}
      </span>
    )
  }

  function acoes(inv: Investimento) {
    return (
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={() => abrirDevolucao(inv)} title="Devoluções">
          <Undo2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => abrirEditar(inv)} title="Editar">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-red-500 hover:bg-red-50"
          title="Excluir"
          onClick={() => {
            if (confirm(`Excluir o aporte de ${inv.nome} (${formatBRL(inv.valor)})?`))
              excluir.mutate(inv.id)
          }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Investimentos"
        subtitle="Aportes feitos na empresa e o que já foi devolvido"
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="w-4 h-4" /> Novo aporte
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Total aportado</p>
            <p className="mt-1 text-xl font-semibold text-gray-900">{formatBRL(totais.aportado)}</p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Já devolvido</p>
            <p className="mt-1 text-xl font-semibold text-green-700">
              {formatBRL(totais.devolvido)}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">Falta devolver</p>
            <p className="mt-1 text-xl font-semibold text-amber-700">
              {formatBRL(totais.restante)}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome ou motivo"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            <Select
              label="Status"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
            >
              <option value="">Todos</option>
              <option value="ABERTOS">Falta devolver (total ou parte)</option>
              <option value="FALTA_DEVOLVER">Falta devolver</option>
              <option value="PARCIAL">Devolvido em parte</option>
              <option value="DEVOLVIDO">Devolvido</option>
            </Select>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {isLoading && (
            <p className="brand-loading py-8 text-center text-sm text-gray-400">Carregando...</p>
          )}
          {!isLoading && filtrados.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum aporte encontrado</p>
          )}
          {filtrados.map((inv) => (
            <div key={inv.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{inv.nome}</p>
                  <p className="text-xs text-gray-400">{formatDate(inv.data)}</p>
                </div>
                {badge(inv)}
              </div>
              <p className="mt-2 text-lg font-semibold text-gray-900">{formatBRL(inv.valor)}</p>
              <p className="text-xs text-gray-500">{inv.motivo}</p>
              {inv.status !== 'FALTA_DEVOLVER' && (
                <p className="mt-1 text-xs text-gray-500">
                  Devolvido {formatBRL(inv.valorDevolvido)}
                  {inv.devolvidoEm ? ` em ${formatDate(inv.devolvidoEm)}` : ''}
                  {inv.status === 'PARCIAL' ? ` · falta ${formatBRL(inv.valorRestante)}` : ''}
                </p>
              )}
              <div className="mt-3">{acoes(inv)}</div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Motivo</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Devolução
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Nenhum aporte encontrado
                    </td>
                  </tr>
                )}
                {filtrados.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{inv.nome}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(inv.data)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatBRL(inv.valor)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.motivo}</td>
                    <td className="px-4 py-3">{badge(inv)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {inv.status === 'DEVOLVIDO' && inv.devolvidoEm
                        ? `Em ${formatDate(inv.devolvidoEm)}`
                        : inv.status === 'PARCIAL'
                          ? `${formatBRL(inv.valorDevolvido)} · falta ${formatBRL(inv.valorRestante)}`
                          : '—'}
                    </td>
                    <td className="px-4 py-3">{acoes(inv)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>

      <Modal open={modal} onClose={fechar} title={editando ? 'Editar aporte' : 'Novo aporte'}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            salvar.mutate()
          }}
          className="space-y-3"
        >
          <Input
            label="Nome (quem fez o aporte) *"
            value={form.nome}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Data *"
              type="date"
              max={hojeISO()}
              value={form.data}
              onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
              required
            />
            <MoneyInput
              label="Valor (R$) *"
              value={form.valor}
              onValueChange={(valor) => setForm((f) => ({ ...f, valor }))}
              required
            />
          </div>
          <Input
            label="Motivo *"
            value={form.motivo}
            onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
            placeholder="Ex.: compra de câmara fria"
            required
          />
          {salvar.isError && (
            <p className="text-xs text-red-600">
              {mensagemErro(salvar.error, 'Não foi possível salvar o aporte.')}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={
                salvar.isPending ||
                !form.nome.trim() ||
                !form.motivo.trim() ||
                !(Number(form.valor) > 0)
              }
            >
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!devolvendo}
        onClose={() => setDevolvendo(null)}
        title={`Devoluções — ${devolvendo?.nome ?? ''}`}
      >
        {devolvendo && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>
                Aporte: <strong>{formatBRL(devolvendo.valor)}</strong>
              </span>
              <span>
                Devolvido:{' '}
                <strong className="text-green-700">{formatBRL(devolvendo.valorDevolvido)}</strong>
              </span>
              <span>
                Falta:{' '}
                <strong className="text-amber-700">{formatBRL(devolvendo.valorRestante)}</strong>
              </span>
              {badge(devolvendo)}
            </div>

            {devolvendo.devolucoes.length > 0 ? (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {devolvendo.devolucoes.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatBRL(d.valor)}{' '}
                        <span className="font-normal text-gray-500">em {formatDate(d.data)}</span>
                      </p>
                      {d.observacao && <p className="text-xs text-gray-500">{d.observacao}</p>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:bg-red-50"
                      disabled={excluirDevolucao.isPending}
                      onClick={() => {
                        if (confirm('Excluir esta devolução?')) excluirDevolucao.mutate(d.id)
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">Nenhuma devolução registrada ainda.</p>
            )}

            {devolvendo.valorRestante > 0 && (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!valorDevolucaoInvalido) registrarDevolucao.mutate()
                }}
                className="space-y-3 rounded-lg bg-gray-50 p-3"
              >
                <p className="text-sm font-semibold text-gray-800">Registrar devolução</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <MoneyInput
                    label="Valor devolvido (R$) *"
                    value={formDevolucao.valor}
                    onValueChange={(valor) => setFormDevolucao((f) => ({ ...f, valor }))}
                    required
                  />
                  <Input
                    label="Data da devolução *"
                    type="date"
                    max={hojeISO()}
                    value={formDevolucao.data}
                    onChange={(e) => setFormDevolucao((f) => ({ ...f, data: e.target.value }))}
                    required
                  />
                </div>
                <Input
                  label="Observação"
                  value={formDevolucao.observacao}
                  onChange={(e) => setFormDevolucao((f) => ({ ...f, observacao: e.target.value }))}
                />
                {Number(formDevolucao.valor) > devolvendo.valorRestante + 0.001 && (
                  <p className="text-xs text-red-600">O valor passa do que falta devolver.</p>
                )}
                {registrarDevolucao.isError && (
                  <p className="text-xs text-red-600">
                    {mensagemErro(registrarDevolucao.error, 'Não foi possível registrar.')}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={registrarDevolucao.isPending || valorDevolucaoInvalido}
                  >
                    {registrarDevolucao.isPending ? 'Salvando...' : 'Registrar devolução'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
