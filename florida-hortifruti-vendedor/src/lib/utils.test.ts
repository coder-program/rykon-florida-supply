import { describe, expect, it } from 'vitest'
import { FORMAS_PAGAMENTO, statusPedidoVisivel } from './utils'

describe('statusPedidoVisivel', () => {
  it('alteração pendente aparece no lugar do status', () => {
    expect(statusPedidoVisivel({ status: 'APROVADO', aguardandoAlteracao: true }).label).toBe(
      'Aguardando alteração',
    )
    expect(statusPedidoVisivel({ status: 'ENTREGUE' }).label).toBe('Entregue')
  })
})

describe('formas de pagamento', () => {
  it('não oferece as formas antigas', () => {
    expect(FORMAS_PAGAMENTO).not.toContain('BOLETO')
    expect(FORMAS_PAGAMENTO).not.toContain('OUTROS')
  })
})
