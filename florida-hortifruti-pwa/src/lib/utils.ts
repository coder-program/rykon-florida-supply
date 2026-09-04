export function formatBRL(value: number | string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR')
}

export const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  EM_SEPARACAO: 'Em separação',
  PRONTO_PARA_ENTREGA: 'Pronto para entrega',
  EM_ENTREGA: 'Em entrega',
  ENTREGUE: 'Entregue',
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
  AGUARDANDO_APROVACAO: 'bg-blue-100 text-blue-700',
  APROVADO: 'bg-green-100 text-green-700',
  REJEITADO: 'bg-red-100 text-red-700',
  EM_SEPARACAO: 'bg-purple-100 text-purple-700',
  PRONTO_PARA_ENTREGA: 'bg-indigo-100 text-indigo-700',
  EM_ENTREGA: 'bg-cyan-100 text-cyan-800',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-red-100 text-red-700',
}
