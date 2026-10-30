import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, MapPin, Truck, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/utils'
import { useAuth } from '../contexts/useAuth'
import { Button } from './ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card'
import { Input } from './ui/Input'
import { Modal } from './ui/Modal'

type Situacao = 'PENDENTE' | 'EM_ROTA' | 'ENTREGUE' | 'PROBLEMA'

interface Entrega {
  id: string
  numero: number
  status: string
  situacao: Situacao
  cliente: string
  endereco: string
  dataPrevista: string | null
  responsavel: string | null
  entregueEm: string | null
  problema: string | null
  problemaEm: string | null
}

const GRUPOS: {
  situacao: Situacao
  titulo: string
  icone: LucideIcon
  cor: string
}[] = [
  {
    situacao: 'PENDENTE',
    titulo: 'Pendente de entrega',
    icone: Clock3,
    cor: 'bg-amber-100 text-amber-800',
  },
  {
    situacao: 'EM_ROTA',
    titulo: 'Em rota de entrega',
    icone: Truck,
    cor: 'bg-cyan-100 text-cyan-800',
  },
  {
    situacao: 'ENTREGUE',
    titulo: 'Entregue',
    icone: CheckCircle2,
    cor: 'bg-emerald-100 text-emerald-700',
  },
  {
    situacao: 'PROBLEMA',
    titulo: 'Entrega com problema',
    icone: AlertTriangle,
    cor: 'bg-red-100 text-red-700',
  },
]

function numeroPedido(numero: number) {
  return `#${String(numero).padStart(6, '0')}`
}

// dataPrevista é gravada como meia-noite UTC do dia escolhido
function formatarPrevista(data: string | null) {
  return data ? new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não definida'
}

function mensagemErro(e: any, padrao: string) {
  const msg = e?.response?.data?.message
  return Array.isArray(msg) ? msg.join(' ') : msg || padrao
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Falha ao ler a foto'))
    reader.readAsDataURL(file)
  })
}

function ModalEntrega({ entrega, onFechar }: { entrega: Entrega; onFechar: () => void }) {
  const qc = useQueryClient()
  const { isSupervisor } = useAuth()
  const [descricao, setDescricao] = useState(entrega.problema ?? '')
  const [dataPrevista, setDataPrevista] = useState(entrega.dataPrevista?.slice(0, 10) ?? '')
  const [foto, setFoto] = useState('')
  const [erro, setErro] = useState('')

  const acao = useMutation({
    mutationFn: (executar: () => Promise<unknown>) => executar(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['painel-entregas'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onFechar()
    },
    onError: (e: any) => setErro(mensagemErro(e, 'Não foi possível atualizar a entrega')),
  })

  const url = `/pedidos/${entrega.id}`
  const emAberto = entrega.situacao !== 'ENTREGUE'
  const emRota = entrega.status === 'EM_ENTREGA'

  async function onFoto(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    setFoto(arquivo ? await toDataUrl(arquivo) : '')
  }

  return (
    <Modal open onClose={onFechar} title={`Entrega ${numeroPedido(entrega.numero)}`}>
      <div className="space-y-4">
        <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
          <p className="font-medium text-gray-900">{entrega.cliente}</p>
          <p>{entrega.endereco || 'Endereço não cadastrado'}</p>
          <p className="text-xs text-gray-500">
            Responsável: {entrega.responsavel ?? 'Não definido'}
          </p>
        </div>

        <div className="flex items-end gap-2">
          <Input
            type="date"
            label="Data prevista"
            value={dataPrevista}
            onChange={(e) => setDataPrevista(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={acao.isPending}
            onClick={() =>
              acao.mutate(() => api.put(`/entregas/${entrega.id}/data-prevista`, { dataPrevista }))
            }
          >
            Salvar
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-700">Atualizar status</p>
          {isSupervisor && (
            <Input
              type="file"
              accept="image/*"
              label="Foto da entrega (obrigatória para marcar como entregue)"
              onChange={onFoto}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {!emRota && (
              <Button
                type="button"
                disabled={acao.isPending}
                onClick={() => acao.mutate(() => api.post(`${url}/em-entrega`))}
              >
                <Truck className="h-4 w-4" /> Saiu para entrega
              </Button>
            )}
            {emRota && (
              <Button
                type="button"
                variant="secondary"
                disabled={acao.isPending}
                onClick={() => acao.mutate(() => api.post(`${url}/pronto-para-entrega`))}
              >
                <Clock3 className="h-4 w-4" /> Voltar para pendente
              </Button>
            )}
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={acao.isPending || (isSupervisor && !foto)}
              onClick={() =>
                acao.mutate(() =>
                  api.post(`${url}/entregue`, isSupervisor ? { fotoEntrega: foto } : {}),
                )
              }
            >
              <CheckCircle2 className="h-4 w-4" /> Marcar como entregue
            </Button>
          </div>
        </div>

        {emAberto && (
          <div className="space-y-2 rounded-lg border border-red-100 p-3">
            <label className="block space-y-1">
              <span className="block text-xs font-medium text-gray-700">
                Problema na entrega (imprevisto, atraso, não foi possível entregar)
              </span>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="danger"
                disabled={acao.isPending || !descricao.trim()}
                onClick={() =>
                  acao.mutate(() => api.put(`/entregas/${entrega.id}/problema`, { descricao }))
                }
              >
                <AlertTriangle className="h-4 w-4" /> Registrar problema
              </Button>
              {entrega.problema && (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={acao.isPending}
                  onClick={() => acao.mutate(() => api.delete(`/entregas/${entrega.id}/problema`))}
                >
                  Problema resolvido
                </Button>
              )}
            </div>
          </div>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}
      </div>
    </Modal>
  )
}

export function PainelEntregas({ dataInicio, dataFim }: { dataInicio: string; dataFim: string }) {
  const { isVisaoGeral } = useAuth()
  const [selecionada, setSelecionada] = useState<Entrega | null>(null)

  const { data: entregas = [], isLoading } = useQuery<Entrega[]>({
    queryKey: ['painel-entregas', dataInicio, dataFim],
    queryFn: () =>
      api
        .get('/entregas/painel', { params: { dataInicio, dataFim } })
        .then((r) => (Array.isArray(r.data) ? r.data : [])),
    refetchInterval: 15_000,
  })

  if (isLoading) return <p className="brand-loading text-sm text-gray-500">Carregando...</p>

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Pendentes, em rota e com problema aparecem sempre; entregues seguem o período escolhido.
        Atualiza sozinho a cada 15 segundos.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {GRUPOS.map(({ situacao, titulo, icone: Icone, cor }) => {
          const lista = entregas.filter((e) => e.situacao === situacao)
          return (
            <Card key={situacao} className="overflow-hidden rounded-2xl">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>{titulo}</CardTitle>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cor}`}>
                    {lista.length}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="max-h-[32rem] space-y-2 overflow-y-auto p-3">
                {lista.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-gray-400">Nenhuma entrega.</p>
                )}
                {lista.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    disabled={isVisaoGeral}
                    onClick={() => setSelecionada(e)}
                    className="w-full space-y-1 rounded-xl border border-gray-200 bg-white p-3 text-left text-xs text-gray-600 transition enabled:cursor-pointer enabled:hover:border-green-300 enabled:hover:bg-green-50/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900">
                        {numeroPedido(e.numero)}
                      </span>
                      <Icone className="h-4 w-4 shrink-0 text-gray-400" />
                    </div>
                    <p className="truncate text-sm text-gray-800">{e.cliente}</p>
                    <p className="flex gap-1">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{e.endereco || 'Endereço não cadastrado'}</span>
                    </p>
                    <p className="flex gap-1">
                      <User className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>{e.responsavel ?? 'Sem responsável'}</span>
                    </p>
                    <p>
                      {e.entregueEm
                        ? `Entregue em ${formatDateTime(e.entregueEm)}`
                        : `Previsão: ${formatarPrevista(e.dataPrevista)}`}
                    </p>
                    {e.problema && <p className="font-medium text-red-700">{e.problema}</p>}
                  </button>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selecionada && <ModalEntrega entrega={selecionada} onFechar={() => setSelecionada(null)} />}
    </div>
  )
}
