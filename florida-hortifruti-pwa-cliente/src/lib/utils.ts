export function formatBRL(value: number | string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR')
}

export const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  REJEITADO: 'Não aprovado',
  EM_SEPARACAO: 'Preparando seu pedido',
  PRONTO_PARA_ENTREGA: 'Pronto para sair',
  EM_ENTREGA: 'Saiu para entrega',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
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

export const DISPONIBILIDADE: Record<string, { label: string; className: string }> = {
  DISPONIVEL: { label: 'Disponível', className: 'bg-green-500' },
  POUCA_QUANTIDADE: { label: 'Pouca quantidade', className: 'bg-amber-500' },
  INDISPONIVEL: { label: 'Indisponível', className: 'bg-gray-400' },
}
