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
  RASCUNHO: 'Rascunho',
  ENVIADO: 'Enviado',
  EM_CONFERENCIA: 'Em conferência',
  APROVADO: 'Aprovado',
  SEPARACAO_ENTREGA: 'Separação/Entrega',
  ENTREGUE: 'Entregue',
  FATURADO: 'Faturado',
  PAGO: 'Pago',
  CANCELADO: 'Cancelado',
}

export const STATUS_PEDIDO_COLOR: Record<string, string> = {
  RASCUNHO: 'bg-gray-100 text-gray-700',
  ENVIADO: 'bg-blue-100 text-blue-700',
  EM_CONFERENCIA: 'bg-yellow-100 text-yellow-700',
  APROVADO: 'bg-green-100 text-green-700',
  SEPARACAO_ENTREGA: 'bg-purple-100 text-purple-700',
  ENTREGUE: 'bg-emerald-100 text-emerald-700',
  FATURADO: 'bg-indigo-100 text-indigo-700',
  PAGO: 'bg-teal-100 text-teal-700',
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
