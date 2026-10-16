import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, ListTree, Receipt } from 'lucide-react'
import { api } from '../lib/api'
import { formatBRL, formatDate, formatDateTime } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, MoneyInput, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { TableScroll } from '../components/ui/TableScroll'
import { EditarEntradaModal } from '../components/EditarEntradaModal'

type Lote = {
  id: string
  numero: string
  dataEntrada: string
  produto: { id: string; nome: string; codigoInterno: string; unidadeVenda: string }
  quantidadeInicial: number
  quantidadeDisponivel: number
  quantidadeVendida: number
  valorUnitario: number
  observacao: string | null
  compraId: string | null
  vendas: {
    pedidoId: string
    numeroPedido: number
    data: string
    cliente: string | null
    quantidade: number
  }[]
}

function hojeISO() {
  return new Date().toLocaleDateString('en-CA')
}

const FORM_VAZIO = {
  dataLote: hojeISO(),
  numeroLote: '',
  fornecedor: '',
  produtoId: '',
  quantidade: '',
  valorProduto: 0,
  observacao: '',
}

function mensagemErro(erro: any, padrao: string) {
  const msg = erro?.response?.data?.message
  return Array.isArray(msg) ? msg.join(' ') : (msg ?? padrao)
}

export function LotesPage() {
  const qc = useQueryClient()
  const [produtoId, setProdutoId] = useState('')
  const [situacao, setSituacao] = useState<'' | 'DISPONIVEL' | 'ESGOTADO'>('DISPONIVEL')
  const [modalNovo, setModalNovo] = useState(false)
  const [form, setForm] = useState({ ...FORM_VAZIO })
  const [erroNovo, setErroNovo] = useState('')
  const [editando, setEditando] = useState<Lote | null>(null)
  const [formEdicao, setFormEdicao] = useState({ numero: '', observacao: '' })
  const [erroEdicao, setErroEdicao] = useState('')
  const [vendasDe, setVendasDe] = useState<Lote | null>(null)
  const [compraEditando, setCompraEditando] = useState<string | null>(null)

  const { data: lotes = [], isLoading } = useQuery<Lote[]>({
    queryKey: ['lotes', produtoId, situacao],
    queryFn: () =>
      api
        .get('/estoque/lotes', {
          params: { produtoId: produtoId || undefined, situacao: situacao || undefined },
        })
        .then((r) => r.data),
  })

  const { data: historico } = useQuery<{
    movimentos: {
      id: string
      data: string
      origem: string
      quantidade: number
      tipo: 'ENTRADA' | 'SAIDA'
      saldoAntes: number | null
      saldoDepois: number | null
      numeroPedido: number | null
      cliente: string | null
      usuario: string | null
    }[]
  }>({
    queryKey: ['lote-historico', vendasDe?.id],
    queryFn: () => api.get(`/estoque/lotes/${vendasDe!.id}/historico`).then((r) => r.data),
    enabled: !!vendasDe,
  })

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => r.data),
  })

  // Sugere o próximo número do dia (lote 1, lote 2...) ao abrir o cadastro ou trocar a data
  const { data: sugestao } = useQuery({
    queryKey: ['lote-proximo-numero', form.dataLote],
    queryFn: () =>
      api
        .get('/estoque/lotes/proximo-numero', { params: { data: form.dataLote } })
        .then((r) => r.data as { numero: string }),
    enabled: modalNovo && !!form.dataLote,
  })

  useEffect(() => {
    if (sugestao?.numero) setForm((f) => ({ ...f, numeroLote: sugestao.numero }))
  }, [sugestao?.numero])

  const criar = useMutation({
    mutationFn: () =>
      api.post('/estoque/entrada', {
        fornecedor: form.fornecedor,
        observacao: form.observacao || undefined,
        dataLote: form.dataLote,
        numeroLote: form.numeroLote.trim() || undefined,
        itens: [
          {
            produtoId: form.produtoId,
            quantidade: Number(form.quantidade),
            valorProduto: Number(form.valorProduto || 0),
          },
        ],
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes'] })
      qc.invalidateQueries({ queryKey: ['estoque-saldos'] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setModalNovo(false)
      setForm({ ...FORM_VAZIO, dataLote: hojeISO() })
    },
    onError: (erro) => setErroNovo(mensagemErro(erro, 'Não foi possível cadastrar o lote.')),
  })

  const salvarEdicao = useMutation({
    mutationFn: () =>
      api.patch(`/estoque/lotes/${editando!.id}`, {
        numero: formEdicao.numero,
        observacao: formEdicao.observacao,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lotes'] })
      setEditando(null)
    },
    onError: (erro) => setErroEdicao(mensagemErro(erro, 'Não foi possível salvar o lote.')),
  })

  const totalDisponivel = lotes.reduce((acc, l) => acc + l.quantidadeDisponivel, 0)
  const totalVendido = lotes.reduce((acc, l) => acc + l.quantidadeVendida, 0)

  return (
    <div>
      <PageHeader
        title="Lotes"
        subtitle="Cada lote tem data, número, quantidade e valor. A baixa acontece sozinha a cada venda aprovada."
        actions={
          <Button
            onClick={() => {
              setErroNovo('')
              setForm({ ...FORM_VAZIO, dataLote: hojeISO() })
              setModalNovo(true)
            }}
          >
            <Plus className="w-4 h-4" /> Novo lote
          </Button>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select label="Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
            <option value="">Todos</option>
            {produtos.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
          <Select
            label="Situação"
            value={situacao}
            onChange={(e) => setSituacao(e.target.value as typeof situacao)}
          >
            <option value="DISPONIVEL">Com saldo</option>
            <option value="ESGOTADO">Esgotados</option>
            <option value="">Todos</option>
          </Select>
          <div className="flex items-end gap-4 text-sm text-gray-600">
            <p>
              Disponível <strong className="text-gray-900">{totalDisponivel.toFixed(0)} cx</strong>
            </p>
            <p>
              Vendido <strong className="text-gray-900">{totalVendido.toFixed(0)} cx</strong>
            </p>
          </div>
        </div>

        <TableScroll>
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Data</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Lote</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Produto</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Entrada</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Vendido</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">
                  Disponível
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">Valor/cx</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => (
                <tr key={lote.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(lote.dataEntrada)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">Lote {lote.numero}</td>
                  <td className="px-4 py-3">
                    {lote.produto.nome}
                    {lote.observacao && <p className="text-xs text-gray-400">{lote.observacao}</p>}
                  </td>
                  <td className="px-4 py-3 text-right">{lote.quantidadeInicial.toFixed(0)}</td>
                  <td className="px-4 py-3 text-right">{lote.quantidadeVendida.toFixed(0)}</td>
                  <td className="px-4 py-3 text-right">
                    {lote.quantidadeDisponivel > 0 ? (
                      <strong className="text-green-700">
                        {lote.quantidadeDisponivel.toFixed(0)} cx
                      </strong>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-600">Esgotado</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {formatBRL(lote.valorUnitario)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setVendasDe(lote)}
                        title="Entrada, vendas, devoluções e ajustes com o saldo do lote"
                      >
                        <ListTree className="w-3.5 h-3.5" /> Histórico ({lote.vendas.length} venda
                        {lote.vendas.length === 1 ? '' : 's'})
                      </Button>
                      {lote.compraId && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCompraEditando(lote.compraId)}
                          title="Editar entrada: frete, comissão e valor (recalcula o custo da caixa)"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Frete/comissão
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setErroEdicao('')
                          setFormEdicao({ numero: lote.numero, observacao: lote.observacao ?? '' })
                          setEditando(lote)
                        }}
                        title="Editar lote"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && lotes.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">
                    Nenhum lote encontrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>

      <Modal
        open={modalNovo}
        onClose={() => setModalNovo(false)}
        title="Novo lote"
        closeOnBackdropClick={false}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setErroNovo('')
            criar.mutate()
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data *"
              type="date"
              required
              value={form.dataLote}
              onChange={(e) => setForm((f) => ({ ...f, dataLote: e.target.value }))}
            />
            <Input
              label="Nº do lote *"
              required
              value={form.numeroLote}
              onChange={(e) => setForm((f) => ({ ...f, numeroLote: e.target.value }))}
            />
          </div>
          <Select
            label="Produto *"
            required
            value={form.produtoId}
            onChange={(e) => setForm((f) => ({ ...f, produtoId: e.target.value }))}
          >
            <option value="">Selecione</option>
            {produtos.map((p: any) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantidade (caixas) *"
              type="number"
              min="1"
              required
              value={form.quantidade}
              onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))}
            />
            <MoneyInput
              label="Valor por caixa *"
              required
              value={form.valorProduto}
              onValueChange={(valorProduto) => setForm((f) => ({ ...f, valorProduto }))}
            />
          </div>
          <Input
            label="Fornecedor *"
            required
            value={form.fornecedor}
            onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
          />
          <Input
            label="Observação"
            value={form.observacao}
            onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
          />
          {form.produtoId && Number(form.quantidade) > 0 && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              {form.dataLote.split('-').reverse().slice(0, 2).join('/')} - lote{' '}
              {form.numeroLote || '?'} - {form.quantidade} caixas{' '}
              {produtos.find((p: any) => p.id === form.produtoId)?.nome} -{' '}
              {formatBRL(form.valorProduto)}
            </p>
          )}
          <p className="text-xs text-gray-500">
            O lote entra no estoque na hora. Para uma compra com vários produtos, frete e comissão,
            use "Registrar Entrada" na aba Estoque.
          </p>
          {erroNovo && <p className="text-sm text-red-600">{erroNovo}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setModalNovo(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criar.isPending}>
              {criar.isPending ? 'Salvando...' : 'Cadastrar lote'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!editando}
        onClose={() => setEditando(null)}
        title={`Editar lote — ${editando?.produto.nome ?? ''}`}
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setErroEdicao('')
            salvarEdicao.mutate()
          }}
          className="space-y-3"
        >
          <Input
            label="Nº do lote *"
            required
            value={formEdicao.numero}
            onChange={(e) => setFormEdicao((f) => ({ ...f, numero: e.target.value }))}
          />
          <Input
            label="Observação"
            value={formEdicao.observacao}
            onChange={(e) => setFormEdicao((f) => ({ ...f, observacao: e.target.value }))}
          />
          <p className="text-xs text-gray-500">
            Quantidades mudam por entrada de estoque ou pelas vendas, não por aqui.
          </p>
          {erroEdicao && <p className="text-sm text-red-600">{erroEdicao}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setEditando(null)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvarEdicao.isPending}>
              {salvarEdicao.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!vendasDe}
        onClose={() => setVendasDe(null)}
        size="lg"
        title={
          vendasDe
            ? `Histórico — ${formatDate(vendasDe.dataEntrada).slice(0, 5)} - lote ${vendasDe.numero} — ${vendasDe.produto.nome}`
            : ''
        }
      >
        <div className="space-y-2">
          {historico?.movimentos.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900">
                  {m.numeroPedido ? `Pedido #${m.numeroPedido}` : m.origem}
                  {m.cliente ? ` · ${m.cliente}` : ''}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateTime(m.data)}
                  {m.numeroPedido ? ` · ${m.origem}` : ''}
                  {m.usuario ? ` · ${m.usuario}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <strong className={m.tipo === 'SAIDA' ? 'text-red-600' : 'text-green-700'}>
                  {m.tipo === 'SAIDA' ? '−' : '+'}
                  {m.quantidade.toFixed(0)} cx
                </strong>
                {m.saldoAntes != null && (
                  <p className="text-xs text-gray-500">
                    saldo {m.saldoAntes.toFixed(0)} → {m.saldoDepois?.toFixed(0)}
                  </p>
                )}
              </div>
            </div>
          ))}
          {historico && historico.movimentos.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">Nenhuma movimentação</p>
          )}
        </div>
      </Modal>
      <EditarEntradaModal compraId={compraEditando} onClose={() => setCompraEditando(null)} />
    </div>
  )
}
