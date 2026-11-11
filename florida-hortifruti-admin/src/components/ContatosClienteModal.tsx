import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { formatDate, hojeISO } from '../lib/utils'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { Input, Select } from './ui/Input'

export const TIPO_CONTATO_LABEL: Record<string, string> = {
  LIGACAO: 'Ligação',
  WHATSAPP: 'WhatsApp',
  VISITA: 'Visita',
  OUTRO: 'Outro',
}

type Contato = {
  id: string
  data: string
  tipo: string
  resumo: string
  proximoContato: string | null
  usuario?: { nome: string } | null
}

const FORM_VAZIO = { tipo: 'LIGACAO', resumo: '', data: '', proximoContato: '' }

// Histórico de contatos com o cliente e registro de um novo (com a data do próximo)
export function ContatosClienteModal({
  cliente,
  onClose,
}: {
  cliente: { id: string; razaoSocialOuNome: string } | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ ...FORM_VAZIO, data: hojeISO() })

  const { data: contatos = [], isLoading } = useQuery<Contato[]>({
    queryKey: ['contatos-cliente', cliente?.id],
    queryFn: () => api.get(`/clientes/${cliente!.id}/contatos`).then((r) => r.data),
    enabled: !!cliente,
  })

  const registrar = useMutation({
    mutationFn: () =>
      api.post(`/clientes/${cliente!.id}/contatos`, {
        tipo: form.tipo,
        resumo: form.resumo,
        data: form.data || undefined,
        proximoContato: form.proximoContato || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contatos-cliente', cliente?.id] })
      qc.invalidateQueries({ queryKey: ['contatos-ultimos'] })
      setForm({ ...FORM_VAZIO, data: hojeISO() })
    },
  })

  const erro = (registrar.error as any)?.response?.data?.message

  return (
    <Modal
      open={!!cliente}
      onClose={onClose}
      title={`Contatos — ${cliente?.razaoSocialOuNome ?? ''}`}
      size="lg"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          registrar.mutate()
        }}
        className="space-y-3 rounded-lg border border-gray-200 p-3"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
          >
            {Object.entries(TIPO_CONTATO_LABEL).map(([valor, label]) => (
              <option key={valor} value={valor}>
                {label}
              </option>
            ))}
          </Select>
          <Input
            label="Data"
            type="date"
            max={hojeISO()}
            value={form.data}
            onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))}
          />
          <Input
            label="Próximo contato"
            type="date"
            value={form.proximoContato}
            onChange={(e) => setForm((f) => ({ ...f, proximoContato: e.target.value }))}
          />
        </div>
        <Input
          label="O que foi conversado *"
          required
          value={form.resumo}
          onChange={(e) => setForm((f) => ({ ...f, resumo: e.target.value }))}
        />
        {erro && (
          <p className="text-sm text-red-600">{Array.isArray(erro) ? erro.join(' ') : erro}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={registrar.isPending}>
            {registrar.isPending ? 'Salvando...' : 'Registrar contato'}
          </Button>
        </div>
      </form>

      <div className="mt-4 space-y-2">
        {isLoading && <p className="text-sm text-gray-400">Carregando...</p>}
        {!isLoading && contatos.length === 0 && (
          <p className="text-sm text-gray-400">Nenhum contato registrado ainda</p>
        )}
        {contatos.map((c) => (
          <div key={c.id} className="rounded-lg border border-gray-100 px-3 py-2 text-sm">
            <p className="text-xs text-gray-500">
              {formatDate(c.data)} · {TIPO_CONTATO_LABEL[c.tipo] ?? c.tipo}
              {c.usuario?.nome ? ` · ${c.usuario.nome}` : ''}
            </p>
            <p className="text-gray-800">{c.resumo}</p>
            {c.proximoContato && (
              <p className="text-xs text-gray-500">
                Próximo contato: {formatDate(c.proximoContato)}
              </p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
