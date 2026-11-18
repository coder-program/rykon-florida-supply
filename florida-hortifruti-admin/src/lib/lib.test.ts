import { describe, expect, it } from 'vitest'
import { rotasPermitidas } from './permissoes'
import { previewRateio } from './rateio'
import { valorPorExtenso } from './recibo'
import { formatBRLInput, pagoParcialmente, parseBRLInput, statusPedidoVisivel } from './utils'

describe('valores em reais', () => {
  it('lê o que é digitado como centavos', () => {
    expect(parseBRLInput('1.200,50')).toBe(1200.5)
    expect(parseBRLInput('R$ 27,00')).toBe(27)
    expect(parseBRLInput('')).toBe(0)
  })
  it('formata sem o R$', () => {
    expect(formatBRLInput(1200.5)).toBe('1.200,50')
    expect(formatBRLInput('')).toBe('')
  })
})

describe('pagoParcialmente', () => {
  it('em aberto com pagamento registrado', () => {
    expect(pagoParcialmente({ statusPagamento: 'EM_ABERTO', pagamentos: [{ valor: '50' }] })).toBe(
      true,
    )
  })
  it('pago ou sem pagamento não é parcial', () => {
    expect(pagoParcialmente({ statusPagamento: 'PAGO', pagamentos: [{ valor: 50 }] })).toBe(false)
    expect(pagoParcialmente({ statusPagamento: 'EM_ABERTO', pagamentos: [] })).toBe(false)
    expect(pagoParcialmente({ statusPagamento: 'VENCIDO' })).toBe(false)
  })
})

describe('statusPedidoVisivel', () => {
  it('alteração pendente aparece no lugar do status', () => {
    expect(statusPedidoVisivel({ status: 'APROVADO', aguardandoAlteracao: true }).label).toBe(
      'Aguardando alteração',
    )
    expect(statusPedidoVisivel({ status: 'EM_ENTREGA' }).label).toBe('A caminho')
    expect(statusPedidoVisivel({ status: 'NOVO' }).label).toBe('NOVO')
  })
})

describe('previewRateio', () => {
  it('divide frete e comissão pelo valor e fecha os centavos no último item', () => {
    const r = previewRateio(
      [
        { produtoId: 'a', quantidade: 1, valorProduto: 100 },
        { produtoId: 'b', quantidade: 2, valorProduto: 100 },
      ],
      10,
      0.01,
    )
    expect(r.map((i) => i.rateioFrete)).toEqual([3.33, 6.67])
    expect(r.reduce((acc, i) => acc + i.rateioComissao, 0)).toBeCloseTo(0.01)
    // 200 + 6,67 de frete + 0,01 de comissão (o centavo cai no último item)
    expect(r[1].custoTotal).toBe(206.68)
    expect(r[1].custoCaixa).toBe(103.34)
  })
  it('ignora linhas sem produto ou quantidade', () => {
    expect(previewRateio([{ produtoId: '', quantidade: 1, valorProduto: 1 }], 10, 0)).toEqual([])
  })
})

describe('valorPorExtenso (recibo)', () => {
  it('escreve reais e centavos', () => {
    expect(valorPorExtenso(1)).toBe('um real')
    expect(valorPorExtenso(0.01)).toBe('um centavo')
    expect(valorPorExtenso(100)).toBe('cem reais')
    expect(valorPorExtenso(115)).toBe('cento e quinze reais')
    expect(valorPorExtenso(1234.5)).toBe(
      'mil duzentos e trinta e quatro reais e cinquenta centavos',
    )
    expect(valorPorExtenso(2500)).toBe('dois mil e quinhentos reais')
    expect(valorPorExtenso(1020)).toBe('mil e vinte reais')
    expect(valorPorExtenso(1_200_000)).toBe('um milhão e duzentos mil reais')
    expect(valorPorExtenso(2_000_000)).toBe('dois milhões de reais')
  })
})

describe('rotasPermitidas', () => {
  it('supervisor e TV têm telas limitadas; admin não', () => {
    expect(rotasPermitidas('SUPERVISOR')).toContain('/pedidos')
    expect(rotasPermitidas('SUPERVISOR')).not.toContain('/usuarios')
    expect(rotasPermitidas('VISAO_GERAL')).toEqual(['/', '/metas'])
    expect(rotasPermitidas('ADMINISTRADOR')).toBeNull()
  })
})
