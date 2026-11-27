import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoUrl from '../assets/recibo-logo.jpg'
import morangosUrl from '../assets/recibo-morangos.png'
import { FORMA_PAGAMENTO_LABEL, formatBRL, formatDate } from './utils'

const UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove']
const DEZ_A_DEZENOVE = [
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
]
const DEZENAS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
]
const CENTENAS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
]

// 0 a 999
function ate999(n: number): string {
  if (n === 100) return 'cem'
  const c = Math.floor(n / 100)
  const resto = n % 100
  const partes = [CENTENAS[c]]
  if (resto >= 10 && resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10])
  else partes.push(DEZENAS[Math.floor(resto / 10)], UNIDADES[resto % 10])
  return partes.filter(Boolean).join(' e ')
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'zero'
  const milhoes = Math.floor(n / 1_000_000)
  const milhares = Math.floor((n % 1_000_000) / 1000)
  const resto = n % 1000
  const grupos: [number, string][] = []
  if (milhoes) grupos.push([milhoes, milhoes === 1 ? 'um milhão' : `${ate999(milhoes)} milhões`])
  if (milhares) grupos.push([milhares, milhares === 1 ? 'mil' : `${ate999(milhares)} mil`])
  if (resto) grupos.push([resto, ate999(resto)])
  if (grupos.length === 1) return grupos[0][1]
  // "e" antes do último grupo quando ele é < 100 ou centena redonda (mil e cem, mil e vinte)
  const [valorUltimo, ultimo] = grupos.at(-1)!
  const usaE = valorUltimo < 100 || valorUltimo % 100 === 0
  const antes = grupos
    .slice(0, -1)
    .map((g) => g[1])
    .join(' ')
  return `${antes}${usaE ? ' e' : ''} ${ultimo}`
}

/** 1234.5 → "mil, duzentos e trinta e quatro reais e cinquenta centavos" */
export function valorPorExtenso(valor: number): string {
  const centavosTotais = Math.round(valor * 100)
  const reais = Math.floor(centavosTotais / 100)
  const centavos = centavosTotais % 100
  const partes: string[] = []
  if (reais || !centavos) {
    // "um milhão de reais", "dois milhões de reais"
    const de = reais >= 1_000_000 && reais % 1_000_000 === 0 ? ' de' : ''
    partes.push(`${inteiroPorExtenso(reais)}${de} ${reais === 1 ? 'real' : 'reais'}`)
  }
  if (centavos)
    partes.push(`${inteiroPorExtenso(centavos)} ${centavos === 1 ? 'centavo' : 'centavos'}`)
  return partes.join(' e ')
}

export function carregarImagem(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Vencimento é gravado como meia-noite UTC: mostrar em UTC para não voltar um dia
function diaUTC(d: string | Date) {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

// Identidade visual da Flórida (tons tirados do modelo "RECIBO DE VENDA - MODELO.pdf")
type RGB = [number, number, number]
const VERDE: RGB = [16, 59, 40]
const BEGE: RGB = [242, 225, 199]
const OLIVA: RGB = [110, 112, 18]
const CINZA: RGB = [99, 114, 103]
const LINHA: RGB = [227, 232, 224]
const BRANCO: RGB = [255, 255, 255]
const EMPRESA = 'FLÓRIDA SUPPLY HORTIFRUTI LTDA'
// A4 em pontos; o conteúdo fica dentro de um cartão branco sobre fundo bege
const ESQ = 50
const DIR = 545
const LARG = DIR - ESQ
const FIM = 780

/** Gera e baixa o recibo de venda do pedido (o detalhe vindo de GET /pedidos/:id) */
export async function baixarReciboVenda(p: any) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const numero = String(p.numero ?? '').padStart(6, '0')
  const total = Number(p.totalFinal)
  const pago = (p.pagamentos ?? []).reduce((acc: number, pg: any) => acc + Number(pg.valor), 0)
  const cliente = p.cliente ?? {}
  const nome = cliente.razaoSocialOuNome ?? ''
  const [logo, morangos] = await Promise.all([carregarImagem(logoUrl), carregarImagem(morangosUrl)])

  const escrever = (
    t: string | string[],
    x: number,
    y: number,
    o: { tam?: number; negrito?: boolean; cor?: RGB; align?: 'center' | 'right' } = {},
  ) => {
    doc.setFont('helvetica', o.negrito ? 'bold' : 'normal')
    doc.setFontSize(o.tam ?? 10)
    doc.setTextColor(...(o.cor ?? VERDE))
    doc.text(t, x, y, o.align ? { align: o.align } : {})
  }
  const fundo = () => {
    doc.setFillColor(...BEGE)
    doc.rect(0, 0, 595, 842, 'F')
    doc.setFillColor(...BRANCO)
    doc.roundedRect(30, 47, 535, 750, 20, 20, 'F')
  }
  const linha = (y: number) => {
    doc.setDrawColor(...LINHA)
    doc.setLineWidth(0.75)
    doc.line(ESQ, y, DIR, y)
  }
  let y = 0
  // Bloco que não cabe no cartão vai para a página seguinte
  const espaco = (h: number, limite = FIM) => {
    if (y + h <= limite) return
    doc.addPage()
    fundo()
    y = 75
  }

  // Cabeçalho verde com a logo no quadrado bege e o número do pedido
  fundo()
  doc.setFillColor(...VERDE)
  doc.roundedRect(30, 47, 535, 151, 20, 20, 'F')
  doc.rect(30, 163, 535, 35, 'F')
  doc.setFillColor(...BEGE)
  doc.roundedRect(49, 62, 107, 99, 10, 10, 'F')
  if (logo) doc.addImage(logo, 'JPEG', 55, 85.5, 95, 52)
  escrever('RECIBO DE VENDA', 170, 145, { tam: 18, negrito: true, cor: BRANCO })
  escrever(EMPRESA, 170, 162, { tam: 9, cor: [215, 232, 220] })
  doc.setFillColor(...BRANCO)
  doc.roundedRect(420, 63, 123, 45, 8, 8, 'F')
  escrever('PEDIDO', 481.5, 83, { tam: 11, negrito: true, align: 'center' })
  escrever(`Nº ${numero}`, 481.5, 101, { tam: 15, negrito: true, align: 'center' })

  // Dados do pedido
  escrever('DADOS DO PEDIDO', ESQ, 223, { tam: 11, negrito: true })
  linha(234)
  if (morangos) doc.addImage(morangos, 'PNG', 410, 186, 137, 92)
  escrever('CLIENTE', ESQ, 255, { tam: 8, negrito: true, cor: CINZA })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  const nomeLinhas: string[] = doc.splitTextToSize(nome, 350)
  escrever(nomeLinhas, ESQ, 275, { tam: 13, negrito: true })
  y = 275 + (nomeLinhas.length - 1) * 15
  const campo = (rotulo: string, valor: string, x: number) => {
    escrever(rotulo, x, y + 22, { tam: 8, negrito: true, cor: CINZA })
    escrever(valor, x, y + 39, { tam: 11 })
  }
  campo('DATA DO PEDIDO', formatDate(p.data), ESQ)
  campo(
    'FORMA DE PAGAMENTO',
    FORMA_PAGAMENTO_LABEL[p.formaPagamento] ?? p.formaPagamento ?? '',
    220,
  )
  if (cliente.cnpjCpf) campo('CNPJ/CPF', cliente.cnpjCpf, 390)
  escrever('PRODUTOS', ESQ, y + 71, { tam: 11, negrito: true })

  // Produtos: a tabela quebra página sozinha e repete o cabeçalho
  const padding = { top: 14, bottom: 14, left: 12, right: 12 }
  autoTable(doc, {
    startY: y + 87,
    margin: { left: ESQ, right: 595 - DIR, top: 75, bottom: 842 - FIM },
    theme: 'plain',
    head: [
      ['DESCRIÇÃO', { content: 'CAIXAS', styles: { halign: 'center' } }, 'VALOR UNIT.', 'TOTAL'],
    ],
    body: (p.itens ?? []).map((i: any) => [
      i.produto?.nome ?? '',
      String(Number(i.quantidade)),
      formatBRL(i.valorUnitario),
      formatBRL(i.valorTotal),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 10,
      textColor: VERDE,
      cellPadding: padding,
      lineColor: LINHA,
      lineWidth: { bottom: 0.75 },
    },
    headStyles: {
      fontSize: 8,
      fontStyle: 'bold',
      textColor: BRANCO,
      cellPadding: { ...padding, top: 10, bottom: 10 },
      lineWidth: 0,
    },
    columnStyles: {
      0: { fontStyle: 'bold', fontSize: 11 },
      1: { halign: 'center', cellWidth: 70, fontSize: 11 },
      2: { cellWidth: 110 },
      3: { cellWidth: 95, fontStyle: 'bold' },
    },
    willDrawPage: (d) => {
      if (d.pageNumber > 1) fundo()
    },
    // Faixa verde arredondada atrás da linha de títulos
    willDrawCell: (d) => {
      if (d.section !== 'head' || d.column.index !== 0) return
      doc.setFillColor(...VERDE)
      doc.roundedRect(ESQ, d.cell.y, LARG, d.cell.height, 6, 6, 'F')
    },
  })

  // Resumo financeiro
  y = (doc as any).lastAutoTable.finalY + 12
  const resumo = (rotulo: string, valor: string) => {
    espaco(20)
    escrever(rotulo, 342, y + 14, { cor: CINZA })
    escrever(valor, 470, y + 14, { negrito: true })
    y += 20
  }
  resumo('Subtotal', formatBRL(p.subtotal))
  if (Number(p.valorFrete)) resumo('Taxa de entrega', formatBRL(p.valorFrete))
  if (Number(p.descontoValor)) resumo('Desconto', `- ${formatBRL(p.descontoValor)}`)
  y += 10
  espaco(54)
  doc.setFillColor(...BEGE)
  doc.roundedRect(ESQ, y, LARG, 54, 8, 8, 'F')
  escrever('TOTAL DO PEDIDO', 66, y + 22, { tam: 9, negrito: true })
  escrever('Valor total da compra', 66, y + 42, { tam: 9, cor: CINZA })
  escrever(formatBRL(total), 485, y + 34, { tam: 18, negrito: true, align: 'right' })
  y += 54

  // Situação financeira: pago, ou em aberto com saldo e vencimento
  espaco(77)
  escrever('SITUAÇÃO FINANCEIRA', ESQ, y + 28, { negrito: true })
  const quitado = p.statusPagamento === 'PAGO'
  doc.setFillColor(...((quitado ? [244, 243, 222] : [255, 244, 230]) as RGB))
  doc.roundedRect(ESQ, y + 40, LARG, 37, 6, 6, 'F')
  const base = y + 63
  if (quitado) {
    const ultimo = p.pagamentos?.at(-1)?.data
    escrever('PAGO', 62, base, { negrito: true, cor: OLIVA })
    escrever(`Valor pago: ${formatBRL(total)}`, 190, base)
    if (ultimo) escrever(`Pago em ${formatDate(ultimo)}`, 365, base)
  } else {
    const saldo = Math.max(0, total - pago)
    const parcial = pago > 0 ? ` (pago ${formatBRL(pago)})` : ''
    escrever('EM ABERTO', 62, base, { negrito: true, cor: [167, 93, 18] })
    escrever(`Saldo: ${formatBRL(saldo)}${parcial}`, 190, base)
    if (p.dataVencimento) escrever(`Venc.: ${diaUTC(p.dataVencimento)}`, 365, base)
  }
  y += 77

  // Observação + rodapé (empresa e assinaturas) ficam juntos na mesma página
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const obs: string[] = [
    `Documento referente ao pedido nº ${numero}.`,
    ...(quitado
      ? doc.splitTextToSize(
          `Recebemos de ${nome} a importância de ${formatBRL(total)} (${valorPorExtenso(total)}).`,
          LARG,
        )
      : ['Este comprovante não confirma o recebimento do pagamento.']),
  ]
  // o último bloco pode descer até a borda do cartão (797)
  espaco(26 + (obs.length - 1) * 12 + 90, 792)
  obs.forEach((t, i) => escrever(t, ESQ, y + 26 + i * 12, { tam: 9, cor: CINZA }))
  y += 26 + (obs.length - 1) * 12 + 16
  linha(y)
  escrever(EMPRESA, ESQ, y + 18, { negrito: true })
  escrever('CNPJ: 50.295.992/0001-08', ESQ, y + 32, { tam: 9, cor: CINZA })
  escrever('Barueri - SP', ESQ, y + 45, { tam: 9, cor: CINZA })
  escrever('Obrigado pela preferência!', ESQ, y + 70, { negrito: true })
  doc.setDrawColor(...VERDE)
  doc.setLineWidth(0.5)
  doc.line(300, y + 56, 415, y + 56)
  doc.line(430, y + 56, DIR, y + 56)
  escrever('Flórida Supply', 357.5, y + 67, { tam: 8, cor: CINZA, align: 'center' })
  escrever('Assinatura do cliente', 487.5, y + 67, { tam: 8, cor: CINZA, align: 'center' })

  doc.save(`recibo-pedido-${numero}.pdf`)
}
