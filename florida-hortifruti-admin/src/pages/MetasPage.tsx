import { useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CalendarOff, CheckCircle2, Target, Trash2, TrendingUp } from 'lucide-react'
import { api } from '../lib/api'
import { cn, formatBRL } from '../lib/utils'
import { useAuth } from '../contexts/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input, MoneyInput } from '../components/ui/Input'

type DiaMeta = {
  data: string
  lucro: number
  temMeta: boolean
  motivoSemMeta?: 'DOMINGO' | 'SEM_META' | 'SEM_VALOR'
  motivo?: string | null
  base: number
  acumulado: number
  meta: number
  falta: number
  atingida: boolean
  emAndamento: boolean
}

type MesResponse = {
  mes: string
  hoje: string
  dias: DiaMeta[]
  resumo: { diasComMeta: number; diasAtingidos: number; lucroTotal: number }
}

type HojeResponse = DiaMeta & { percentual: number }
type ValorMeta = { id: string; valor: number; vigenteDesde: string }
type DiaSemMeta = { data: string; motivo: string | null }

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function dataCurta(data: string) {
  const [y, m, d] = data.split('-').map(Number)
  const semana = SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')} · ${semana}`
}

function dataBR(data: string) {
  return data.split('-').reverse().join('/')
}

function nomeMes(mes: string) {
  const [y, m] = mes.split('-').map(Number)
  const nome = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

const MOTIVO_SEM_META: Record<string, string> = {
  DOMINGO: 'Domingo',
  SEM_META: 'Sem meta',
  SEM_VALOR: 'Meta não definida',
}

export function MetasPage() {
  const qc = useQueryClient()
  const { isAdmin, isSupervisor } = useAuth()
  // Supervisor também lança o valor da meta diária e os dias sem meta
  const podeEditarMeta = isAdmin || isSupervisor

  const { data: hoje, isLoading: carregandoHoje } = useQuery<HojeResponse>({
    queryKey: ['metas-hoje'],
    queryFn: () => api.get('/metas/hoje').then((r) => r.data),
    refetchInterval: 60_000,
  })

  const hojeStr = hoje?.data ?? ''
  const [mes, setMes] = useState('')
  const mesSelecionado = mes || hojeStr.slice(0, 7)

  const { data: mesData, isLoading: carregandoMes } = useQuery<MesResponse>({
    queryKey: ['metas-mes', mesSelecionado],
    queryFn: () => api.get('/metas/mes', { params: { mes: mesSelecionado } }).then((r) => r.data),
    enabled: !!mesSelecionado,
  })

  const { data: valores = [] } = useQuery<ValorMeta[]>({
    queryKey: ['metas-valores'],
    queryFn: () => api.get('/metas/valores').then((r) => r.data),
  })

  const { data: diasSemMeta = [] } = useQuery<DiaSemMeta[]>({
    queryKey: ['metas-dias-sem-meta', mesSelecionado],
    queryFn: () =>
      api.get('/metas/dias-sem-meta', { params: { mes: mesSelecionado } }).then((r) => r.data),
    enabled: !!mesSelecionado,
  })

  function atualizar() {
    qc.invalidateQueries({ queryKey: ['metas-hoje'] })
    qc.invalidateQueries({ queryKey: ['metas-mes'] })
    qc.invalidateQueries({ queryKey: ['metas-valores'] })
    qc.invalidateQueries({ queryKey: ['metas-dias-sem-meta'] })
  }

  // ---------- definir valor ----------
  const [valor, setValor] = useState<number | ''>('')
  const [vigenteDesde, setVigenteDesde] = useState('')
  const desde = vigenteDesde || hojeStr
  const retroativo = !!hojeStr && desde < hojeStr

  const salvarValor = useMutation({
    mutationFn: () => api.post('/metas/valores', { valor: Number(valor), vigenteDesde: desde }),
    onSuccess: () => {
      setValor('')
      setVigenteDesde('')
      atualizar()
    },
  })

  const removerValor = useMutation({
    mutationFn: (id: string) => api.delete(`/metas/valores/${id}`),
    onSuccess: atualizar,
  })

  // ---------- dias sem meta ----------
  const [novoDia, setNovoDia] = useState('')
  const [motivo, setMotivo] = useState('')

  const marcarDia = useMutation({
    mutationFn: () =>
      api.post('/metas/dias-sem-meta', { data: novoDia, motivo: motivo.trim() || undefined }),
    onSuccess: () => {
      setNovoDia('')
      setMotivo('')
      atualizar()
    },
  })

  const desmarcarDia = useMutation({
    mutationFn: (data: string) => api.delete(`/metas/dias-sem-meta/${data}`),
    onSuccess: atualizar,
  })

  function submitValor(e: FormEvent) {
    e.preventDefault()
    if (!valor || Number(valor) <= 0) return
    if (
      retroativo &&
      !window.confirm(
        `A meta vai valer desde ${dataBR(desde)}. Os dias anteriores a hoje sem lucro suficiente vão entrar como "faltou" e somar na meta de hoje. Continuar?`,
      )
    )
      return
    salvarValor.mutate()
  }

  const percentual = Math.min(100, Math.max(0, hoje?.percentual ?? 0))

  return (
    <div className="min-w-0">
      <PageHeader
        title="Metas"
        subtitle="Meta diária de lucro — o que faltar em um dia é somado na meta do dia seguinte"
      />

      <div className="space-y-5 p-4 md:p-6">
        {/* ---------- meta de hoje ---------- */}
        <section className="brand-login rounded-3xl p-5 text-white shadow-lg md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-white/70">
                <Target className="h-4 w-4 text-ember" /> Meta de hoje
                {hojeStr && (
                  <span className="tracking-normal normal-case">· {dataBR(hojeStr)}</span>
                )}
              </p>
              {carregandoHoje ? (
                <p className="brand-loading mt-4 justify-start text-sm text-white/70">
                  Carregando...
                </p>
              ) : hoje?.temMeta ? (
                <>
                  <p className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
                    {formatBRL(hoje.meta)}
                  </p>
                  <p className="mt-1 text-sm text-white/70">
                    {formatBRL(hoje.base)} de meta
                    {hoje.acumulado > 0 && (
                      <>
                        {' '}
                        +{' '}
                        <span className="font-semibold text-ember">
                          {formatBRL(hoje.acumulado)} que faltou antes
                        </span>
                      </>
                    )}
                  </p>
                </>
              ) : (
                <p className="mt-3 max-w-md text-sm text-white/80">
                  {hoje?.motivoSemMeta === 'SEM_VALOR'
                    ? podeEditarMeta
                      ? 'Nenhuma meta definida ainda. Defina o valor diário abaixo.'
                      : 'Nenhuma meta definida ainda.'
                    : `Hoje não tem meta (${MOTIVO_SEM_META[hoje?.motivoSemMeta ?? ''] ?? 'sem meta'}${hoje?.motivo ? ` — ${hoje.motivo}` : ''}).`}
                </p>
              )}
            </div>

            {hoje?.temMeta && (
              <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-72">
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">
                    Lucro até agora
                  </p>
                  <p className="mt-1 text-lg font-semibold">{formatBRL(hoje.lucro)}</p>
                </div>
                <div className="rounded-2xl bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-white/60">
                    {hoje.atingida ? 'Meta' : 'Falta'}
                  </p>
                  <p
                    className={cn('mt-1 text-lg font-semibold', hoje.atingida && 'text-green-200')}
                  >
                    {hoje.atingida ? 'Batida! 🎉' : formatBRL(hoje.falta)}
                  </p>
                </div>
              </div>
            )}
          </div>

          {hoje?.temMeta && (
            <div className="mt-6">
              <div className="flex justify-between text-xs text-white/60">
                <span>Progresso</span>
                <span className="font-semibold text-white">{percentual.toFixed(0)}%</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-[width] duration-700',
                    hoje.atingida ? 'bg-green-300' : 'bg-linear-to-r from-cyan-500 to-ember',
                  )}
                  style={{ width: `${percentual}%` }}
                />
              </div>
            </div>
          )}
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* ---------- valor da meta ---------- */}
          <Card>
            <CardHeader>
              <CardTitle>Valor da meta diária</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {podeEditarMeta ? (
                <form onSubmit={submitValor} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <MoneyInput
                      label="Meta de lucro por dia (R$)"
                      value={valor}
                      onValueChange={setValor}
                      required
                    />
                    <Input
                      label="Vale a partir de"
                      type="date"
                      value={desde}
                      onChange={(e) => setVigenteDesde(e.target.value)}
                      required
                    />
                  </div>
                  {retroativo && (
                    <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      Data no passado: os dias anteriores sem lucro suficiente vão contar como
                      “faltou” e somar na meta de hoje.
                    </p>
                  )}
                  {salvarValor.isError && (
                    <p className="text-xs text-red-600">Não foi possível salvar. Tente de novo.</p>
                  )}
                  <Button type="submit" disabled={!valor || salvarValor.isPending}>
                    {salvarValor.isPending ? 'Salvando...' : 'Salvar meta'}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-gray-500">
                  Somente o administrador ou o supervisor altera a meta.
                </p>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Histórico
                </p>
                {valores.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhum valor definido.</p>
                ) : (
                  <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {valores.map((v, i) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <span className="text-sm">
                          <span className="font-semibold text-gray-900">{formatBRL(v.valor)}</span>
                          <span className="text-gray-500">
                            {' '}
                            a partir de {dataBR(v.vigenteDesde)}
                          </span>
                          {i === 0 && v.vigenteDesde <= hojeStr && (
                            <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
                              atual
                            </span>
                          )}
                          {v.vigenteDesde > hojeStr && (
                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                              agendado
                            </span>
                          )}
                        </span>
                        {podeEditarMeta && (
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Excluir a meta de ${formatBRL(v.valor)} a partir de ${dataBR(v.vigenteDesde)}?`,
                                )
                              )
                                removerValor.mutate(v.id)
                            }}
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                            aria-label="Excluir valor"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ---------- dias sem meta ---------- */}
          <Card>
            <CardHeader>
              <CardTitle>Dias sem meta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-gray-500">
                Domingos já não têm meta. Marque aqui feriados ou dias sem operação: eles não geram
                meta nem “faltou”.
              </p>
              {podeEditarMeta && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (novoDia) marcarDia.mutate()
                  }}
                  className="grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end"
                >
                  <Input
                    label="Dia"
                    type="date"
                    value={novoDia}
                    onChange={(e) => setNovoDia(e.target.value)}
                    required
                  />
                  <Input
                    label="Motivo (opcional)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Ex.: Feriado"
                    maxLength={120}
                  />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={!novoDia || marcarDia.isPending}
                  >
                    <CalendarOff className="h-4 w-4" /> Marcar
                  </Button>
                </form>
              )}
              {diasSemMeta.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Nenhum dia marcado em {mesSelecionado && nomeMes(mesSelecionado)}.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                  {diasSemMeta.map((d) => (
                    <li
                      key={d.data}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="text-sm">
                        <span className="font-medium text-gray-900">{dataCurta(d.data)}</span>
                        {d.motivo && <span className="text-gray-500"> — {d.motivo}</span>}
                      </span>
                      {podeEditarMeta && (
                        <button
                          type="button"
                          onClick={() => desmarcarDia.mutate(d.data)}
                          className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remover dia sem meta"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ---------- acompanhamento do mês ---------- */}
        <Card>
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{mesSelecionado && nomeMes(mesSelecionado)}</CardTitle>
            <div className="flex items-center gap-3">
              {mesData && mesData.resumo.diasComMeta > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-gray-500">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Meta batida em {mesData.resumo.diasAtingidos} de {mesData.resumo.diasComMeta} dias
                </span>
              )}
              <input
                type="month"
                value={mesSelecionado}
                max={hojeStr.slice(0, 7)}
                onChange={(e) => setMes(e.target.value)}
                className="min-h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm"
                aria-label="Mês"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {carregandoMes ? (
              <p className="brand-loading py-8 text-center text-sm text-gray-400">Carregando...</p>
            ) : !mesData || mesData.dias.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Nenhum dia para mostrar.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 text-left text-xs text-gray-500">
                      <th className="px-5 py-3 font-medium">Dia</th>
                      <th className="px-3 py-3 text-right font-medium">Meta</th>
                      <th className="px-3 py-3 text-right font-medium">Lucro</th>
                      <th className="px-5 py-3 font-medium">Resultado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...mesData.dias].reverse().map((d) => (
                      <tr
                        key={d.data}
                        className={cn(
                          'border-b border-gray-50 last:border-0',
                          !d.temMeta && 'text-gray-400',
                          d.emAndamento && 'bg-green-50/60',
                        )}
                      >
                        <td className="px-5 py-3 font-medium whitespace-nowrap">
                          {dataCurta(d.data)}
                          {d.emAndamento && (
                            <span className="ml-2 rounded-full bg-ember px-2 py-0.5 text-[10px] font-semibold text-white">
                              hoje
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {d.temMeta ? (
                            <>
                              {formatBRL(d.meta)}
                              {d.acumulado > 0 && (
                                <span className="block text-[11px] text-ember">
                                  +{formatBRL(d.acumulado)} acumulado
                                </span>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {formatBRL(d.lucro)}
                        </td>
                        <td className="px-5 py-3">
                          {!d.temMeta ? (
                            <span className="text-xs">
                              {MOTIVO_SEM_META[d.motivoSemMeta ?? '']}
                              {d.motivo ? ` — ${d.motivo}` : ''}
                            </span>
                          ) : d.atingida ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                              <CheckCircle2 className="h-4 w-4" /> Batida
                            </span>
                          ) : d.emAndamento ? (
                            <span className="text-xs text-gray-600">
                              Faltam {formatBRL(d.falta)}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-red-600">
                              Faltou {formatBRL(d.falta)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
