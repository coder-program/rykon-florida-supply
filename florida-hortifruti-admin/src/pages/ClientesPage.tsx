import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Pencil, Trash2, RotateCcw, FileSpreadsheet, FileText } from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'

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

type Cliente = {
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

export function ClientesPage() {
  const qc = useQueryClient()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [modalDetalhes, setModalDetalhes] = useState(false)
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [detalhesCliente, setDetalhesCliente] = useState<Cliente | null>(null)
  const [form, setForm] = useState<any>(EMPTY_FORM)
  const [formErros, setFormErros] = useState<FormErros>({})
  const [erroApiSalvar, setErroApiSalvar] = useState('')

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes', busca],
    queryFn: () =>
      api
        .get('/clientes', { params: busca ? { busca } : { incluirInativos: true } })
        .then((r) => r.data),
  })

  const { data: estados = [] } = useQuery({
    queryKey: ['localidades-estados'],
    queryFn: () => api.get('/localidades/estados').then((r) => r.data),
    enabled: modal,
  })

  const { data: cidades = [] } = useQuery({
    queryKey: ['localidades-cidades', form.endereco?.estadoId],
    queryFn: () =>
      api.get(`/localidades/estados/${form.endereco?.estadoId}/cidades`).then((r) => r.data),
    enabled: !!form.endereco?.estadoId && modal,
  })

  const salvar = useMutation({
    mutationFn: (data: any) =>
      editando ? api.put(`/clientes/${editando.id}`, data) : api.post('/clientes', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      setFormErros({})
      setErroApiSalvar('')
      fecharModal()
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

  const excluir = useMutation({
    mutationFn: (id: string) => api.delete(`/clientes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      setClienteParaExcluir(null)
    },
  })

  const reativar = useMutation({
    mutationFn: (id: string) => api.post(`/clientes/${id}/reativar`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['clientes'] }),
  })

  function getPrincipalEndereco(c: Cliente | null | undefined) {
    return c?.enderecos?.find((e) => e.principal) ?? c?.enderecos?.[0] ?? null
  }

  function abrirNovo() {
    setForm({ ...EMPTY_FORM })
    setEditando(null)
    setFormErros({})
    setErroApiSalvar('')
    setModal(true)
  }
  function abrirEditar(c: Cliente) {
    const principal = getPrincipalEndereco(c)
    setForm({
      ...c,
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
    setEditando(c)
    setFormErros({})
    setErroApiSalvar('')
    setModal(true)
  }
  function fecharModal() {
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
  function abrirDetalhes(c: Cliente) {
    setDetalhesCliente(c)
    setModalDetalhes(true)
  }
  function fecharDetalhes() {
    setModalDetalhes(false)
    setDetalhesCliente(null)
  }
  function confirmarExclusaoCliente() {
    if (!clienteParaExcluir) return
    excluir.mutate(clienteParaExcluir.id)
  }

  function normalizarTextoBusca(valor: string) {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .toLowerCase()
      .trim()
  }

  function formatarDataArquivo() {
    return new Date().toISOString().slice(0, 10)
  }

  async function exportarExcel() {
    const linhas = clientes.map((c) => {
      const principal = getPrincipalEndereco(c)
      return {
        Nome: c.razaoSocialOuNome ?? '',
        Fantasia: c.nomeFantasia ?? '',
        'CNPJ/CPF': c.cnpjCpf ?? '',
        Telefone: c.telefone ?? '',
        WhatsApp: c.whatsapp ?? '',
        Email: c.email ?? '',
        Cidade: principal?.cidade?.nome ?? '',
        Estado: principal?.cidade?.estado?.sigla ?? '',
        Pagamento: c.formaPagamentoUsual ?? '',
        'Necessita NF': c.necessitaNF ? 'Sim' : 'Nao',
        Status: c.ativo === false ? 'Inativo' : 'Ativo',
      }
    })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Clientes')
    worksheet.columns = [
      { header: 'Nome', key: 'Nome', width: 24 },
      { header: 'Fantasia', key: 'Fantasia', width: 20 },
      { header: 'CNPJ/CPF', key: 'CNPJ/CPF', width: 18 },
      { header: 'Telefone', key: 'Telefone', width: 16 },
      { header: 'WhatsApp', key: 'WhatsApp', width: 16 },
      { header: 'Email', key: 'Email', width: 26 },
      { header: 'Cidade', key: 'Cidade', width: 16 },
      { header: 'Estado', key: 'Estado', width: 10 },
      { header: 'Pagamento', key: 'Pagamento', width: 18 },
      { header: 'Necessita NF', key: 'Necessita NF', width: 14 },
      { header: 'Status', key: 'Status', width: 12 },
    ]
    worksheet.addRows(linhas)

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `clientes-${formatarDataArquivo()}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  function exportarPdf() {
    const doc = new jsPDF({ orientation: 'landscape' })
    doc.setFontSize(14)
    doc.text('Relatorio de Clientes', 14, 14)
    doc.setFontSize(10)
    doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, 14, 20)

    autoTable(doc, {
      startY: 26,
      head: [
        ['Nome', 'Fantasia', 'CNPJ/CPF', 'Telefone', 'Cidade/UF', 'Pagamento', 'NF', 'Status'],
      ],
      body: clientes.map((c) => {
        const principal = getPrincipalEndereco(c)
        return [
          c.razaoSocialOuNome ?? '',
          c.nomeFantasia ?? '',
          c.cnpjCpf ?? '',
          c.telefone ?? '',
          `${principal?.cidade?.nome ?? ''}${principal?.cidade?.estado?.sigla ? `/${principal.cidade.estado.sigla}` : ''}`,
          c.formaPagamentoUsual ?? '',
          c.necessitaNF ? 'Sim' : 'Nao',
          c.ativo === false ? 'Inativo' : 'Ativo',
        ]
      }),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 163, 74] },
    })

    doc.save(`clientes-${formatarDataArquivo()}.pdf`)
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle={`${clientes.length} cliente(s) cadastrado(s)`}
        actions={
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="secondary" onClick={exportarExcel} disabled={clientes.length === 0}>
              <FileSpreadsheet className="w-4 h-4" /> Exportar Excel
            </Button>
            <Button variant="secondary" onClick={exportarPdf} disabled={clientes.length === 0}>
              <FileText className="w-4 h-4" /> Exportar PDF
            </Button>
            <Button onClick={abrirNovo}>
              <Plus className="w-4 h-4" /> Novo Cliente
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4 md:p-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, CNPJ ou telefone..."
            className="w-full min-h-11 pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="space-y-3 md:hidden">
          {isLoading && <p className="py-8 text-center text-sm text-gray-400">Carregando...</p>}
          {!isLoading && clientes.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">Nenhum cliente encontrado</p>
          )}
          {clientes.map((c: any) => {
            const principal = getPrincipalEndereco(c)
            const cidade = principal?.cidade?.nome ?? ''
            const estado = principal?.cidade?.estado?.sigla ?? ''
            return (
              <div
                key={c.id}
                className={`rounded-xl border border-gray-200 bg-white p-4 ${c.ativo === false ? 'opacity-60' : ''}`}
              >
                <p className="font-semibold text-gray-900">{c.razaoSocialOuNome}</p>
                {c.nomeFantasia && <p className="text-xs text-gray-400">{c.nomeFantasia}</p>}
                <p className="mt-1 text-xs text-gray-500">
                  {cidade}
                  {estado ? `/${estado}` : ''} · {c.formaPagamentoUsual ?? '—'}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${c.ativo === false ? 'text-red-600' : 'text-green-600'}`}
                  >
                    {c.ativo === false ? 'Inativo' : 'Ativo'}
                  </span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => abrirDetalhes(c)}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="w-3.5 h-3.5"
                      >
                        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    {c.ativo === false ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600"
                        onClick={() => reativar.mutate(c.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:bg-red-50"
                        onClick={() => setClienteParaExcluir(c)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Nome / Fantasia
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    CNPJ/CPF
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Cidade</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">
                    Pagamento
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">NF</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && clientes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      Nenhum cliente encontrado
                    </td>
                  </tr>
                )}
                {clientes.map((c: any) => {
                  const principal = getPrincipalEndereco(c)
                  const cidade = principal?.cidade?.nome ?? ''
                  const estado = principal?.cidade?.estado?.sigla ?? ''
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50 ${c.ativo === false ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{c.razaoSocialOuNome}</p>
                        {c.nomeFantasia && (
                          <p className="text-xs text-gray-400">{c.nomeFantasia}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.cnpjCpf}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {cidade}
                        {estado ? `/${estado}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.formaPagamentoUsual ?? '—'}</td>
                      <td className="px-4 py-3">
                        {c.necessitaNF ? (
                          <span className="text-green-600 font-medium text-xs">Sim</span>
                        ) : (
                          <span className="text-gray-400 text-xs">Não</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.ativo === false ? (
                          <span className="text-xs font-medium text-red-600">Inativo</span>
                        ) : (
                          <span className="text-xs font-medium text-green-600">Ativo</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => abrirDetalhes(c)}>
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              className="w-3.5 h-3.5"
                            >
                              <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => abrirEditar(c)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {c.ativo === false ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600"
                              onClick={() => reativar.mutate(c.id)}
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-500 hover:bg-red-50"
                              onClick={() => setClienteParaExcluir(c)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        onClose={fecharModal}
        title={editando ? 'Editar Cliente' : 'Novo Cliente'}
        size="lg"
      >
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
                        const data = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then(
                          (r) => r.json(),
                        )
                        if (data.erro) return

                        const estado = estados.find(
                          (item: any) =>
                            String(item.sigla).toUpperCase() ===
                            String(data.uf ?? '').toUpperCase(),
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
                  onChange={(e) =>
                    set('endereco', { ...form.endereco, complemento: e.target.value })
                  }
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
              <option>PIX</option>
              <option>Boleto</option>
              <option>Dinheiro</option>
              <option>Outros</option>
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
            <Button type="button" variant="secondary" onClick={fecharModal}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!clienteParaExcluir}
        onClose={() => setClienteParaExcluir(null)}
        title="Excluir cliente"
        size="sm"
      >
        {clienteParaExcluir && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-700">Confirma exclusão?</p>
                <p className="text-sm text-red-700/80">
                  O cadastro de{' '}
                  <span className="font-semibold">{clienteParaExcluir.razaoSocialOuNome}</span> será
                  removido do sistema.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">Cliente selecionado</p>
              <p className="mt-1">{clienteParaExcluir.razaoSocialOuNome}</p>
              {clienteParaExcluir.cnpjCpf && (
                <p className="mt-1 text-xs text-gray-500">{clienteParaExcluir.cnpjCpf}</p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setClienteParaExcluir(null)}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={confirmarExclusaoCliente}
                disabled={excluir.isPending}
              >
                {excluir.isPending ? 'Excluindo...' : 'Excluir cliente'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={modalDetalhes} onClose={fecharDetalhes} title="Detalhes do Cliente" size="lg">
        {detalhesCliente && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Nome</span>
                <strong>{detalhesCliente.razaoSocialOuNome}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Nome Fantasia</span>
                <strong>{detalhesCliente.nomeFantasia ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">CNPJ/CPF</span>
                <strong>{detalhesCliente.cnpjCpf ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Telefone</span>
                <strong>{detalhesCliente.telefone ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">WhatsApp</span>
                <strong>{detalhesCliente.whatsapp ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">E-mail</span>
                <strong>{detalhesCliente.email ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Responsável</span>
                <strong>{detalhesCliente.responsavelContato ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Pagamento habitual</span>
                <strong>{detalhesCliente.formaPagamentoUsual ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Condição de pagamento</span>
                <strong>{detalhesCliente.condicaoPagamento ?? '—'}</strong>
              </div>
              <div className="rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Necessita NF</span>
                <strong>{detalhesCliente.necessitaNF ? 'Sim' : 'Não'}</strong>
              </div>
              <div className="sm:col-span-2 rounded-lg bg-gray-50 p-3">
                <span className="block text-xs text-gray-500">Observações</span>
                <strong>{detalhesCliente.observacoes ?? '—'}</strong>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="font-semibold text-gray-800 mb-3">Endereço</p>
              {(() => {
                const principal = getPrincipalEndereco(detalhesCliente)
                if (!principal) return <p className="text-gray-500">Nenhum endereço cadastrado.</p>
                const cidade = principal.cidade?.nome ?? ''
                const estado = principal.cidade?.estado?.sigla ?? ''
                return (
                  <div className="space-y-1 text-gray-700">
                    <p>
                      <strong>CEP:</strong> {principal.cep ?? '—'}
                    </p>
                    <p>
                      <strong>Logradouro:</strong> {principal.logradouro ?? '—'}
                    </p>
                    <p>
                      <strong>Número:</strong> {principal.numero ?? '—'}
                    </p>
                    <p>
                      <strong>Complemento:</strong> {principal.complemento ?? '—'}
                    </p>
                    <p>
                      <strong>Bairro:</strong> {principal.bairro ?? '—'}
                    </p>
                    <p>
                      <strong>Cidade/UF:</strong> {cidade}
                      {estado ? `/${estado}` : ''}
                    </p>
                    <p>
                      <strong>Ponto de referência:</strong> {principal.pontoReferencia ?? '—'}
                    </p>
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
