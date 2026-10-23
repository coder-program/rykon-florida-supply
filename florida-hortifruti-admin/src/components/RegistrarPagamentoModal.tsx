import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatBRL, hojeISO } from '../lib/utils'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, MoneyInput } from './ui/Input'

export type PedidoPagamento = {
  id: string
  numero: number
  totalFinal: number | string
  saldoDevedor?: number
}

// Registra o pagamento com a data em que o cliente realmente pagou (vem hoje, pode ser anterior).
// Quitação total ou parcial; parcial só para financeiro e supervisor (a API também valida).
export function RegistrarPagamentoModal({
  pedido,
  onClose,
  onPago,
}: {
  pedido: PedidoPagamento | null
  onClose: () => void
  onPago?: (pedidoId: string) => void
}) {
  const qc = useQueryClient()
  const [data, setData] = useState(hojeISO)
  const [parcial, setParcial] = useState(false)
  const [valor, setValor] = useState<number | ''>('')

  const saldo = Number(pedido?.saldoDevedor ?? pedido?.totalFinal ?? 0)

  function fechar() {
    setData(hojeISO())
    setParcial(false)
    setValor('')
    registrar.reset()
    onClose()
  }

  const registrar = useMutation({
    mutationFn: async () => {
      if (parcial) {
        await api.post(`/financeiro/pagamento/${pedido!.id}`, { valor: Number(valor), data })
      } else {
        await api.post(`/financeiro/marcar-pago/${pedido!.id}`, { data })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contas-a-receber'] })
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] })
      qc.invalidateQueries({ queryKey: ['pedidos'] })
      if (pedido) onPago?.(pedido.id)
      fechar()
    },
  })

  const valorInvalido = parcial && (!(Number(valor) > 0) || Number(valor) > saldo + 0.01)

  return (
    <Modal
      open={!!pedido}
      onClose={fechar}
      title={`Registrar pagamento · #${String(pedido?.numero ?? '').padStart(6, '0')}`}
      size="sm"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!valorInvalido) registrar.mutate()
        }}
        className="space-y-3"
      >
        <p className="text-sm text-gray-600">
          Em aberto: <strong className="text-gray-900">{formatBRL(saldo)}</strong>
        </p>
        <Input
          label="Data do pagamento *"
          type="date"
          value={data}
          max={hojeISO()}
          onChange={(e) => setData(e.target.value)}
          required
        />
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={parcial}
            onChange={(e) => setParcial(e.target.checked)}
            className="accent-green-600"
          />
          Pagamento parcial
        </label>
        {parcial && (
          <MoneyInput label="Valor pago (R$) *" value={valor} onValueChange={setValor} required />
        )}
        {parcial && Number(valor) > saldo + 0.01 && (
          <p className="text-xs text-red-600">O valor passa do saldo em aberto.</p>
        )}
        {registrar.isError && (
          <p className="text-xs text-red-600">
            {(registrar.error as any)?.response?.data?.message ??
              'Não foi possível registrar o pagamento.'}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={fechar}>
            Cancelar
          </Button>
          <Button type="submit" disabled={registrar.isPending || !data || valorInvalido}>
            {registrar.isPending
              ? 'Salvando...'
              : parcial
                ? 'Registrar pagamento'
                : 'Marcar como pago'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
