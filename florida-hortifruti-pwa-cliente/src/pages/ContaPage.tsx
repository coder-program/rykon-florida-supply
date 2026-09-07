import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Mail, MapPin, Pencil, Phone, Save, User2, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/useAuth'

export function ContaPage() {
  const qc = useQueryClient()
  const { logout } = useAuth()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    razaoSocialOuNome: '',
    nomeFantasia: '',
    email: '',
    telefone: '',
    whatsapp: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    pontoReferencia: '',
    cidadeId: '',
  })

  const { data: conta } = useQuery({
    queryKey: ['portal-conta'],
    queryFn: () => api.get('/portal-cliente/conta').then((r) => r.data),
  })

  const endereco = conta?.enderecos?.[0]

  useEffect(() => {
    if (!conta) return
    setForm({
      razaoSocialOuNome: conta.razaoSocialOuNome ?? '',
      nomeFantasia: conta.nomeFantasia ?? '',
      email: conta.email ?? '',
      telefone: conta.telefone ?? '',
      whatsapp: conta.whatsapp ?? '',
      logradouro: endereco?.logradouro ?? '',
      numero: endereco?.numero ?? '',
      complemento: endereco?.complemento ?? '',
      bairro: endereco?.bairro ?? '',
      cep: endereco?.cep ?? '',
      pontoReferencia: endereco?.pontoReferencia ?? '',
      cidadeId: endereco?.cidadeId ?? '',
    })
  }, [conta, endereco])

  function resetForm() {
    if (!conta) return
    setForm({
      razaoSocialOuNome: conta.razaoSocialOuNome ?? '',
      nomeFantasia: conta.nomeFantasia ?? '',
      email: conta.email ?? '',
      telefone: conta.telefone ?? '',
      whatsapp: conta.whatsapp ?? '',
      logradouro: endereco?.logradouro ?? '',
      numero: endereco?.numero ?? '',
      complemento: endereco?.complemento ?? '',
      bairro: endereco?.bairro ?? '',
      cep: endereco?.cep ?? '',
      pontoReferencia: endereco?.pontoReferencia ?? '',
      cidadeId: endereco?.cidadeId ?? '',
    })
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!form.razaoSocialOuNome.trim()) throw new Error('Informe o nome do cliente')
      if (!form.telefone.trim()) throw new Error('Informe o telefone')

      return api
        .patch('/portal-cliente/conta', {
          razaoSocialOuNome: form.razaoSocialOuNome.trim(),
          nomeFantasia: form.nomeFantasia.trim() || undefined,
          email: form.email.trim() || undefined,
          telefone: form.telefone.trim(),
          whatsapp: form.whatsapp.trim() || undefined,
          endereco: form.cidadeId
            ? {
                cidadeId: form.cidadeId,
                logradouro: form.logradouro.trim(),
                numero: form.numero.trim(),
                complemento: form.complemento.trim() || undefined,
                bairro: form.bairro.trim(),
                cep: form.cep.trim(),
                pontoReferencia: form.pontoReferencia.trim() || undefined,
                principal: true,
              }
            : undefined,
        })
        .then((r) => r.data)
    },
    onSuccess: () => {
      setEditando(false)
      qc.invalidateQueries({ queryKey: ['portal-conta'] })
    },
  })

  const erroSalvar = salvar.isError
    ? Array.isArray((salvar.error as any)?.response?.data?.message)
      ? (salvar.error as any).response.data.message.join(' ')
      : ((salvar.error as any)?.response?.data?.message ??
        (salvar.error as Error)?.message ??
        'Não foi possível salvar seus dados.')
    : ''

  return (
    <div className="space-y-4 px-4 py-4">
      <div className="overflow-hidden rounded-[28px] bg-linear-to-br from-emerald-600 via-emerald-500 to-lime-400 p-5 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/80">Conta</p>
        <h1 className="mt-2 text-2xl font-semibold leading-tight">Seus dados de cadastro</h1>
        <p className="mt-2 max-w-sm text-sm text-white/85">
          Atualize seus dados de contato para facilitar entrega, confirmação de pedido e suporte.
        </p>
      </div>

      {conta && (
        <>
          <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <User2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-semibold text-gray-900">{conta.razaoSocialOuNome}</p>
                <p className="mt-1 text-sm text-gray-500">
                  {conta.nomeFantasia || 'Mantenha seus dados sempre atualizados'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                resetForm()
                setEditando(true)
              }}
              className="mt-4 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-semibold text-emerald-700"
            >
              <Pencil className="h-4 w-4" /> Editar meus dados
            </button>

            <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-600">
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <Mail className="h-4 w-4 text-emerald-700" />
                <span className="truncate">{conta.email || 'Sem e-mail cadastrado'}</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <Phone className="h-4 w-4 text-emerald-700" />
                <span>{conta.telefone ?? conta.whatsapp ?? 'Sem telefone cadastrado'}</span>
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
                <MapPin className="mt-0.5 h-4 w-4 text-emerald-700" />
                <span>
                  {endereco
                    ? `${endereco.logradouro}, ${endereco.numero}${endereco.bairro ? ` — ${endereco.bairro}` : ''}`
                    : 'Sem endereço principal cadastrado'}
                </span>
              </div>
            </div>
          </div>

          {editando && (
            <form
              className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
              onSubmit={(e) => {
                e.preventDefault()
                salvar.mutate()
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">Editar cadastro</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Altere só o que precisar. Se desistir, basta cancelar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setEditando(false)
                  }}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-2xl border border-gray-200 text-gray-500"
                  aria-label="Cancelar edição"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    <Building2 className="h-3.5 w-3.5" /> Nome ou razão social
                  </span>
                  <input
                    value={form.razaoSocialOuNome}
                    onChange={(e) =>
                      setForm((atual) => ({ ...atual, razaoSocialOuNome: e.target.value }))
                    }
                    className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Nome fantasia
                  </span>
                  <input
                    value={form.nomeFantasia}
                    onChange={(e) =>
                      setForm((atual) => ({ ...atual, nomeFantasia: e.target.value }))
                    }
                    className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    E-mail
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((atual) => ({ ...atual, email: e.target.value }))}
                    className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                  />
                </label>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Telefone
                    </span>
                    <input
                      value={form.telefone}
                      onChange={(e) => setForm((atual) => ({ ...atual, telefone: e.target.value }))}
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      WhatsApp
                    </span>
                    <input
                      value={form.whatsapp}
                      onChange={(e) => setForm((atual) => ({ ...atual, whatsapp: e.target.value }))}
                      className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 text-sm outline-none focus:border-emerald-400 focus:bg-white"
                    />
                  </label>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Endereço principal
                  </p>
                  {!form.cidadeId && (
                    <p className="mt-2 text-xs text-amber-700">
                      Este cadastro ainda não tem cidade vinculada. Se quiser editar o endereço
                      completo, primeiro precisamos manter a cidade atual cadastrada no sistema.
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-3">
                    <label className="block">
                      <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Logradouro
                      </span>
                      <input
                        value={form.logradouro}
                        onChange={(e) =>
                          setForm((atual) => ({ ...atual, logradouro: e.target.value }))
                        }
                        className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-emerald-400"
                        disabled={!form.cidadeId}
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Número
                        </span>
                        <input
                          value={form.numero}
                          onChange={(e) =>
                            setForm((atual) => ({ ...atual, numero: e.target.value }))
                          }
                          className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-emerald-400"
                          disabled={!form.cidadeId}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          CEP
                        </span>
                        <input
                          value={form.cep}
                          onChange={(e) => setForm((atual) => ({ ...atual, cep: e.target.value }))}
                          className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-emerald-400"
                          disabled={!form.cidadeId}
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Bairro
                      </span>
                      <input
                        value={form.bairro}
                        onChange={(e) => setForm((atual) => ({ ...atual, bairro: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-emerald-400"
                        disabled={!form.cidadeId}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Complemento
                      </span>
                      <input
                        value={form.complemento}
                        onChange={(e) =>
                          setForm((atual) => ({ ...atual, complemento: e.target.value }))
                        }
                        className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-emerald-400"
                        disabled={!form.cidadeId}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Ponto de referência
                      </span>
                      <input
                        value={form.pontoReferencia}
                        onChange={(e) =>
                          setForm((atual) => ({ ...atual, pontoReferencia: e.target.value }))
                        }
                        className="h-12 w-full rounded-2xl border border-gray-200 bg-white px-4 text-sm outline-none focus:border-emerald-400"
                        disabled={!form.cidadeId}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {erroSalvar && (
                <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{erroSalvar}</p>
              )}
              {salvar.isSuccess && !erroSalvar && (
                <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  Dados atualizados com sucesso.
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetForm()
                    setEditando(false)
                  }}
                  className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={salvar.isPending}
                  className="flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {salvar.isPending ? 'Salvando...' : 'Salvar dados'}
                </button>
              </div>
            </form>
          )}
        </>
      )}
      <button
        type="button"
        onClick={logout}
        className="w-full min-h-12 cursor-pointer rounded-2xl border border-red-200 bg-white text-sm font-semibold text-red-600"
      >
        Sair
      </button>
    </div>
  )
}
