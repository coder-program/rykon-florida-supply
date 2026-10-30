export const MOTIVOS_DEVOLUCAO = [
  { valor: 'ESTRAGADO', label: 'Estragado' },
  { valor: 'REFUGO', label: 'Refugo' },
  { valor: 'MELADO', label: 'Melado' },
  { valor: 'MUITO_MADURO', label: 'Muito maduro' },
  { valor: 'MUITO_VERDE', label: 'Muito verde' },
  { valor: 'OUTROS', label: 'Outros' },
] as const

export type SelecaoMotivos = { motivos: string[]; motivoOutro: string }

export const SELECAO_VAZIA: SelecaoMotivos = { motivos: [], motivoOutro: '' }

// Texto do erro quando a seleção está incompleta; null quando está ok
export function erroSelecao(selecao: SelecaoMotivos | undefined, nome: string) {
  if (!selecao?.motivos.length) return `Escolha o motivo da devolução de ${nome}`
  if (selecao.motivos.includes('OUTROS') && !selecao.motivoOutro.trim()) {
    return `Escreva o motivo "Outros" de ${nome}`
  }
  return null
}
