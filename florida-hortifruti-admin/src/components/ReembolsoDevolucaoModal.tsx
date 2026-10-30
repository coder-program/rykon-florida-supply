import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { FORMAS_PAGAMENTO, FORMA_PAGAMENTO_LABEL } from '../lib/utils'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Input'
import { Modal } from './ui/Modal'

function hojeIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function ReembolsoDevolucaoModal({
  devolucao,
  onFechar,
}: {
  devolucao: any
  onFechar: () => void
}) {
  const qc = useQueryClient()
  const [tipo, setTipo] = useState<'CAIXAS' | 'DINHEIRO'>('DINHEIRO')
  const [data, setData] = useState(hojeIso)
  const [quantidade, setQuantidade] = useState(String(devolucao.quantidadeCaixas ?? ''))
  const [loteId, setLoteId] = useState('')
  const [valor, setValor] = useState(String(devolucao.valorDevolucao ?? ''))
  const [formaPagamento, setFormaPagamento] = useState('')
  const [perdaQuantidade, setPerdaQuantidade] = useState(String(devolucao.quantidadeCaixas ?? ''))
  const [perdaLote, setPerdaLote] = useState('')
  const [perdaValor, setPerdaValor] = useState('')
  const [erro, setErro] = useState('')

  const produtos = new Set((devolucao.itens ?? []).map((i: any) => i.produtoId))

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes-disponiveis'],
    enabled: tipo === 'CAIXAS',
    queryFn: () =>
      api.get('/estoque/lotes/disponiveis').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })
  const lotesDoProduto = (lotes as any[]).filter((l) => produtos.has(l.produtoId))

  // Todos os lotes, inclusive esgotados: a perda é do lote de onde as caixas saíram
  const { data: todosLotes = [] } = useQuery({
    queryKey: ['lotes-perda'],
    queryFn: () =>
      api.get('/relatorios/lucro-lote/lotes').then((r) => (Array.isArray(r.data) ? r.data : [])),
  })
  const lotesPerda = (todosLotes as any[]).filter((l) => produtos.has(l.produtoId))

  const { data: pedido } = useQuery({
    queryKey: ['devolucao-pedido-detalhe', devolucao.pedidoId],
    queryFn: () => api.get(`/pedidos/${devolucao.pedidoId}`).then((r) => r.data),
  })
  // Já vem no lote de onde o pedido saiu; pode ser trocado
  const loteDoPedido = (pedido?.itens ?? []).find(
    (i: any) => i.loteId && produtos.has(i.produtoId),
  )?.loteId
  const perdaLoteId = perdaLote || loteDoPedido || ''
  // O pedido já perde a venda; a perda é o custo das caixas, que pode ser corrigido
  const custoLotePerda = lotesPerda.find((l) => l.id === perdaLoteId)?.custoUnitario ?? 0
  const perdaSugerida = (Number(perdaQuantidade) * custoLotePerda).toFixed(2)

  const salvar = useMutation({
    mutationFn: () =>
      api.patch(
        `/devolucoes/${devolucao.id}/reembolso`,
        tipo === 'CAIXAS'
          ? {
              tipo,
              data,
              quantidadeCaixas: Number(quantidade),
              loteId,
              perdaQuantidade: Number(perdaQuantidade),
              perdaLoteId,
            }
          : {
              tipo,
              data,
              valor: Number(valor),
              formaPagamento,
              perdaQuantidade: Number(perdaQuantidade),
              perdaLoteId,
              perdaValor: Number(perdaValor || perdaSugerida),
            },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-devolucoes'] })
      qc.invalidateQueries({ queryKey: ['devolucoes-resumo-geral'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onFechar()
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message
      setErro(Array.isArray(msg) ? msg.join(' ') : msg || 'Não foi possível registrar o reembolso')
    },
  })

  const completo =
    !!data &&
    Number(perdaQuantidade) > 0 &&
    !!perdaLoteId &&
    (tipo === 'CAIXAS' ? Number(quantidade) > 0 && !!loteId : Number(valor) > 0 && !!formaPagamento)

  return (
    <Modal open onClose={onFechar} title="Registrar reembolso">
      <div className="space-y-4">
        <div className="flex rounded-xl bg-gray-100 p-1" role="tablist">
          {(
            [
              ['DINHEIRO', 'Em dinheiro'],
              ['CAIXAS', 'Em caixas'],
            ] as const
          ).map(([valorTipo, rotulo]) => (
            <button
              key={valorTipo}
              type="button"
              role="tab"
              aria-selected={tipo === valorTipo}
              onClick={() => setTipo(valorTipo)}
              className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                tipo === valorTipo
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>

        {tipo === 'DINHEIRO' ? (
          <>
            <Input
              type="number"
              step="0.01"
              min="0"
              label="Valor reembolsado (R$)"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
            <Select
              label="Forma de pagamento"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value)}
            >
              <option value="">Selecione</option>
              {FORMAS_PAGAMENTO.map((forma) => (
                <option key={forma} value={forma}>
                  {FORMA_PAGAMENTO_LABEL[forma]}
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500">
              O pedido é reduzido e as caixas devolvidas não voltam ao estoque. O valor perdido
              sugerido é o custo das caixas.
            </p>
          </>
        ) : (
          <>
            <Input
              type="number"
              min="1"
              label="Quantidade de caixas"
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
            />
            <Select label="Lote" value={loteId} onChange={(e) => setLoteId(e.target.value)}>
              <option value="">Selecione</option>
              {lotesDoProduto.map((lote: any) => (
                <option key={lote.id} value={lote.id}>
                  {new Date(lote.dataEntrada).toLocaleDateString('pt-BR')} · lote {lote.numero} ·{' '}
                  {lote.quantidadeDisponivel} cx
                </option>
              ))}
            </Select>
            <p className="text-xs text-gray-500">
              O valor do pedido não muda. As caixas saem do lote escolhido, e o custo delas entra
              como perda, reduzindo o lucro.
            </p>
          </>
        )}

        <div className="space-y-3 rounded-lg border border-red-100 p-3">
          <p className="text-xs font-semibold text-gray-500">PERDA</p>
          <Input
            type="number"
            min="1"
            label="Caixas perdidas"
            value={perdaQuantidade}
            onChange={(e) => setPerdaQuantidade(e.target.value)}
          />
          <Select
            label="Lote da perda"
            value={perdaLoteId}
            onChange={(e) => setPerdaLote(e.target.value)}
          >
            <option value="">Selecione</option>
            {lotesPerda.map((lote: any) => (
              <option key={lote.id} value={lote.id}>
                {new Date(lote.dataEntrada).toLocaleDateString('pt-BR')} · lote {lote.numero} ·{' '}
                {lote.produto}
              </option>
            ))}
          </Select>
          {tipo === 'DINHEIRO' && (
            <Input
              type="number"
              step="0.01"
              min="0"
              label="Valor perdido (R$)"
              value={perdaValor}
              placeholder={perdaSugerida}
              onChange={(e) => setPerdaValor(e.target.value)}
            />
          )}
        </div>

        <Input
          type="date"
          label="Data do reembolso"
          value={data}
          max={hojeIso()}
          onChange={(e) => setData(e.target.value)}
        />

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <Button
          type="button"
          className="w-full"
          disabled={!completo || salvar.isPending}
          onClick={() => {
            setErro('')
            salvar.mutate()
          }}
        >
          {salvar.isPending ? 'Salvando...' : 'Confirmar reembolso'}
        </Button>
      </div>
    </Modal>
  )
}
