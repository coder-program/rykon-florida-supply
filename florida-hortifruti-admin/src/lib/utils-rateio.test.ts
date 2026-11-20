import { describe, expect, it } from 'vitest'
import { fromCents, previewRateio, toCents } from './rateio'
import {
  cn,
  diaISO,
  formatBRL,
  formatBRLInput,
  formatDate,
  formatDateTime,
  hojeISO,
  statusPedidoVisivel,
} from './utils'

describe('utils', () => {
  it('formatos de data, moeda e classes', () => {
    expect(formatBRL('10')).toMatch(/R\$\s10,00/)
    expect(formatBRLInput('1.234,56')).toBe('1.234,56')
    expect(formatBRLInput(Number.NaN)).toBe('')
    expect(formatBRLInput(null as never)).toBe('')
    expect(formatBRLInput(undefined as never)).toBe('')
    expect(formatDate('2026-11-10T15:00:00Z')).toBe('10/11/2026')
    expect(formatDateTime('2026-11-10T15:00:00Z')).toContain('10/11/2026')
    expect(diaISO('2026-11-10T15:00:00Z')).toBe('2026-11-10')
    expect(hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(cn('p-2', ['p-4'], { x: false })).toBe('p-4')
  })
  it('status sem cor conhecida usa o cinza', () => {
    expect(statusPedidoVisivel({ status: 'NOVO' }).className).toBe('bg-gray-100 text-gray-700')
    expect(statusPedidoVisivel({ status: 'APROVADO' }).className).toContain('green')
  })
})

describe('rateio', () => {
  it('centavos', () => {
    expect(toCents(0)).toBe(0)
    expect(toCents(undefined as never)).toBe(0)
    expect(fromCents(1234)).toBe(12.34)
  })
  it('itens sem valor dividem igualmente', () => {
    const r = previewRateio(
      [
        { produtoId: 'a', quantidade: '2', valorProduto: 0 },
        { produtoId: 'b', quantidade: 1, valorProduto: undefined as never },
      ],
      10,
      undefined as never,
    )
    expect(r.map((i) => i.rateioFrete)).toEqual([5, 5])
    expect(r[0]).toMatchObject({ quantidade: 2, valorUnitario: 0, custoTotal: 5, custoCaixa: 2.5 })
    expect(r[1].rateioComissao).toBe(0)
  })
})
