import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  MessageCircle,
} from 'lucide-react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { api } from '../lib/api'
import { useAuth } from '../contexts/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { TableScroll } from '../components/ui/TableScroll'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import { ClienteFormModal, type Cliente } from '../components/ClienteFormModal'

export function ClientesPage() {
  const qc = useQueryClient()
  const { isSupervisor } = useAuth()
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [modalDetalhes, setModalDetalhes] = useState(false)
  const [clienteParaExcluir, setClienteParaExcluir] = useState<Cliente | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [detalhesCliente, setDetalhesCliente] = useState<Cliente | null>(null)
  const [linkConvite, setLinkConvite] = useState('')
  const [emailConvite, setEmailConvite] = useState('')
  const [linkCopiado, setLinkCopiado] = useState(false)

  const { data: clientes = [], isLoading } = useQuery<Cliente[]>({
    queryKey: ['clientes', busca],
    queryFn: () =>
      api
        .get('/clientes', { params: busca ? { busca } : { incluirInativos: true } })
        .then((r) => r.data),
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

  const ativarAcesso = useMutation({
    mutationFn: ({ id, email }: { id: string; email?: string }) =>
      api.post(`/clientes/${id}/ativar-acesso`, email ? { email } : {}),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['clientes'] })
      setLinkConvite(res.data.linkConvite)
      setLinkCopiado(false)
      setDetalhesCliente((prev) => (prev ? { ...prev, ...res.data, linkConvite: undefined } : prev))
    },
  })

  function getPrincipalEndereco(c: Cliente | null | undefined) {
    return c?.enderecos?.find((e) => e.principal) ?? c?.enderecos?.[0] ?? null
  }

  function abrirNovo() {
    setEditando(null)
    setModal(true)
  }
  function abrirEditar(c: Cliente) {
    setEditando(c)
    setModal(true)
  }
  function fecharModal() {
    setModal(false)
    setEditando(null)
  }
  function abrirDetalhes(c: Cliente) {
    setDetalhesCliente(c)
    setEmailConvite(c.email ?? '')
    setLinkConvite('')
    setLinkCopiado(false)
    setModalDetalhes(true)
  }
  function fecharDetalhes() {
    setModalDetalhes(false)
    setDetalhesCliente(null)
    setLinkConvite('')
    setEmailConvite('')
    setLinkCopiado(false)
  }
  function confirmarExclusaoCliente() {
    if (!clienteParaExcluir) return
    excluir.mutate(clienteParaExcluir.id)
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
    <div className="min-w-0">
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
          {isLoading && (
            <p className="brand-loading py-8 text-center text-sm text-gray-400">Carregando...</p>
          )}
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
                className={`min-w-0 rounded-xl border border-gray-200 bg-white p-4 ${c.ativo === false ? 'opacity-60' : ''}`}
              >
                <p className="break-all font-semibold text-gray-900">{c.razaoSocialOuNome}</p>
                {c.nomeFantasia && (
                  <p className="break-all text-xs text-gray-400">{c.nomeFantasia}</p>
                )}
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
            <table className="w-full table-fixed text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[16%]" />
                <col className="w-[14%]" />
                <col className="w-[12%]" />
                <col className="w-[7%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
              </colgroup>
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
                  <th className="sticky right-0 bg-gray-50 px-4 py-3" />
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
                      className={`group hover:bg-gray-50 ${c.ativo === false ? 'opacity-60' : ''}`}
                    >
                      <td className="min-w-0 px-4 py-3">
                        <p
                          className="truncate font-medium text-gray-900"
                          title={c.razaoSocialOuNome}
                        >
                          {c.razaoSocialOuNome}
                        </p>
                        {c.nomeFantasia && (
                          <p className="truncate text-xs text-gray-400" title={c.nomeFantasia}>
                            {c.nomeFantasia}
                          </p>
                        )}
                      </td>
                      <td className="truncate px-4 py-3 text-gray-600">{c.cnpjCpf}</td>
                      <td className="truncate px-4 py-3 text-gray-600">
                        {cidade}
                        {estado ? `/${estado}` : ''}
                      </td>
                      <td className="truncate px-4 py-3 text-gray-600">
                        {c.formaPagamentoUsual ?? '—'}
                      </td>
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
                      <td className="sticky right-0 bg-white px-2 py-3 group-hover:bg-gray-50">
                        <div className="flex justify-end gap-1">
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

      <ClienteFormModal open={modal} cliente={editando} onClose={fecharModal} />

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

      <Modal open={modalDetalhes} onClose={fecharDetalhes} title="Cliente" size="lg">
        {detalhesCliente && (
          <div className="space-y-5 text-sm">
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                {detalhesCliente.razaoSocialOuNome}
              </h3>
              <p className="mt-0.5 text-gray-500">
                {[detalhesCliente.nomeFantasia, detalhesCliente.cnpjCpf, detalhesCliente.telefone]
                  .filter(Boolean)
                  .join(' · ') || 'Sem documento ou telefone'}
              </p>
            </div>

            <section className="rounded-xl border border-gray-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="font-semibold text-gray-900">Acesso ao app</p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    detalhesCliente.statusConvite === 'ATIVO'
                      ? 'bg-green-100 text-green-800'
                      : detalhesCliente.statusConvite === 'CONVITE_ENVIADO'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {detalhesCliente.statusConvite === 'ATIVO'
                    ? 'Ativo'
                    : detalhesCliente.statusConvite === 'CONVITE_ENVIADO'
                      ? 'Convite gerado'
                      : 'Sem acesso'}
                </span>
              </div>

              {detalhesCliente.statusConvite === 'ATIVO' ? (
                <p className="text-gray-600">
                  Já entra com {detalhesCliente.email ?? 'o e-mail cadastrado'}.
                </p>
              ) : isSupervisor ? (
                // Liberar acesso ao app continua com o administrativo/admin (API recusa o supervisor)
                <p className="text-gray-600">O administrativo libera o acesso ao app.</p>
              ) : (
                <div className="space-y-3">
                  <Input
                    label="E-mail de login"
                    type="email"
                    value={emailConvite}
                    onChange={(e) => setEmailConvite(e.target.value)}
                    placeholder="cliente@empresa.com"
                  />
                  <Button
                    type="button"
                    disabled={ativarAcesso.isPending || !emailConvite.trim()}
                    onClick={() =>
                      ativarAcesso.mutate({
                        id: detalhesCliente.id,
                        email: emailConvite.trim(),
                      })
                    }
                  >
                    {ativarAcesso.isPending ? 'Gerando link...' : 'Gerar link de acesso'}
                  </Button>
                  {ativarAcesso.isError && (
                    <p className="text-xs text-red-600">
                      {(ativarAcesso.error as any)?.response?.data?.message ??
                        'Não foi possível gerar o convite.'}
                    </p>
                  )}
                  {linkConvite && (
                    <div className="space-y-2 rounded-lg bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">
                        Válido por 48 horas. Envie ao cliente.
                      </p>
                      <input
                        readOnly
                        value={linkConvite}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            await navigator.clipboard.writeText(linkConvite)
                            setLinkCopiado(true)
                          }}
                        >
                          {linkCopiado ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                          {linkCopiado ? 'Copiado' : 'Copiar'}
                        </Button>
                        {(detalhesCliente.whatsapp || detalhesCliente.telefone) && (
                          <a
                            href={`https://wa.me/55${(detalhesCliente.whatsapp || detalhesCliente.telefone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Seu acesso ao app da Flórida Supply: ${linkConvite}`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-green-600 px-3 text-xs font-medium text-white"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-gray-500">E-mail</p>
                <p className="font-medium text-gray-800">
                  {detalhesCliente.email || emailConvite || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">WhatsApp</p>
                <p className="font-medium text-gray-800">{detalhesCliente.whatsapp ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Responsável</p>
                <p className="font-medium text-gray-800">
                  {detalhesCliente.responsavelContato ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Pagamento</p>
                <p className="font-medium text-gray-800">
                  {[detalhesCliente.formaPagamentoUsual, detalhesCliente.condicaoPagamento]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Nota fiscal</p>
                <p className="font-medium text-gray-800">
                  {detalhesCliente.necessitaNF ? 'Sim' : 'Não'}
                </p>
              </div>
              {detalhesCliente.observacoes && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-500">Observações</p>
                  <p className="font-medium text-gray-800">{detalhesCliente.observacoes}</p>
                </div>
              )}
            </section>

            <section>
              <p className="mb-1 text-xs text-gray-500">Endereço</p>
              {(() => {
                const principal = getPrincipalEndereco(detalhesCliente)
                if (!principal) return <p className="text-gray-500">Nenhum endereço cadastrado.</p>
                const cidade = principal.cidade?.nome ?? ''
                const estado = principal.cidade?.estado?.sigla ?? ''
                const linha = [
                  principal.logradouro,
                  principal.numero,
                  principal.complemento,
                  principal.bairro,
                  cidade && estado ? `${cidade}/${estado}` : cidade,
                  principal.cep,
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  <div>
                    <p className="font-medium text-gray-800">{linha || '—'}</p>
                    {principal.pontoReferencia && (
                      <p
                        className="mt-1 truncate text-xs text-gray-500"
                        title={principal.pontoReferencia}
                      >
                        Ref.: {principal.pontoReferencia}
                      </p>
                    )}
                  </div>
                )
              })()}
            </section>
          </div>
        )}
      </Modal>
    </div>
  )
}
