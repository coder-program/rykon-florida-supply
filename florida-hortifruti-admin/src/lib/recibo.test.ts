import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// PDF simulado: guarda os textos escritos, imagens, páginas e o nome do arquivo salvo
const pdf = vi.hoisted(() => ({
  textos: [] as string[],
  salvo: '',
  imagens: 0,
  paginas: 1,
  finalY: 450,
  tabela: [] as unknown[],
}))
vi.mock('jspdf', () => ({
  jsPDF: class {
    lastAutoTable = { finalY: pdf.finalY }
    // métodos de desenho (cores, retângulos, linhas) não importam para o teste
    constructor() {
      return new Proxy(this, { get: (t: any, k) => (k in t ? t[k] : () => {}) })
    }
    addImage() {
      pdf.imagens++
    }
    addPage() {
      pdf.paginas++
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
  default: (_doc: unknown, opcoes: any) => {
    pdf.tabela = opcoes.body
    // exercita os ganchos: página nova da tabela e faixa do cabeçalho
    opcoes.willDrawPage({ pageNumber: 1 })
    opcoes.willDrawPage({ pageNumber: 2 })
    opcoes.willDrawCell({ section: 'head', column: { index: 0 }, cell: { y: 0, height: 20 } })
    opcoes.willDrawCell({ section: 'body', column: { index: 0 }, cell: { y: 0, height: 20 } })
  },
}))

import { baixarReciboVenda, valorPorExtenso } from './recibo'

// As imagens (logo e morangos): o teste decide se carregam ou falham
let imagemCarrega = true
class ImagemFalsa {
  width = 100
  height = 50
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_: string) {
    setTimeout(() => (imagemCarrega ? this.onload?.() : this.onerror?.()))
  }
}

beforeEach(() => {
  pdf.textos = []
  pdf.salvo = ''
  pdf.imagens = 0
  pdf.paginas = 1
  pdf.finalY = 437 // fim real da tabela com 1 item
  vi.stubGlobal('Image', ImagemFalsa)
})
afterEach(() => vi.unstubAllGlobals())

const texto = () => pdf.textos.join('\n')

describe('baixarReciboVenda', () => {
  it('pedido pago com taxa de entrega, desconto e imagens', async () => {
    imagemCarrega = true
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
    expect(pdf.imagens).toBe(2)
    expect(pdf.paginas).toBe(1)
    expect(texto()).toContain('RECIBO DE VENDA')
    expect(texto()).toContain('Nº 000181')
    expect(texto()).toContain('11.222.333/0001-81')
    expect(texto()).toContain('Taxa de entrega')
    expect(texto()).toContain('Desconto')
    expect(texto()).toContain('cento e dezoito reais')
    expect(texto()).toContain('Pix')
    expect(texto()).toContain('PAGO')
    expect(texto()).toMatch(/Pago em \d{2}\/\d{2}\/2026/)
    expect(texto()).toContain('Assinatura do cliente')
    expect(pdf.tabela[1]).toEqual(['', '1', expect.any(String), expect.any(String)])
  })

  it('em aberto, parcial, sem imagens e dados mínimos', async () => {
    imagemCarrega = false
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
    expect(texto()).not.toContain('Taxa de entrega')
    expect(texto()).not.toContain('CNPJ/CPF')
    expect(texto()).toContain('OUTRA')
    expect(texto()).toContain('EM ABERTO')
    expect(texto()).toContain('não confirma o recebimento')
    expect(texto()).toMatch(/Saldo: R\$\s70,00 \(pago R\$\s30,00\)/)
    // vencimento gravado à meia-noite UTC não pode voltar um dia
    expect(texto()).toContain('Venc.: 20/11/2026')
  })

  it('pago sem data, sem forma e sem número', async () => {
    await baixarReciboVenda({
      data: '2026-11-10',
      totalFinal: 0,
      subtotal: 0,
      statusPagamento: 'PAGO',
    })
    expect(pdf.salvo).toBe('recibo-pedido-000000.pdf')
    expect(texto()).toContain('PAGO')
    expect(texto()).not.toContain('Pago em')
    await baixarReciboVenda({
      numero: 1,
      data: '2026-11-10',
      totalFinal: 10,
      subtotal: 10,
      statusPagamento: 'EM_ABERTO',
    })
    expect(texto()).toMatch(/^Saldo: R\$\s10,00$/m)
    expect(texto()).not.toContain('Venc.')
  })

  it('pedido longo: bloco que não cabe vai para a página seguinte', async () => {
    pdf.finalY = 760
    await baixarReciboVenda({
      numero: 2,
      data: '2026-11-10',
      totalFinal: 15,
      subtotal: 10,
      valorFrete: 5,
      statusPagamento: 'EM_ABERTO',
    })
    expect(pdf.paginas).toBeGreaterThan(1)
    expect(texto()).toContain('Obrigado pela preferência!')
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
