export function formatBRL(value: number | string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR')
}

export const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  EM_CONFERENCIA: 'Em conferência',
  APROVADO: 'Aprovado',
  SEPARACAO_ENTREGA: 'Em separação',
  ENTREGUE: 'Entregue',
  FATURADO: 'Faturado',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
}

export function statusPedidoVisivel(p: { status: string; aguardandoAlteracao?: boolean }) {
  if (p.aguardandoAlteracao) {
    return { label: 'Aguardando alteração', className: 'bg-amber-100 text-amber-800' }
  }
  return {
    label: STATUS_LABEL[p.status] ?? p.status,
    className: STATUS_COLOR[p.status] ?? 'bg-gray-100 text-gray-700',
  }
}

export const STATUS_COLOR: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-600',
  ENVIADO: 'bg-blue-100 text-blue-700',
  EM_CONFERENCIA: 'bg-yellow-100 text-yellow-700',
  APROVADO: 'bg-green-100 text-green-700',
  SEPARACAO_ENTREGA: 'bg-purple-100 text-purple-700',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  FATURADO: 'bg-indigo-100 text-indigo-700',
  PAGO: 'bg-teal-100 text-teal-700',
  CANCELADO: 'bg-red-100 text-red-700',
}
