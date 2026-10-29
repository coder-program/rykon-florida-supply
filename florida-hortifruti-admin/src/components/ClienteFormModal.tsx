import { useState } from 'react'
import { FORMA_PAGAMENTO_LABEL, FORMAS_PAGAMENTO } from '../lib/utils'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Button } from './ui/Button'
import { Modal } from './ui/Modal'
import { Input, Select } from './ui/Input'

const EMPTY_FORM = {
  razaoSocialOuNome: '',
  nomeFantasia: '',
  cnpjCpf: '',
  telefone: '',
  whatsapp: '',
  email: '',
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
  responsavelContato: '',
  condicaoPagamento: '',
  formaPagamentoUsual: '',
  necessitaNF: false,
  observacoes: '',
}

function somenteDigitos(valor: string) {
  return valor.replace(/\D/g, '')
}

function formatarCpfCnpj(valor: string) {
  const digits = somenteDigitos(valor).slice(0, 14)
  if (digits.length <= 11) {
    const partes = []
    if (digits.length > 0) partes.push(digits.slice(0, Math.min(3, digits.length)))
    if (digits.length > 3) partes.push(digits.slice(3, Math.min(6, digits.length)))
    if (digits.length > 6) partes.push(digits.slice(6, Math.min(9, digits.length)))
    const sufixo = digits.length > 9 ? digits.slice(9, 11) : ''
    let formatted = partes.join('.')
    if (digits.length > 9) formatted += `-${sufixo}`
    return formatted
  }

  const partes = []
  if (digits.length > 0) partes.push(digits.slice(0, Math.min(2, digits.length)))
  if (digits.length > 2) partes.push(digits.slice(2, Math.min(5, digits.length)))
  if (digits.length > 5) partes.push(digits.slice(5, Math.min(8, digits.length)))
  const bloco = digits.length > 8 ? digits.slice(8, Math.min(12, digits.length)) : ''
  const sufixo = digits.length > 12 ? digits.slice(12, 14) : ''
  let formatted = partes.join('.')
  if (digits.length > 8) formatted += `/${bloco}`
  if (digits.length > 12) formatted += `-${sufixo}`
  return formatted
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

function isCnpjValido(digits: string) {
  if (!/^\d{14}$/.test(digits) || /^([0-9])\1{13}$/.test(digits)) return false

  const calc = (base: number[], pesos: number[]) => {
    const soma = base.reduce((acc, digit, index) => acc + digit * pesos[index], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  const numeros = digits.split('').map(Number)
  const primeiro = calc(numeros.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = calc(numeros.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return primeiro === numeros[12] && segundo === numeros[13]
}

type FormErros = {
  razaoSocialOuNome?: string
  cnpjCpf?: string
  telefone?: string
  endereco?: string
}

function extrairMensagemApi(error: any) {
  const mensagem = error?.response?.data?.message
  if (Array.isArray(mensagem)) return mensagem.join(' ')
  if (typeof mensagem === 'string' && mensagem.trim()) return mensagem
  return 'Não foi possível salvar o cliente.'
}

function validarClienteForm(form: any): FormErros {
  const erros: FormErros = {}
  const nome = String(form.razaoSocialOuNome ?? '').trim()
  const telefone = String(form.telefone ?? '').trim()
  const cnpjCpf = String(form.cnpjCpf ?? '').trim()
  const endereco = form.endereco ?? EMPTY_FORM.endereco

  if (!nome) {
    erros.razaoSocialOuNome = 'Informe o nome ou razão social.'
  } else if (nome.length < 3) {
    erros.razaoSocialOuNome = 'Use pelo menos 3 caracteres.'
  } else if (nome.length > 120) {
    erros.razaoSocialOuNome = 'Use no máximo 120 caracteres.'
  }

  if (!telefone) {
    erros.telefone = 'Informe o telefone.'
  }

  if (cnpjCpf) {
    const digits = somenteDigitos(cnpjCpf)
    const valido =
      digits.length === 11
        ? isCpfValido(digits)
        : digits.length === 14
          ? isCnpjValido(digits)
          : false
    if (!valido) {
      erros.cnpjCpf = 'CPF ou CNPJ inválido.'
    }
  }

  const enderecoCompleto =
    !!endereco.cep &&
    !!endereco.logradouro &&
    !!endereco.numero &&
    !!endereco.bairro &&
    !!endereco.estadoId &&
    !!endereco.cidadeId

  if (!enderecoCompleto) {
    erros.endereco = 'Preencha CEP, logradouro, número, bairro, estado e cidade do endereço.'
  }

  return erros
}

export type Cliente = {
  id: string
  razaoSocialOuNome: string
  nomeFantasia?: string | null
  cnpjCpf?: string | null
  telefone?: string | null
  whatsapp?: string | null
  email?: string | null
  responsavelContato?: string | null
  condicaoPagamento?: string | null
  formaPagamentoUsual?: string | null
  necessitaNF?: boolean
  observacoes?: string | null
  ativo?: boolean
  statusConvite?: 'NAO_CONVIDADO' | 'CONVITE_ENVIADO' | 'ATIVO'
  usuarioId?: string | null
  enderecos?: Array<{
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
      estado?: { id: string; nome: string; sigla: string }
    } | null
  }>
}

function normalizarTextoBusca(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .toLowerCase()
    .trim()
}

function formDoCliente(c: Cliente | null) {
  if (!c) return { ...EMPTY_FORM }
  const principal = c.enderecos?.find((e) => e.principal) ?? c.enderecos?.[0] ?? null
  return {
    ...c,
    cnpjCpf: c.cnpjCpf ?? '',
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
  }
}

type ClienteFormModalProps = {
  open: boolean
  /** null = novo cliente */
  cliente: Cliente | null
  onClose: () => void
  /** Cliente recém-salvo (ex.: o Novo Pedido já seleciona o cliente cadastrado) */
  onSalvo?: (cliente: Cliente) => void
}

// Cadastro/edição de cliente, usado na tela Clientes e no "+ Cadastrar cliente" do Novo Pedido.
// Monta o formulário só quando abre, para começar sempre com os dados do cliente da vez.
export function ClienteFormModal(props: ClienteFormModalProps) {
  if (!props.open) return null
  return <FormularioCliente {...props} />
}

function FormularioCliente({ cliente, onClose, onSalvo }: ClienteFormModalProps) {
  const qc = useQueryClient()
  const editando = cliente
  const [form, setForm] = useState<any>(() => formDoCliente(cliente))
  const [formErros, setFormErros] = useState<FormErros>({})
  const [erroApiSalvar, setErroApiSalvar] = useState('')

  const { data: estados = [] } = useQuery({
    queryKey: ['localidades-estados'],
    queryFn: () => api.get('/localidades/estados').then((r) => r.data),
  })

  const { data: cidades = [] } = useQuery({
    queryKey: ['localidades-cidades', form.endereco?.estadoId],
    queryFn: () =>
      api.get(`/localidades/estados/${form.endereco?.estadoId}/cidades`).then((r) => r.data),
    enabled: !!form.endereco?.estadoId,
  })

  const salvar = useMutation({
    mutationFn: (data: any) =>
      editando ? api.put(`/clientes/${editando.id}`, data) : api.post('/clientes', data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      onSalvo?.(res.data)
      onClose()
    },
    onError: (error: any) => {
      const mensagem = extrairMensagemApi(error)
      setErroApiSalvar(mensagem)

      if (mensagem.toLowerCase().includes('cpf/cnpj')) {
        setFormErros((prev) => ({
          ...prev,
          cnpjCpf: 'Já existe cliente cadastrado com este CPF/CNPJ.',
        }))
      }
    },
  })

  function set(k: string, v: any) {
    setErroApiSalvar('')
    setFormErros((prev) => ({ ...prev, [k]: undefined }))
    setForm((f: any) => ({ ...f, [k]: v }))
  }

  return (
    <Modal open onClose={onClose} title={editando ? 'Editar Cliente' : 'Novo Cliente'} size="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault()

          const erros = validarClienteForm(form)
          setFormErros(erros)
          setErroApiSalvar('')

          if (Object.keys(erros).length > 0) {
            return
          }

          const endereco = form.endereco ?? EMPTY_FORM.endereco
          const payload = {
            ...form,
            endereco: { ...endereco, principal: true },
          }
          salvar.mutate(payload)
        }}
        className="space-y-4"
      >
        {erroApiSalvar && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {erroApiSalvar}
          </p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Razão Social / Nome *"
              value={form.razaoSocialOuNome}
              onChange={(e) => set('razaoSocialOuNome', e.target.value)}
              maxLength={120}
              error={formErros.razaoSocialOuNome}
              required
            />
          </div>
          <Input
            label="Nome Fantasia"
            value={form.nomeFantasia}
            maxLength={120}
            onChange={(e) => set('nomeFantasia', e.target.value)}
          />
          <Input
            label="CNPJ / CPF"
            value={form.cnpjCpf}
            onChange={(e) => set('cnpjCpf', formatarCpfCnpj(e.target.value))}
            error={formErros.cnpjCpf}
            maxLength={18}
          />
          <Input
            label="Telefone *"
            value={form.telefone}
            onChange={(e) => set('telefone', formatarTelefone(e.target.value))}
            error={formErros.telefone}
            required
            maxLength={16}
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(e) => set('whatsapp', formatarTelefone(e.target.value))}
            maxLength={16}
          />
          <Input
            label="E-mail"
            type="email"
            value={form.email}
            maxLength={255}
            onChange={(e) => set('email', e.target.value)}
          />
          <Input
            label="Responsável pelo Contato"
            value={form.responsavelContato}
            maxLength={120}
            onChange={(e) => set('responsavelContato', e.target.value)}
          />

          <div className="sm:col-span-2 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
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
                          ...(prev.endereco ?? EMPTY_FORM.endereco),
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
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  label="Ponto de Referência"
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

          <Input
            label="Condição de Pagamento"
            value={form.condicaoPagamento}
            maxLength={50}
            onChange={(e) => set('condicaoPagamento', e.target.value)}
            placeholder="Ex: 30 dias"
          />
          <Select
            label="Forma de Pagamento Habitual"
            value={form.formaPagamentoUsual ?? ''}
            onChange={(e) => set('formaPagamentoUsual', e.target.value)}
          >
            <option value="">Selecione</option>
            {FORMAS_PAGAMENTO.map((f) => (
              <option key={f} value={f}>
                {FORMA_PAGAMENTO_LABEL[f]}
              </option>
            ))}
          </Select>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              type="checkbox"
              id="nf"
              checked={form.necessitaNF}
              onChange={(e) => set('necessitaNF', e.target.checked)}
              className="accent-green-600"
            />
            <label htmlFor="nf" className="text-sm text-gray-700">
              Necessita Nota Fiscal
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Observações</label>
            <textarea
              value={form.observacoes ?? ''}
              maxLength={500}
              onChange={(e) => set('observacoes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
