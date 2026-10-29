import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, MessageCircle, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { formatDateTime } from '../lib/utils'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Input'

const TIPO_LABEL: Record<string, string> = {
  COMPRA_A_PRAZO: 'Compra registrada',
  VENCE_EM_3_DIAS: '3 dias antes',
  VENCIMENTO_HOJE: 'Vencimento',
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  PENDENTE: { label: 'A enviar', badge: 'bg-amber-100 text-amber-800' },
  ENVIADA: { label: 'Enviado', badge: 'bg-green-100 text-green-700' },
  CANCELADA: { label: 'Cancelado (pago)', badge: 'bg-gray-100 text-gray-600' },
}

const FECHO_AVISO = 'Qualquer coisa ficamos à disposição,\nFlorida Supply Hortifruti ;)'

// wa.me precisa do número com DDI, só dígitos
function linkWhatsApp(telefone: string | null | undefined, texto: string) {
  let digitos = (telefone ?? '').replace(/\D/g, '')
  if (!digitos) return null
  if (digitos.length <= 11) digitos = `55${digitos}`
  return `https://wa.me/${digitos}?text=${encodeURIComponent(texto)}`
}

// Avisos de cobrança das compras a prazo: aparecem no portal do cliente na hora
// e a equipe pode mandar o mesmo texto pelo WhatsApp com um clique.
export function AvisosCobranca() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('PENDENTE')

  const { data: avisos = [], isLoading } = useQuery({
    queryKey: ['avisos-cobranca', status],
    queryFn: () =>
      api.get('/financeiro/notificacoes', { params: status ? { status } : {} }).then((r) => r.data),
  })

  const marcarEnviado = useMutation({
    mutationFn: (id: string) => api.post(`/financeiro/notificacoes/${id}/enviada`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos-cobranca'] }),
  })

  const gerarAgora = useMutation({
    mutationFn: () => api.post('/financeiro/notificacoes-vencimento'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avisos-cobranca'] }),
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Avisos de cobrança</h2>
            <p className="text-xs text-gray-500">
              Na compra a prazo, 3 dias antes e no dia do vencimento (se não pago). O cliente vê no
              portal; pelo WhatsApp é com o botão.
            </p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-40">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="PENDENTE">A enviar</option>
              <option value="ENVIADA">Enviados</option>
              <option value="CANCELADA">Cancelados</option>
              <option value="">Todos</option>
            </Select>
          </div>
          <Button
            variant="secondary"
            onClick={() => gerarAgora.mutate()}
            disabled={gerarAgora.isPending}
            title="O sistema já verifica sozinho todo dia às 8h"
          >
            <RefreshCw className="w-4 h-4" /> Verificar agora
          </Button>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {avisos.map((aviso: any) => {
          const telefone = aviso.cliente?.whatsapp || aviso.cliente?.telefone
          // Avisos novos já trazem o fecho; os antigos ganham o mesmo fecho aqui
          const fecho = String(aviso.mensagem).includes('Florida Supply Hortifruti')
            ? ''
            : `\n\n${FECHO_AVISO}`
          const texto = `Olá, ${aviso.cliente?.razaoSocialOuNome ?? ''}! ${aviso.mensagem}${fecho}`
          const link = linkWhatsApp(telefone, texto)
          const config = STATUS_CONFIG[aviso.status] ?? STATUS_CONFIG.PENDENTE
          return (
            <div
              key={aviso.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {aviso.cliente?.razaoSocialOuNome}
                  </span>
                  <Badge className="bg-blue-50 text-blue-700">
                    {TIPO_LABEL[aviso.tipo] ?? aviso.tipo}
                  </Badge>
                  <Badge className={config.badge}>{config.label}</Badge>
                  {aviso.lidaEm && (
                    <Badge className="bg-green-50 text-green-700">Visto no portal</Badge>
                  )}
                </div>
                <p className="whitespace-pre-line text-sm text-gray-600">{aviso.mensagem}</p>
                <p className="text-xs text-gray-400">
                  Criado {formatDateTime(aviso.criadoEm)}
                  {aviso.enviadaEm ? ` · enviado ${formatDateTime(aviso.enviadaEm)}` : ''}
                </p>
              </div>
              {aviso.status !== 'CANCELADA' && (
                <div className="flex shrink-0 gap-2">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        if (aviso.status === 'PENDENTE') marcarEnviado.mutate(aviso.id)
                      }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">Cliente sem telefone</span>
                  )}
                  {aviso.status === 'PENDENTE' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => marcarEnviado.mutate(aviso.id)}
                      disabled={marcarEnviado.isPending}
                    >
                      Marcar enviado
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        {!isLoading && avisos.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">Nenhum aviso</p>
        )}
      </div>
    </div>
  )
}
