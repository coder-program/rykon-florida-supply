import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  History,
  Minus,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Trash2,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api } from '../lib/api'
import { formatBRL, formatDate } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, MoneyInput, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const MOTIVOS_AJUSTE = [
  'Correção de cadastro',
  'Perda',
  'Avaria',
  'Divergência',
  'Contagem física',
  'Ajuste inicial',
]

type ItemForm = { produtoId: string; quantidade: string; valorProduto: number }

const ITEM_VAZIO: ItemForm = { produtoId: '', quantidade: '', valorProduto: 0 }

function toCents(value: number) {
  return Math.round(Number(value || 0) * 100)
}

function fromCents(cents: number) {
  return Number((cents / 100).toFixed(2))
}

function valorLinhaCompra(item: { valorProdutoInformado?: number; quantidade?: number }) {
  return Number(item.valorProdutoInformado ?? 0)
}

function unitarioCompra(item: { valorProdutoInformado?: number; quantidade?: number }) {
  const qtd = Number(item.quantidade ?? 0)
  return qtd > 0 ? valorLinhaCompra(item) / qtd : 0
}

function previewRateio(itens: ItemForm[], valorFrete: number, valorComissao: number) {
  const validos = itens.filter((item) => item.produtoId && Number(item.quantidade) > 0)
  if (validos.length === 0) return []

  const freteCents = toCents(valorFrete)
  const comissaoCents = toCents(valorComissao)
  const valoresCents = validos.map((item) =>
    toCents(Number(item.quantidade || 0) * Number(item.valorProduto || 0)),
  )
  const totalCents = valoresCents.reduce((acc, value) => acc + value, 0)
  let usadoFrete = 0
  let usadoComissao = 0

  return validos.map((item, index) => {
    const ultimo = index === validos.length - 1
    const peso = totalCents > 0 ? valoresCents[index] / totalCents : 1 / validos.length
    const rateioFreteCents = ultimo ? freteCents - usadoFrete : Math.round(freteCents * peso)
    const rateioComissaoCents = ultimo
      ? comissaoCents - usadoComissao
      : Math.round(comissaoCents * peso)
    usadoFrete += rateioFreteCents
    usadoComissao += rateioComissaoCents
    const valorProduto = fromCents(valoresCents[index])
    const rateioFrete = fromCents(rateioFreteCents)
    const rateioComissao = fromCents(rateioComissaoCents)
    const custoTotal = Number((valorProduto + rateioFrete + rateioComissao).toFixed(2))
    const quantidade = Number(item.quantidade)
    return {
      produtoId: item.produtoId,
      quantidade,
      valorUnitario: Number(item.valorProduto || 0),
      valorProduto,
      rateioFrete,
      rateioComissao,
      custoTotal,
      custoCaixa: quantidade > 0 ? Number((custoTotal / quantidade).toFixed(4)) : 0,
    }
  })
}

export function EstoquePage() {
  const qc = useQueryClient()
  const [modalEntrada, setModalEntrada] = useState(false)
  const [modalAjuste, setModalAjuste] = useState(false)
  const [produtoHistorico, setProdutoHistorico] = useState<any>(null)
  const [formEntrada, setFormEntrada] = useState({
    fornecedor: '',
    valorFrete: 0,
    valorComissao: 0,
    observacao: '',
    itens: [{ ...ITEM_VAZIO }],
  })
  const [formAjuste, setFormAjuste] = useState({
    produtoId: '',
    quantidade: '',
    motivo: MOTIVOS_AJUSTE[0],
    observacao: '',
  })

  const { data: saldos = [] } = useQuery({
    queryKey: ['estoque-saldos'],
    queryFn: () => api.get('/estoque/saldos').then((r) => r.data),
  })

  const { data: produtos = [] } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => api.get('/produtos').then((r) => r.data),
  })

  const listaProdutos = saldos.length > 0 ? saldos : produtos
  const nomeProduto = (id: string) =>
    listaProdutos.find((p: any) => (p.produtoId ?? p.id) === id)?.nome ?? 'Produto'

  const { data: historico = [] } = useQuery({
    queryKey: ['historico', produtoHistorico?.produtoId],
    queryFn: () => api.get(`/estoque/${produtoHistorico.produtoId}/historico`).then((r) => r.data),
    enabled: !!produtoHistorico,
  })

  const rateio = useMemo(
    () => previewRateio(formEntrada.itens, formEntrada.valorFrete, formEntrada.valorComissao),
    [formEntrada.itens, formEntrada.valorFrete, formEntrada.valorComissao],
  )

  const totalProdutos = rateio.reduce((acc, item) => acc + item.valorProduto, 0)

  const entrada = useMutation({
    mutationFn: () =>
      api.post('/estoque/entrada', {
        fornecedor: formEntrada.fornecedor,
        valorFrete: Number(formEntrada.valorFrete || 0),
        valorComissao: Number(formEntrada.valorComissao || 0),
        observacao: formEntrada.observacao || undefined,
        itens: formEntrada.itens
          .filter((item) => item.produtoId && Number(item.quantidade) > 0)
          .map((item) => ({
            produtoId: item.produtoId,
            quantidade: Number(item.quantidade),
            valorProduto: Number(item.valorProduto || 0),
          })),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['estoque-saldos'] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setModalEntrada(false)
      setFormEntrada({
        fornecedor: '',
        valorFrete: 0,
        valorComissao: 0,
        observacao: '',
        itens: [{ ...ITEM_VAZIO }],
      })
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

  function atualizarItem(index: number, patch: Partial<ItemForm>) {
    setFormEntrada((atual) => ({
      ...atual,
      itens: atual.itens.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  async function exportarExcel() {
    const linhas = saldos.map((s: any) => ({
      Produto: s.nome ?? '',
      Unidade: s.unidadeVenda ?? '',
      Saldo: Number(s.saldoAtual ?? 0),
      'Custo caixa': Number(s.custoCaixa ?? 0),
      'Estoque mínimo': Number(s.estoqueMinimo ?? 0),
      Status: s.abaixoMinimo
        ? 'Abaixo do mínimo'
        : Number(s.saldoAtual) <= 0
          ? 'Sem estoque'
          : 'Normal',
    }))

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Estoque')
    worksheet.columns = [
      { header: 'Produto', key: 'Produto', width: 28 },
      { header: 'Unidade', key: 'Unidade', width: 12 },
      { header: 'Saldo', key: 'Saldo', width: 12 },
      { header: 'Custo caixa', key: 'Custo caixa', width: 14 },
      { header: 'Estoque mínimo', key: 'Estoque mínimo', width: 18 },
      { header: 'Status', key: 'Status', width: 18 },
    ]
    worksheet.addRows(linhas)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `estoque-${formatarDataArquivo()}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Relatório de Estoque', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [['Produto', 'Unidade', 'Saldo', 'Custo caixa', 'Estoque mínimo', 'Status']],
      body: saldos.map((s: any) => [
        s.nome ?? '',
        s.unidadeVenda ?? '',
        Number(s.saldoAtual ?? 0).toFixed(0),
        s.custoCaixa != null ? formatBRL(s.custoCaixa) : '—',
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
            <Button variant="secondary" onClick={() => setModalAjuste(true)}>
              <Minus className="w-4 h-4" /> Ajuste
            </Button>
            <Button
              onClick={() => {
                setFormEntrada({
                  fornecedor: '',
                  valorFrete: 0,
                  valorComissao: 0,
                  observacao: '',
                  itens: [{ ...ITEM_VAZIO }],
                })
                setModalEntrada(true)
              }}
            >
              <Plus className="w-4 h-4" /> Registrar Entrada
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-4">
        {saldos.some((s: any) => s.abaixoMinimo) && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 font-medium">
              {saldos
                .filter((s: any) => s.abaixoMinimo)
                .map((s: any) => s.nome)
                .join(', ')}{' '}
              — abaixo do estoque mínimo
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {saldos.map((s: any) => (
            <div
              key={s.produtoId}
              className={`bg-white rounded-xl border p-4 ${
                s.abaixoMinimo
                  ? 'border-amber-400 bg-amber-50'
                  : Number(s.saldoAtual) <= 0
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs text-gray-500 leading-tight">{s.nome}</p>
                {s.abaixoMinimo && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
              </div>
              <p
                className={`text-2xl font-bold ${Number(s.saldoAtual) <= 0 ? 'text-red-600' : s.abaixoMinimo ? 'text-amber-700' : 'text-gray-900'}`}
              >
                {Number(s.saldoAtual).toFixed(0)}
              </p>
              <p className="text-xs text-gray-400">{s.unidadeVenda}</p>
              {s.custoCaixa != null && (
                <p className="text-xs text-gray-600 mt-1">Custo caixa: {formatBRL(s.custoCaixa)}</p>
              )}
              {s.estoqueMinimo !== null && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Mínimo: {s.estoqueMinimo} {s.unidadeVenda}
                </p>
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

      <Modal
        open={modalEntrada}
        onClose={() => setModalEntrada(false)}
        title="Registrar Entrada de Estoque"
        size="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            entrada.mutate()
          }}
          className="space-y-4"
        >
          <Input
            label="Fornecedor *"
            value={formEntrada.fornecedor}
            onChange={(e) => setFormEntrada((f) => ({ ...f, fornecedor: e.target.value }))}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyInput
              label="Frete da compra (opcional)"
              value={formEntrada.valorFrete}
              onValueChange={(valorFrete) => setFormEntrada((f) => ({ ...f, valorFrete }))}
            />
            <MoneyInput
              label="Comissão da compra (opcional)"
              value={formEntrada.valorComissao}
              onValueChange={(valorComissao) => setFormEntrada((f) => ({ ...f, valorComissao }))}
            />
          </div>
          <p className="text-xs text-gray-500">
            Valor total = quantidade de caixas × valor do produto. Frete e comissão não entram nesse
            total; só no custo da caixa.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Produtos da compra
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setFormEntrada((f) => ({ ...f, itens: [...f.itens, { ...ITEM_VAZIO }] }))
                }
              >
                <Plus className="w-3.5 h-3.5" /> Adicionar produto
              </Button>
            </div>

            {formEntrada.itens.map((item, index) => {
              const preview = rateio.find(
                (r) => r.produtoId === item.produtoId && r.quantidade === Number(item.quantidade),
              )
              return (
                <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <Select
                        label="Produto *"
                        value={item.produtoId}
                        required
                        onChange={(e) => atualizarItem(index, { produtoId: e.target.value })}
                      >
                        <option value="">Selecione</option>
                        {listaProdutos.map((p: any) => (
                          <option key={p.produtoId ?? p.id} value={p.produtoId ?? p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </Select>
                    </div>
                    {formEntrada.itens.length > 1 && (
                      <button
                        type="button"
                        className="mt-6 text-gray-400 hover:text-red-600"
                        onClick={() =>
                          setFormEntrada((f) => ({
                            ...f,
                            itens: f.itens.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input
                      label="Quantidade (caixas) *"
                      type="number"
                      min="1"
                      required
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(index, { quantidade: e.target.value })}
                    />
                    <MoneyInput
                      label="Valor do produto (por caixa) *"
                      required
                      value={item.valorProduto}
                      onValueChange={(valorProduto) => atualizarItem(index, { valorProduto })}
                    />
                  </div>
                  {preview && (
                    <p className="text-xs text-gray-500">
                      {preview.quantidade} cx × {formatBRL(item.valorProduto)} ={' '}
                      <strong className="text-gray-800">{formatBRL(preview.valorProduto)}</strong>
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {rateio.length > 0 && (
            <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 space-y-2">
              {rateio.map((item) => (
                <p key={`${item.produtoId}-${item.quantidade}`} className="text-xs text-gray-600">
                  {nomeProduto(item.produtoId)}: {item.quantidade} cx ×{' '}
                  {formatBRL(item.valorUnitario)} = {formatBRL(item.valorProduto)}
                </p>
              ))}
              <div className="flex items-end justify-between gap-2 border-t border-green-200 pt-2">
                <p className="text-sm font-semibold text-green-800">
                  Valor total {formatBRL(totalProdutos)}
                </p>
              </div>
            </div>
          )}

          <Input
            label="Observação"
            value={formEntrada.observacao}
            onChange={(e) => setFormEntrada((f) => ({ ...f, observacao: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setModalEntrada(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={entrada.isPending}>
              {entrada.isPending ? 'Salvando...' : 'Registrar Entrada'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={modalAjuste} onClose={() => setModalAjuste(false)} title="Ajuste de Estoque">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            ajuste.mutate(formAjuste)
          }}
          className="space-y-3"
        >
          <Select
            label="Produto *"
            value={formAjuste.produtoId}
            onChange={(e) => setFormAjuste((f) => ({ ...f, produtoId: e.target.value }))}
            required
          >
            <option value="">Selecione</option>
            {listaProdutos.map((p: any) => (
              <option key={p.produtoId ?? p.id} value={p.produtoId ?? p.id}>
                {p.nome}
              </option>
            ))}
          </Select>
          <Input
            label="Quantidade (positivo = entrada, negativo = saída) *"
            type="number"
            value={formAjuste.quantidade}
            onChange={(e) => setFormAjuste((f) => ({ ...f, quantidade: e.target.value }))}
            required
          />
          <Select
            label="Motivo *"
            value={formAjuste.motivo}
            onChange={(e) => setFormAjuste((f) => ({ ...f, motivo: e.target.value }))}
          >
            {MOTIVOS_AJUSTE.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <Input
            label="Observação"
            value={formAjuste.observacao}
            onChange={(e) => setFormAjuste((f) => ({ ...f, observacao: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={() => setModalAjuste(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={ajuste.isPending}>
              {ajuste.isPending ? 'Salvando...' : 'Salvar Ajuste'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!produtoHistorico}
        onClose={() => setProdutoHistorico(null)}
        title={`Histórico — ${produtoHistorico?.nome}`}
        size="xl"
      >
        <div className="space-y-3">
          {historico.map((m: any) => {
            const compra = m.itemCompra?.compra
            const itensCompra = compra?.itens ?? []
            const totalCompra = itensCompra.reduce(
              (acc: number, item: any) => acc + valorLinhaCompra(item),
              0,
            )
            const qtd = Number(m.quantidade)
            return (
              <div key={m.id} className="rounded-xl border border-gray-200 px-4 py-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">{formatDate(m.data)}</span>
                    <Badge className={tipoCor[m.tipo]}>{m.tipo}</Badge>
                    <span
                      className={`text-sm font-semibold ${qtd > 0 ? 'text-green-700' : 'text-red-600'}`}
                    >
                      {qtd > 0 ? '+' : ''}
                      {qtd.toFixed(0)} cx
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">{m.usuario?.nome}</p>
                </div>

                {compra ? (
                  <div className="space-y-2 text-sm">
                    <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 text-xs text-gray-600">
                      <p>
                        Fornecedor <strong className="text-gray-800">{compra.fornecedor}</strong>
                      </p>
                      <p>
                        Frete {formatBRL(compra.valorFrete)} · Comissão{' '}
                        {formatBRL(compra.valorComissao)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-gray-50 px-3 py-2 space-y-1">
                      {itensCompra.map((item: any) => {
                        const atual = item.produto?.id === produtoHistorico?.produtoId
                        return (
                          <p
                            key={item.id}
                            className={`text-xs ${atual ? 'font-semibold text-gray-800' : 'text-gray-600'}`}
                          >
                            {item.produto?.nome}: {Number(item.quantidade).toFixed(0)} cx ×{' '}
                            {formatBRL(unitarioCompra(item))} = {formatBRL(valorLinhaCompra(item))}
                            {atual ? ' · este produto' : ''}
                          </p>
                        )
                      })}
                      <p className="text-sm font-semibold text-green-800 pt-1 border-t border-gray-200">
                        Valor total {formatBRL(totalCompra)}
                      </p>
                    </div>
                    {m.custoUnitario != null && (
                      <p className="text-xs text-gray-500">
                        Custo desta caixa {formatBRL(m.custoUnitario)}
                        {Number(m.itemCompra.rateioFrete) > 0 ||
                        Number(m.itemCompra.rateioComissao) > 0
                          ? ` · rateio frete ${formatBRL(m.itemCompra.rateioFrete)} · comissão ${formatBRL(m.itemCompra.rateioComissao)}`
                          : ''}
                      </p>
                    )}
                    {(compra.observacao || m.observacao) && (
                      <p className="text-xs text-gray-500">
                        Observação: {compra.observacao || m.observacao}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-600 space-y-0.5">
                    {m.custoUnitario != null && <p>Custo caixa {formatBRL(m.custoUnitario)}</p>}
                    <p>{m.origem}</p>
                    {m.motivoAjuste && <p>Motivo: {m.motivoAjuste}</p>}
                    {m.observacao && <p>Observação: {m.observacao}</p>}
                  </div>
                )}
              </div>
            )
          })}
          {historico.length === 0 && (
            <p className="text-center py-4 text-sm text-gray-400">Nenhuma movimentação</p>
          )}
        </div>
      </Modal>
    </div>
  )
}
