import { describe, expect, it } from 'vitest'
import { subtotal, totalItens, type CartItem } from './cart'

const item = (preco: number | null, quantidade: number): CartItem => ({
  produtoId: 'p',
  nome: 'Morango',
  unidadeVenda: 'CX',
  preco,
  quantidade,
})

describe('carrinho', () => {
  it('soma caixas e valor', () => {
    const itens = [item(27, 2), item(10.5, 1)]
    expect(totalItens(itens)).toBe(3)
    expect(subtotal(itens)).toBe(64.5)
  })
  it('produto sem preço não soma valor', () => {
    expect(subtotal([item(null, 4)])).toBe(0)
  })
})
