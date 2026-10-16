import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatBRL, formatDate } from '../lib/utils'
import { previewRateio } from '../lib/rateio'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, MoneyInput } from './ui/Input'

type Compra = {
  id: string
  fornecedor: string
  valorFrete: number
  valorComissao: number
  observacao: string | null
  data: string
  itens: {
    id: string
    produto: { id: string; nome: string }
    quantidade: number
    valorUnitario: number
    custoUnitarioFinal: number
    lote: { id: string; numero: string; dataEntrada: string; quantidadeVendida: number } | null
  }[]
}

// Frete e comissão muitas vezes são pagos depois da compra, com parte do lote já vendida.
// Aqui a entrada é corrigida e o custo da caixa de cada lote é recalculado.
export function EditarEntradaModal({
  compraId,
  onClose,
}: {
  compraId: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({
    fornecedor: '',
    valorFrete: 0,
    valorComissao: 0,
    observacao: '',
    valores: {} as Record<string, number>,
  })
  const [erro, setErro] = useState('')

  const { data: compra, isLoading } = useQuery<Compra>({
    queryKey: ['compra-estoque', compraId],
    queryFn: () => api.get(`/estoque/compras/${compraId}`).then((r) => r.data),
    enabled: !!compraId,
  })

  useEffect(() => {
    if (!compra) return
    setErro('')
    setForm({
      fornecedor: compra.fornecedor,
      valorFrete: compra.valorFrete,
      valorComissao: compra.valorComissao,
      observacao: compra.observacao ?? '',
      valores: Object.fromEntries(compra.itens.map((item) => [item.id, item.valorUnitario])),
    })
  }, [compra])

  const rateio = useMemo(
    () =>
      previewRateio(
        (compra?.itens ?? []).map((item) => ({
          produtoId: item.produto.id,
          quantidade: item.quantidade,
          valorProduto: form.valores[item.id] ?? item.valorUnitario,
        })),
        form.valorFrete,
        form.valorComissao,
      ),
    [compra, form.valores, form.valorFrete, form.valorComissao],
  )

  const salvar = useMutation({
    mutationFn: () =>
      api.patch(`/estoque/compras/${compraId}`, {
        fornecedor: form.fornecedor,
        valorFrete: Number(form.valorFrete || 0),
        valorComissao: Number(form.valorComissao || 0),
        observacao: form.observacao,
        itens: (compra?.itens ?? []).map((item) => ({
          id: item.id,
          valorProduto: Number(form.valores[item.id] ?? item.valorUnitario),
        })),
      }),
    onSuccess: () => {
      for (const key of [
        'compra-estoque',
        'estoque-saldos',
        'produtos',
        'dashboard',
        'lotes',
        'historico',
        'metas-hoje',
        'metas-mes',
      ]) {
        qc.invalidateQueries({ queryKey: [key] })
      }
      onClose()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : (msg ?? 'Não foi possível salvar a entrada.'))
    },
  })

  const algumVendido = compra?.itens.some((item) => (item.lote?.quantidadeVendida ?? 0) > 0)

  return (
    <Modal
      open={!!compraId}
      onClose={onClose}
      title="Editar entrada de estoque"
      size="xl"
      closeOnBackdropClick={false}
    >
      {isLoading || !compra ? (
        <p className="py-6 text-center text-sm text-gray-400">Carregando...</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setErro('')
            salvar.mutate()
          }}
          className="space-y-4"
        >
          <p className="text-xs text-gray-500">
            Entrada de {formatDate(compra.data)}. Ao salvar, o custo da caixa de cada lote é
            recalculado com o novo frete e a nova comissão
            {algumVendido ? ', inclusive das caixas que já foram vendidas' : ''}. A quantidade não
            muda aqui; para isso use o Ajuste.
          </p>
          <Input
            label="Fornecedor *"
            value={form.fornecedor}
            required
            onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <MoneyInput
              label="Frete da compra"
              value={form.valorFrete}
              onValueChange={(valorFrete) => setForm((f) => ({ ...f, valorFrete }))}
            />
            <MoneyInput
              label="Comissão da compra"
              value={form.valorComissao}
              onValueChange={(valorComissao) => setForm((f) => ({ ...f, valorComissao }))}
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Produtos da compra
            </p>
            {compra.itens.map((item, index) => {
              const novo = rateio[index]
              const mudou = novo && Math.abs(novo.custoCaixa - item.custoUnitarioFinal) >= 0.005
              return (
                <div key={item.id} className="rounded-xl border border-gray-200 p-3 space-y-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">{item.produto.nome}</p>
                    <p className="text-xs text-gray-500">
                      {item.lote
                        ? `${formatDate(item.lote.dataEntrada).slice(0, 5)} - lote ${item.lote.numero} · `
                        : ''}
                      {item.quantidade.toFixed(0)} cx
                      {item.lote && item.lote.quantidadeVendida > 0
                        ? ` · ${item.lote.quantidadeVendida.toFixed(0)} cx já vendidas`
                        : ''}
                    </p>
                  </div>
                  <MoneyInput
                    label="Valor do produto (por caixa) *"
                    required
                    value={form.valores[item.id] ?? item.valorUnitario}
                    onValueChange={(valor) =>
                      setForm((f) => ({ ...f, valores: { ...f.valores, [item.id]: valor } }))
                    }
                  />
                  {novo && (
                    <p className="text-xs text-gray-600">
                      Custo da caixa: {formatBRL(item.custoUnitarioFinal)}
                      {mudou && (
                        <>
                          {' → '}
                          <strong className="text-green-700">{formatBRL(novo.custoCaixa)}</strong>
                        </>
                      )}
                      {(novo.rateioFrete > 0 || novo.rateioComissao > 0) &&
                        ` · rateio frete ${formatBRL(novo.rateioFrete)} · comissão ${formatBRL(novo.rateioComissao)}`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          <Input
            label="Observação"
            value={form.observacao}
            onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
          />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : 'Salvar e recalcular custo'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
