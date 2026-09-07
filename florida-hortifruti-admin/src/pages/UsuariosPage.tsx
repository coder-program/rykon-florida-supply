import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Plus, RotateCcw, UserRoundSearch, UserX } from 'lucide-react'
import type { AxiosError } from 'axios'
import { api } from '../lib/api'
import { formatDate } from '../lib/utils'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'

const PAPEL_COLOR: Record<string, string> = {
  ADMINISTRADOR: 'bg-purple-100 text-purple-700',
  ADMINISTRATIVO: 'bg-blue-100 text-blue-700',
  VENDEDOR: 'bg-green-100 text-green-700',
  MOTORISTA: 'bg-orange-100 text-orange-700',
  CLIENTE: 'bg-teal-100 text-teal-700',
}

const EMPTY = {
  nome: '',
  email: '',
  senha: '',
  papel: 'VENDEDOR',
  cpf: '',
  dataNascimento: '',
  telefone: '',
  whatsapp: '',
  endereco: {
    cep: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    estadoId: '',
    cidadeId: '',
    pontoReferencia: '',
  },
}

type Endereco = {
  id: string
  principal: boolean
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  pontoReferencia?: string | null
  cidade?: {
    id: string
    nome: string
    estado?: { id: string; nome: string; sigla: string } | null
  } | null
}

type Usuario = {
  id: string
  nome: string
  email: string
  cpf?: string | null
  dataNascimento?: string | null
  telefone?: string | null
  whatsapp?: string | null
  papel: string
  ativo: boolean
  criadoEm: string
  enderecos?: Endereco[]
}

type FormErros = {
  nome?: string
  email?: string
  cpf?: string
  dataNascimento?: string
  telefone?: string
  whatsapp?: string
  endereco?: string
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function formatarCpf(valor: string) {
  const digits = somenteDigitos(valor).slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`
}

function formatarTelefone(valor: string) {
  const digits = somenteDigitos(valor).slice(0, 11)
  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`

  const ddd = digits.slice(0, 2)
  const restante = digits.slice(2)
  if (restante.length <= 4) return `(${ddd}) ${restante}`
  if (restante.length <= 8) return `(${ddd}) ${restante.slice(0, 4)}-${restante.slice(4)}`
  return `(${ddd}) ${restante.slice(0, 5)}-${restante.slice(5, 9)}`
}

function isCpfValido(digits: string) {
  if (!/^\d{11}$/.test(digits) || /^([0-9])\1{10}$/.test(digits)) return false

  const calc = (limite: number) => {
    let soma = 0
    for (let i = 0; i < limite; i += 1) soma += Number(digits[i]) * (limite + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10])
}

function extrairMensagemApi(error: any) {
  const mensagem = error?.response?.data?.message
  if (Array.isArray(mensagem)) return mensagem.join(' ')
  if (typeof mensagem === 'string' && mensagem.trim()) return mensagem
  return 'Não foi possível salvar o usuário.'
}

function normalizarTextoBusca(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .toLowerCase()
}

function formatDateInput(date?: string | null) {
  if (!date) return ''
  return new Date(date).toISOString().split('T')[0]
}

function formatarEndereco(endereco: Endereco | null | undefined) {
  if (!endereco) return 'Sem endereço principal cadastrado'
  return [
    endereco.logradouro,
    endereco.numero,
    endereco.bairro,
    endereco.cidade?.nome,
    endereco.cidade?.estado?.sigla,
  ]
    .filter(Boolean)
    .join(', ')
}

function exigePerfilCompleto(papel: string) {
  return papel === 'VENDEDOR' || papel === 'MOTORISTA'
}

function validarUsuarioForm(form: any): FormErros {
  const erros: FormErros = {}
  const nome = String(form.nome ?? '').trim()
  const email = String(form.email ?? '').trim()
  const cpf = String(form.cpf ?? '').trim()
  const telefone = String(form.telefone ?? '').trim()
  const whatsapp = String(form.whatsapp ?? '').trim()
  const dataNascimento = String(form.dataNascimento ?? '').trim()
  const endereco = form.endereco ?? EMPTY.endereco
  const operacional = exigePerfilCompleto(String(form.papel ?? ''))

  if (!nome) erros.nome = 'Informe o nome.'
  else if (nome.length < 3) erros.nome = 'Use pelo menos 3 caracteres.'
  else if (nome.length > 120) erros.nome = 'Use no máximo 120 caracteres.'

  if (!email) erros.email = 'Informe o e-mail.'

  if (operacional) {
    const cpfDigits = somenteDigitos(cpf)
    if (!cpf) erros.cpf = 'Informe o CPF.'
    else if (!isCpfValido(cpfDigits)) erros.cpf = 'CPF inválido.'

    if (!dataNascimento) erros.dataNascimento = 'Informe a data de nascimento.'
    else if (new Date(`${dataNascimento}T00:00:00`).getTime() > Date.now()) {
      erros.dataNascimento = 'A data de nascimento não pode ser futura.'
    }

    if (!telefone) erros.telefone = 'Informe o telefone.'
    if (!whatsapp) erros.whatsapp = 'Informe o WhatsApp.'

    const enderecoCompleto =
      !!endereco.cep &&
      !!endereco.logradouro &&
      !!endereco.numero &&
      !!endereco.bairro &&
      !!endereco.estadoId &&
      !!endereco.cidadeId

    if (!enderecoCompleto) {
      erros.endereco =
        'Preencha CEP, logradouro, número, bairro, estado e cidade do endereço principal.'
    }
  }

  return erros
}

export function UsuariosPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [detalhesAbertos, setDetalhesAbertos] = useState<Usuario | null>(null)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState<any>(EMPTY)
  const [formErros, setFormErros] = useState<FormErros>({})
  const [erroApiSalvar, setErroApiSalvar] = useState('')

  const {
    data: usuarios = [],
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<Usuario[]>({
    queryKey: ['usuarios'],
    queryFn: () => api.get('/usuarios').then((r) => r.data),
  })

  const { data: estados = [] } = useQuery({
    queryKey: ['localidades-estados'],
    queryFn: () => api.get('/localidades/estados').then((r) => r.data),
    enabled: modal,
  })

  const { data: cidades = [] } = useQuery({
    queryKey: ['localidades-cidades-usuarios', form.endereco?.estadoId],
    queryFn: () =>
      api.get(`/localidades/estados/${form.endereco?.estadoId}/cidades`).then((r) => r.data),
    enabled: !!form.endereco?.estadoId && modal,
  })

  const erroUsuarios = (() => {
    const err = error as AxiosError<{ message?: string | string[] }> | null
    const status = err?.response?.status
    const message = err?.response?.data?.message

    if (status === 403) {
      return 'Sem permissão para visualizar usuários. Faça login como administrativo ou administrador.'
    }
    if (status === 401) {
      return 'Sessão expirada. Faça login novamente.'
    }
    if (Array.isArray(message) && message.length > 0) return message[0]
    if (typeof message === 'string' && message.trim()) return message
    return 'Não foi possível carregar os usuários.'
  })()

  const salvar = useMutation({
    mutationFn: (data: any) =>
      editando ? api.put(`/usuarios/${editando.id}`, data) : api.post('/usuarios', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      setFormErros({})
      setErroApiSalvar('')
      fechar()
    },
    onError: (error: any) => {
      const mensagem = extrairMensagemApi(error)
      setErroApiSalvar(mensagem)

      if (mensagem.toLowerCase().includes('cpf')) {
        setFormErros((prev) => ({ ...prev, cpf: 'Já existe usuário cadastrado com este CPF.' }))
      }
      if (mensagem.toLowerCase().includes('e-mail')) {
        setFormErros((prev) => ({
          ...prev,
          email: 'Já existe usuário cadastrado com este e-mail.',
        }))
      }
    },
  })

  const desativar = useMutation({
    mutationFn: (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const reativar = useMutation({
    mutationFn: (id: string) => api.post(`/usuarios/${id}/reativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  function getPrincipalEndereco(usuario: Usuario | null | undefined) {
    return usuario?.enderecos?.find((e) => e.principal) ?? usuario?.enderecos?.[0] ?? null
  }

  function abrirNovo() {
    setForm({ ...EMPTY, endereco: { ...EMPTY.endereco } })
    setEditando(null)
    setFormErros({})
    setErroApiSalvar('')
    setModal(true)
  }

  function abrirEditar(usuario: Usuario) {
    const principal = getPrincipalEndereco(usuario)
    setForm({
      ...EMPTY,
      ...usuario,
      senha: '',
      cpf: formatarCpf(usuario.cpf ?? ''),
      dataNascimento: formatDateInput(usuario.dataNascimento),
      telefone: formatarTelefone(usuario.telefone ?? ''),
      whatsapp: formatarTelefone(usuario.whatsapp ?? ''),
      endereco: {
        cep: principal?.cep ?? '',
        logradouro: principal?.logradouro ?? '',
        numero: principal?.numero ?? '',
        complemento: principal?.complemento ?? '',
        bairro: principal?.bairro ?? '',
        estadoId: principal?.cidade?.estado?.id ?? '',
        cidadeId: principal?.cidade?.id ?? '',
        pontoReferencia: principal?.pontoReferencia ?? '',
      },
    })
    setEditando(usuario)
    setFormErros({})
    setErroApiSalvar('')
    setModal(true)
  }

  function fechar() {
    setModal(false)
    setEditando(null)
    setFormErros({})
    setErroApiSalvar('')
  }

  function set(k: string, v: any) {
    setErroApiSalvar('')
    setFormErros((prev) => ({ ...prev, [k]: undefined }))
    setForm((f: any) => ({ ...f, [k]: v }))
  }

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle="Gerenciar vendedores, motoristas e equipe interna com cadastro completo"
        actions={
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        }
      />

      <div className="p-4 md:p-6">
        {isError && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{erroUsuarios}</p>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? 'Tentando...' : 'Tentar novamente'}
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !isError && usuarios.length === 0 && (
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-600">
            Nenhum usuário cadastrado.
          </div>
        )}

        <div className="space-y-3 md:hidden">
          {isLoading && <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>}
          {usuarios.map((u) => {
            const principal = getPrincipalEndereco(u)
            return (
              <div
                key={u.id}
                className={`rounded-2xl border border-gray-200 bg-white p-4 ${u.ativo === false ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{u.nome}</p>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </div>
                  <Badge className={PAPEL_COLOR[u.papel]}>{u.papel}</Badge>
                </div>

                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <p>CPF: {u.cpf ?? '—'}</p>
                  <p>Telefone: {u.telefone ?? '—'}</p>
                  <p>WhatsApp: {u.whatsapp ?? '—'}</p>
                  <p>Nascimento: {u.dataNascimento ? formatDate(u.dataNascimento) : '—'}</p>
                  <p>Endereço: {formatarEndereco(principal)}</p>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${u.ativo === false ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {u.ativo === false ? 'Inativo' : 'Ativo'}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetalhesAbertos(u)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => abrirEditar(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {u.ativo === false ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600"
                        onClick={() => reativar.mutate(u.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => {
                          if (
                            confirm(
                              `Desativar ${u.nome}? O usuário deixa de acessar o sistema, mas o histórico permanece.`,
                            )
                          ) {
                            desativar.mutate(u.id)
                          }
                        }}
                      >
                        <UserX className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden md:block">
          <TableScroll>
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Papel</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">CPF</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Contato</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Nascimento
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">
                    Endereço
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                )}
                {usuarios.map((u) => {
                  const principal = getPrincipalEndereco(u)
                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-gray-50 ${u.ativo === false ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{u.nome}</p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={PAPEL_COLOR[u.papel]}>{u.papel}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{u.cpf ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="space-y-0.5">
                          <p>{u.telefone ?? '—'}</p>
                          <p className="text-xs text-gray-500">{u.whatsapp ?? 'Sem WhatsApp'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {u.dataNascimento ? formatDate(u.dataNascimento) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatarEndereco(principal)}</td>
                      <td className="px-4 py-3">
                        {u.ativo === false ? (
                          <span className="text-xs font-medium text-red-600">Inativo</span>
                        ) : (
                          <span className="text-xs font-medium text-green-600">Ativo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setDetalhesAbertos(u)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => abrirEditar(u)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {u.ativo === false ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600"
                              onClick={() => reativar.mutate(u.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Desativar ${u.nome}? O usuário deixa de acessar o sistema, mas o histórico permanece.`,
                                  )
                                ) {
                                  desativar.mutate(u.id)
                                }
                              }}
                            >
                              <UserX className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
        </div>
      </div>

      <Modal
        open={modal}
        onClose={fechar}
        title={editando ? 'Editar Usuário' : 'Novo Usuário'}
        size="xl"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            const erros = validarUsuarioForm(form)
            setFormErros(erros)
            if (Object.keys(erros).length > 0) return

            const payload: any = {
              nome: form.nome.trim(),
              email: form.email.trim(),
              papel: form.papel,
              cpf: form.cpf.trim() || undefined,
              dataNascimento: form.dataNascimento || undefined,
              telefone: form.telefone.trim() || undefined,
              whatsapp: form.whatsapp.trim() || undefined,
            }
            if (form.senha) payload.senha = form.senha

            const endereco = form.endereco ?? EMPTY.endereco
            const temAlgumEndereco = [
              endereco.cep,
              endereco.logradouro,
              endereco.numero,
              endereco.bairro,
              endereco.estadoId,
              endereco.cidadeId,
              endereco.complemento,
              endereco.pontoReferencia,
            ].some(Boolean)

            if (temAlgumEndereco) {
              payload.endereco = {
                cep: endereco.cep,
                logradouro: endereco.logradouro,
                numero: endereco.numero,
                complemento: endereco.complemento || undefined,
                bairro: endereco.bairro,
                cidadeId: endereco.cidadeId,
                pontoReferencia: endereco.pontoReferencia || undefined,
                principal: true,
              }
            }

            salvar.mutate(payload)
          }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
            {exigePerfilCompleto(form.papel)
              ? 'Vendedor e motorista precisam sair com cadastro operacional completo: CPF, nascimento, telefone, WhatsApp e endereço principal.'
              : 'Para equipe interna, os campos operacionais podem ficar opcionais.'}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Input
                label="Nome *"
                value={form.nome}
                maxLength={120}
                onChange={(e) => set('nome', e.target.value)}
                error={formErros.nome}
                required
              />
            </div>
            <Input
              label="E-mail *"
              type="email"
              value={form.email}
              maxLength={255}
              onChange={(e) => set('email', e.target.value)}
              error={formErros.email}
              required
            />
            <Select
              label="Papel *"
              value={form.papel}
              onChange={(e) => set('papel', e.target.value)}
            >
              <option value="VENDEDOR">Vendedor</option>
              <option value="MOTORISTA">Motorista</option>
              <option value="ADMINISTRATIVO">Administrativo/Financeiro</option>
              <option value="ADMINISTRADOR">Administrador</option>
            </Select>
            <Input
              label="CPF"
              value={form.cpf}
              onChange={(e) => set('cpf', formatarCpf(e.target.value))}
              error={formErros.cpf}
              maxLength={14}
              required={exigePerfilCompleto(form.papel)}
            />
            <Input
              label="Data de nascimento"
              type="date"
              value={form.dataNascimento}
              onChange={(e) => set('dataNascimento', e.target.value)}
              error={formErros.dataNascimento}
              required={exigePerfilCompleto(form.papel)}
            />
            <Input
              label="Telefone"
              value={form.telefone}
              onChange={(e) => set('telefone', formatarTelefone(e.target.value))}
              error={formErros.telefone}
              maxLength={16}
              required={exigePerfilCompleto(form.papel)}
            />
            <Input
              label="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => set('whatsapp', formatarTelefone(e.target.value))}
              error={formErros.whatsapp}
              maxLength={16}
              required={exigePerfilCompleto(form.papel)}
            />
            <div className="sm:col-span-2">
              <Input
                label={editando ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}
                type="password"
                value={form.senha}
                onChange={(e) => set('senha', e.target.value)}
                required={!editando}
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Endereço principal
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="CEP"
                value={form.endereco?.cep ?? ''}
                maxLength={9}
                onChange={(e) => {
                  setFormErros((prev) => ({ ...prev, endereco: undefined }))
                  set('endereco', { ...form.endereco, cep: e.target.value })
                }}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={async () => {
                    const cep = form.endereco?.cep?.replace(/\D/g, '')
                    if (!cep || cep.length !== 8) return

                    try {
                      const data = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) =>
                        r.json(),
                      )
                      if (data.erro) return

                      const estado = estados.find(
                        (item: any) =>
                          String(item.sigla).toUpperCase() === String(data.uf ?? '').toUpperCase(),
                      )
                      const novoEstadoId = estado?.id ?? form.endereco?.estadoId ?? ''
                      let novoCidadeId = form.endereco?.cidadeId ?? ''

                      if (novoEstadoId && data.localidade) {
                        const cidadesEstado = await api.get(
                          `/localidades/estados/${novoEstadoId}/cidades`,
                        )
                        const cidadeEncontrada = cidadesEstado.data.find(
                          (cidade: any) =>
                            normalizarTextoBusca(cidade.nome) ===
                            normalizarTextoBusca(data.localidade),
                        )
                        novoCidadeId = cidadeEncontrada?.id ?? ''
                      }

                      setForm((prev: any) => ({
                        ...prev,
                        endereco: {
                          ...(prev.endereco ?? EMPTY.endereco),
                          cep: data.cep ?? prev.endereco?.cep ?? '',
                          logradouro: data.logradouro ?? '',
                          bairro: data.bairro ?? '',
                          complemento: data.complemento ?? '',
                          estadoId: novoEstadoId,
                          cidadeId: novoCidadeId,
                          pontoReferencia: prev.endereco?.pontoReferencia ?? '',
                        },
                      }))
                    } catch {
                      // ignora falha de busca ao CEP
                    }
                  }}
                  className="w-full rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white"
                >
                  Buscar CEP
                </button>
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Logradouro"
                  value={form.endereco?.logradouro ?? ''}
                  maxLength={200}
                  onChange={(e) => {
                    setFormErros((prev) => ({ ...prev, endereco: undefined }))
                    set('endereco', { ...form.endereco, logradouro: e.target.value })
                  }}
                />
              </div>
              <Input
                label="Número"
                value={form.endereco?.numero ?? ''}
                maxLength={20}
                onChange={(e) => {
                  setFormErros((prev) => ({ ...prev, endereco: undefined }))
                  set('endereco', { ...form.endereco, numero: e.target.value })
                }}
              />
              <Input
                label="Complemento"
                value={form.endereco?.complemento ?? ''}
                maxLength={80}
                onChange={(e) => set('endereco', { ...form.endereco, complemento: e.target.value })}
              />
              <Input
                label="Bairro"
                value={form.endereco?.bairro ?? ''}
                maxLength={80}
                onChange={(e) => {
                  setFormErros((prev) => ({ ...prev, endereco: undefined }))
                  set('endereco', { ...form.endereco, bairro: e.target.value })
                }}
              />
              <Select
                label="Estado"
                value={form.endereco?.estadoId ?? ''}
                onChange={(e) => {
                  setFormErros((prev) => ({ ...prev, endereco: undefined }))
                  set('endereco', { ...form.endereco, estadoId: e.target.value, cidadeId: '' })
                }}
              >
                <option value="">Selecione</option>
                {estados.map((estado: any) => (
                  <option key={estado.id} value={estado.id}>
                    {estado.sigla} - {estado.nome}
                  </option>
                ))}
              </Select>
              <Select
                label="Cidade"
                value={form.endereco?.cidadeId ?? ''}
                onChange={(e) => {
                  setFormErros((prev) => ({ ...prev, endereco: undefined }))
                  set('endereco', { ...form.endereco, cidadeId: e.target.value })
                }}
                disabled={!form.endereco?.estadoId}
              >
                <option value="">Selecione</option>
                {cidades.map((cidade: any) => (
                  <option key={cidade.id} value={cidade.id}>
                    {cidade.nome}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-2">
                <Input
                  label="Ponto de referência"
                  value={form.endereco?.pontoReferencia ?? ''}
                  maxLength={120}
                  onChange={(e) =>
                    set('endereco', { ...form.endereco, pontoReferencia: e.target.value })
                  }
                />
              </div>
            </div>
            {formErros.endereco && <p className="text-xs text-red-600">{formErros.endereco}</p>}
          </div>

          {erroApiSalvar && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {erroApiSalvar}
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-2">
            <Button type="button" variant="secondary" onClick={fechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(detalhesAbertos)}
        onClose={() => setDetalhesAbertos(null)}
        title="Detalhes do usuário"
        size="lg"
      >
        {detalhesAbertos && (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{detalhesAbertos.nome}</p>
                  <p className="text-sm text-gray-500">{detalhesAbertos.email}</p>
                </div>
                <Badge className={PAPEL_COLOR[detalhesAbertos.papel]}>
                  {detalhesAbertos.papel}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-gray-700 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">CPF</p>
                  <p className="mt-1">{detalhesAbertos.cpf ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Nascimento
                  </p>
                  <p className="mt-1">
                    {detalhesAbertos.dataNascimento
                      ? formatDate(detalhesAbertos.dataNascimento)
                      : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Telefone
                  </p>
                  <p className="mt-1">{detalhesAbertos.telefone ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    WhatsApp
                  </p>
                  <p className="mt-1">{detalhesAbertos.whatsapp ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </p>
                  <p className="mt-1">{detalhesAbertos.ativo === false ? 'Inativo' : 'Ativo'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Criado em
                  </p>
                  <p className="mt-1">{formatDate(detalhesAbertos.criadoEm)}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Endereço principal
                  </p>
                  <p className="mt-1">{formatarEndereco(getPrincipalEndereco(detalhesAbertos))}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setDetalhesAbertos(null)}>
                Fechar
              </Button>
              <Button
                type="button"
                onClick={() => {
                  const usuario = detalhesAbertos
                  setDetalhesAbertos(null)
                  abrirEditar(usuario)
                }}
              >
                <UserRoundSearch className="h-4 w-4" /> Editar cadastro
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
