import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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

function carregarLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = '/logo.png'
  })
}

// Vencimento é gravado como meia-noite UTC: mostrar em UTC para não voltar um dia
function diaUTC(d: string | Date) {
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

/** Gera e baixa o recibo de venda do pedido (o detalhe vindo de GET /pedidos/:id) */
export async function baixarReciboVenda(p: any) {
  const doc = new jsPDF()
  const numero = String(p.numero ?? '').padStart(6, '0')
  const total = Number(p.totalFinal)
  const pago = (p.pagamentos ?? []).reduce((acc: number, pg: any) => acc + Number(pg.valor), 0)
  const largura = doc.internal.pageSize.getWidth()

  const logo = await carregarLogo()
  if (logo) doc.addImage(logo, 'PNG', 14, 10, 24, 24 * (logo.height / logo.width))
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text('RECIBO DE VENDA', largura - 14, 18, { align: 'right' })
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Pedido nº ${numero}`, largura - 14, 24, { align: 'right' })
  doc.text(`Data: ${formatDate(p.data)}`, largura - 14, 29, { align: 'right' })

  const cliente = p.cliente ?? {}
  let y = 44
  doc.setFont('helvetica', 'bold')
  doc.text('Cliente', 14, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text(cliente.razaoSocialOuNome ?? '', 14, y)
  if (cliente.cnpjCpf) {
    y += 5
    doc.text(`CNPJ/CPF: ${cliente.cnpjCpf}`, 14, y)
  }

  autoTable(doc, {
    startY: y + 6,
    head: [
      [
        'Produto',
        { content: 'Caixas', styles: { halign: 'center' } },
        { content: 'Preço por caixa', styles: { halign: 'right' } },
        { content: 'Total', styles: { halign: 'right' } },
      ],
    ],
    body: (p.itens ?? []).map((i: any) => [
      i.produto?.nome ?? '',
      String(Number(i.quantidade)),
      formatBRL(i.valorUnitario),
      formatBRL(i.valorTotal),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [22, 163, 74] },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  })

  y = (doc as any).lastAutoTable.finalY + 8
  const linhaValor = (rotulo: string, valor: string, negrito = false) => {
    doc.setFont('helvetica', negrito ? 'bold' : 'normal')
    doc.text(rotulo, largura - 64, y)
    doc.text(valor, largura - 14, y, { align: 'right' })
    y += 5
  }
  linhaValor('Subtotal', formatBRL(p.subtotal))
  if (Number(p.valorFrete)) linhaValor('Frete', formatBRL(p.valorFrete))
  if (Number(p.descontoValor)) linhaValor('Desconto', `- ${formatBRL(p.descontoValor)}`)
  linhaValor('Total', formatBRL(total), true)

  y += 4
  doc.setFont('helvetica', 'normal')
  const texto = `Recebemos de ${cliente.razaoSocialOuNome ?? ''} a importância de ${formatBRL(total)} (${valorPorExtenso(total)}), referente ao pedido nº ${numero}.`
  const linhas = doc.splitTextToSize(texto, largura - 28)
  doc.text(linhas, 14, y)
  y += linhas.length * 5 + 4

  const forma = FORMA_PAGAMENTO_LABEL[p.formaPagamento] ?? p.formaPagamento ?? ''
  doc.text(`Forma de pagamento: ${forma}`, 14, y)
  y += 5
  if (p.statusPagamento === 'PAGO') {
    const ultimo = p.pagamentos?.at(-1)?.data
    doc.text(`Situação: pago${ultimo ? ` em ${formatDate(ultimo)}` : ''}`, 14, y)
  } else {
    const saldo = Math.max(0, total - pago)
    const venc = p.dataVencimento ? `, vencimento ${diaUTC(p.dataVencimento)}` : ''
    const parcial = pago > 0 ? ` (já pago ${formatBRL(pago)})` : ''
    doc.text(`Situação: em aberto, saldo ${formatBRL(saldo)}${parcial}${venc}`, 14, y)
  }

  y += 30
  const meio = largura / 2
  doc.line(14, y, meio - 8, y)
  doc.line(meio + 8, y, largura - 14, y)
  doc.setFontSize(9)
  doc.text('Flórida Hortifruti', (14 + meio - 8) / 2, y + 5, { align: 'center' })
  doc.text('Assinatura do cliente', (meio + 8 + largura - 14) / 2, y + 5, { align: 'center' })

  doc.save(`recibo-pedido-${numero}.pdf`)
}
