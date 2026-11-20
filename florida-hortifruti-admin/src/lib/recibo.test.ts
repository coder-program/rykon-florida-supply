import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PDF simulado: guarda os textos escritos e o nome do arquivo salvo
const pdf = vi.hoisted(() => ({
  textos: [] as string[],
  salvo: '',
  imagens: 0,
  tabela: [] as unknown[],
}))
vi.mock('jspdf', () => ({
  jsPDF: class {
    internal = { pageSize: { getWidth: () => 210 } }
    lastAutoTable = { finalY: 100 }
    setFontSize() {}
    setFont() {}
    line() {}
    addImage() {
      pdf.imagens++
    }
    text(t: string | string[]) {
      pdf.textos.push(...([] as string[]).concat(t))
    }
    splitTextToSize(t: string) {
      return [t]
    }
    save(nome: string) {
      pdf.salvo = nome
    }
  },
}))
vi.mock('jspdf-autotable', () => ({
  default: (_doc: unknown, opcoes: { body: unknown[] }) => {
    pdf.tabela = opcoes.body
  },
}))

import { baixarReciboVenda, valorPorExtenso } from './recibo'

// O logo é uma imagem: o teste decide se carrega ou falha
let logoCarrega = true
class ImagemFalsa {
  width = 100
  height = 50
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_: string) {
    setTimeout(() => (logoCarrega ? this.onload?.() : this.onerror?.()))
  }
}

beforeEach(() => {
  pdf.textos = []
  pdf.salvo = ''
  pdf.imagens = 0
  vi.stubGlobal('Image', ImagemFalsa)
})
afterEach(() => vi.unstubAllGlobals())

const texto = () => pdf.textos.join('\n')

describe('baixarReciboVenda', () => {
  it('pedido pago com frete, desconto e logo', async () => {
    logoCarrega = true
    await baixarReciboVenda({
      numero: 181,
      data: '2026-11-10T15:00:00Z',
      totalFinal: 118,
      subtotal: 108,
      valorFrete: 15,
      descontoValor: 5,
      formaPagamento: 'PIX',
      statusPagamento: 'PAGO',
      cliente: { razaoSocialOuNome: 'Mercado Vale Verde', cnpjCpf: '11.222.333/0001-81' },
      itens: [
        { produto: { nome: 'Morango B3' }, quantidade: 4, valorUnitario: 27, valorTotal: 108 },
        { quantidade: 1, valorUnitario: 1, valorTotal: 1 },
      ],
      pagamentos: [{ valor: 118, data: '2026-11-12T12:00:00Z' }],
    })
    expect(pdf.salvo).toBe('recibo-pedido-000181.pdf')
    expect(pdf.imagens).toBe(1)
    expect(texto()).toContain('CNPJ/CPF: 11.222.333/0001-81')
    expect(texto()).toContain('Frete')
    expect(texto()).toContain('Desconto')
    expect(texto()).toContain('cento e dezoito reais')
    expect(texto()).toContain('Forma de pagamento: Pix')
    expect(texto()).toMatch(/Situação: pago em \d{2}\/\d{2}\/2026/)
    expect(pdf.tabela[1]).toEqual(['', '1', expect.any(String), expect.any(String)])
  })

  it('em aberto, parcial, sem logo e dados mínimos', async () => {
    logoCarrega = false
    await baixarReciboVenda({
      numero: 7,
      data: '2026-11-10T15:00:00Z',
      totalFinal: 100,
      subtotal: 100,
      valorFrete: 0,
      descontoValor: 0,
      formaPagamento: 'OUTRA',
      statusPagamento: 'EM_ABERTO',
      dataVencimento: '2026-11-20T00:00:00Z',
      pagamentos: [{ valor: 30 }],
    })
    expect(pdf.imagens).toBe(0)
    expect(texto()).not.toContain('Frete')
    expect(texto()).not.toContain('CNPJ')
    expect(texto()).toContain('Forma de pagamento: OUTRA')
    // vencimento gravado à meia-noite UTC não pode voltar um dia
    expect(texto()).toMatch(
      /em aberto, saldo R\$\s70,00 \(já pago R\$\s30,00\), vencimento 20\/11\/2026/,
    )
  })

  it('pago sem data, sem forma e sem número', async () => {
    await baixarReciboVenda({
      data: '2026-11-10',
      totalFinal: 0,
      subtotal: 0,
      statusPagamento: 'PAGO',
    })
    expect(pdf.salvo).toBe('recibo-pedido-000000.pdf')
    expect(texto()).toContain('Situação: pago\n')
    expect(texto()).toContain('Forma de pagamento: ')
    await baixarReciboVenda({
      numero: 1,
      data: '2026-11-10',
      totalFinal: 10,
      subtotal: 10,
      statusPagamento: 'EM_ABERTO',
    })
    expect(texto()).toMatch(/em aberto, saldo R\$\s10,00$/m)
  })
})

describe('valorPorExtenso', () => {
  it('zero, dezenas e milhares redondos', () => {
    expect(valorPorExtenso(0)).toBe('zero reais')
    expect(valorPorExtenso(13.45)).toBe('treze reais e quarenta e cinco centavos')
    expect(valorPorExtenso(1100)).toBe('mil e cem reais')
    expect(valorPorExtenso(3_000_001)).toBe('três milhões e um reais')
  })
})
