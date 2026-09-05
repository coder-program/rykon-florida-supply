import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBRL(value: number | string) {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Formata número como 1.200,00 (sem o prefixo R$) */
export function formatBRLInput(value: number | string) {
  if (value === '' || value === undefined || value === null) return ''
  const n = typeof value === 'string' ? parseBRLInput(value) : Number(value)
  if (Number.isNaN(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Converte "1.200,00" ou dígitos em número */
export function parseBRLInput(raw: string): number {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return 0
  return Number(digits) / 100
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('pt-BR')
}

export function formatDateTime(date: string | Date) {
  return new Date(date).toLocaleString('pt-BR')
}

export const STATUS_PEDIDO_LABEL: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  APROVADO: 'Aprovado',
  REJEITADO: 'Rejeitado',
  EM_SEPARACAO: 'Pedido em Andamento',
  PRONTO_PARA_ENTREGA: 'Pronto para entrega',
  EM_ENTREGA: 'A caminho',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
}

export function statusPedidoVisivel(p: { status: string; aguardandoAlteracao?: boolean }) {
  if (p.aguardandoAlteracao) {
    return { label: 'Aguardando alteração', className: 'bg-amber-100 text-amber-800' }
  }
  return {
    label: STATUS_PEDIDO_LABEL[p.status] ?? p.status,
    className: STATUS_PEDIDO_COLOR[p.status] ?? 'bg-gray-100 text-gray-700',
  }
}

export const STATUS_PEDIDO_COLOR: Record<string, string> = {
  AGUARDANDO_APROVACAO: 'bg-blue-100 text-blue-700',
  APROVADO: 'bg-green-100 text-green-700',
  REJEITADO: 'bg-red-100 text-red-700',
  EM_SEPARACAO: 'bg-purple-100 text-purple-700',
  PRONTO_PARA_ENTREGA: 'bg-indigo-100 text-indigo-700',
  EM_ENTREGA: 'bg-cyan-100 text-cyan-800',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  CANCELADO: 'bg-red-100 text-red-700',
}

export const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  DINHEIRO: 'Dinheiro',
  OUTROS: 'Outros',
}

export const STATUS_PAGAMENTO_COLOR: Record<string, string> = {
  PAGO: 'bg-green-100 text-green-700',
  EM_ABERTO: 'bg-yellow-100 text-yellow-700',
  VENCIDO: 'bg-red-100 text-red-700',
}
