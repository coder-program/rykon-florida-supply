// Relatórios com a identidade visual da Flórida (mesmas cores e logo do recibo de venda):
// um PDF com cabeçalho, cartões de resumo e várias tabelas, ou um Excel com uma aba por tabela.
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import logoUrl from '../assets/recibo-logo.jpg'
import { carregarImagem } from './recibo'
import { formatBRL } from './utils'

export type RGB = [number, number, number]
export const VERDE: RGB = [16, 59, 40]
export const BEGE: RGB = [242, 225, 199]
export const VERDE_OK: RGB = [21, 128, 61]
export const VERMELHO: RGB = [185, 28, 28]
const EMPRESA = 'FLÓRIDA SUPPLY HORTIFRUTI LTDA'

export type Celula = string | number
export type SecaoRelatorio = {
  titulo: string
  headers: string[]
  linhas: Celula[][]
  totais?: Celula[]
  // Cor do texto por célula (mesma forma de `linhas`); undefined = cor padrão
  cores?: (RGB | undefined)[][]
  // Índices das colunas em R$: número vira "R$ 1.234,56" no PDF e formato moeda no Excel
  moeda?: number[]
}
export type Relatorio = {
  titulo: string
  subtitulo: string
  resumo?: { label: string; valor: string; cor?: RGB }[]
  secoes: SecaoRelatorio[]
  arquivo: string // sem extensão
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportarRelatorioPdf(r: Relatorio) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const largura = doc.internal.pageSize.getWidth()
  const logo = await carregarImagem(logoUrl)

  // Faixa verde do cabeçalho
  doc.setFillColor(...VERDE)
  doc.rect(0, 0, largura, 70, 'F')
  if (logo) doc.addImage(logo, 'JPEG', 30, 12, 82, 46)
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(r.titulo, logo ? 126 : 30, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(r.subtitulo, logo ? 126 : 30, 48)
  doc.text(EMPRESA, largura - 30, 32, { align: 'right' })
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, largura - 30, 48, { align: 'right' })

  let y = 88
  if (r.resumo?.length) {
    const porLinha = Math.min(4, r.resumo.length)
    const gap = 8
    const w = (largura - 60 - gap * (porLinha - 1)) / porLinha
    r.resumo.forEach((item, i) => {
      const x = 30 + (i % porLinha) * (w + gap)
      const yy = y + Math.floor(i / porLinha) * 48
      doc.setFillColor(...BEGE)
      doc.roundedRect(x, yy, w, 40, 4, 4, 'F')
      doc.setTextColor(...VERDE)
      doc.setFontSize(8)
      doc.text(item.label.toUpperCase(), x + 8, yy + 14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(...(item.cor ?? VERDE))
      doc.text(item.valor, x + 8, yy + 31)
      doc.setFont('helvetica', 'normal')
    })
    y += Math.ceil(r.resumo.length / porLinha) * 48 + 8
  }

  for (const s of r.secoes) {
    const fmt = (linha: Celula[]) =>
      linha.map((v, i) => (typeof v === 'number' && s.moeda?.includes(i) ? formatBRL(v) : v))
    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage()
      y = 40
    }
    doc.setTextColor(...VERDE)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(s.titulo, 30, y + 6)
    doc.setFont('helvetica', 'normal')
    autoTable(doc, {
      startY: y + 12,
      margin: { left: 30, right: 30 },
      head: [s.headers],
      body: s.linhas.length
        ? s.linhas.map(fmt)
        : [[{ content: 'Nenhum registro', colSpan: s.headers.length }]],
      foot: s.totais ? [fmt(s.totais)] : undefined,
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: VERDE, textColor: 255 },
      footStyles: { fillColor: BEGE, textColor: VERDE, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 246, 240] },
      didParseCell: (c) => {
        const cor = c.section === 'body' ? s.cores?.[c.row.index]?.[c.column.index] : undefined
        if (cor) c.cell.styles.textColor = cor
      },
    })
    y = (doc as any).lastAutoTable.finalY + 22
  }

  const paginas = doc.getNumberOfPages()
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`Página ${p} de ${paginas}`, largura - 30, doc.internal.pageSize.getHeight() - 16, {
      align: 'right',
    })
  }
  doc.save(`${r.arquivo}.pdf`)
}

const argb = ([r, g, b]: RGB) =>
  'FF' +
  [r, g, b]
    .map((n) => n.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()

export async function exportarRelatorioExcel(r: Relatorio) {
  const wb = new ExcelJS.Workbook()
  const nomes = new Set<string>()
  const aba = (nome: string) => {
    let n = nome.replace(/[\\/?*[\]:]/g, '').slice(0, 31)
    while (nomes.has(n)) n = n.slice(0, 29) + nomes.size
    nomes.add(n)
    return wb.addWorksheet(n)
  }
  const titulo = (ws: ExcelJS.Worksheet, colunas: number) => {
    ws.addRow([r.titulo]).font = { bold: true, size: 14, color: { argb: argb(VERDE) } }
    ws.addRow([`${EMPRESA} · ${r.subtitulo}`]).font = { color: { argb: 'FF666666' } }
    ws.addRow([])
    ws.getColumn(1).width = Math.max(ws.getColumn(1).width ?? 0, 22)
    for (let i = 2; i <= colunas; i++) ws.getColumn(i).width = 16
  }

  if (r.resumo?.length) {
    const ws = aba('Resumo')
    titulo(ws, 2)
    ws.getColumn(1).width = 38
    for (const item of r.resumo) ws.addRow([item.label, item.valor])
  }

  for (const s of r.secoes) {
    const ws = aba(s.titulo)
    titulo(ws, s.headers.length)
    const head = ws.addRow(s.headers)
    head.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(VERDE) } }
    })
    for (const i of s.moeda ?? []) ws.getColumn(i + 1).numFmt = '"R$" #,##0.00'
    s.linhas.forEach((linha, i) => {
      const row = ws.addRow(linha)
      s.cores?.[i]?.forEach((cor, j) => {
        if (cor) row.getCell(j + 1).font = { color: { argb: argb(cor) } }
      })
    })
    if (s.totais) {
      const foot = ws.addRow(s.totais)
      foot.eachCell((c) => {
        c.font = { bold: true, color: { argb: argb(VERDE) } }
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(BEGE) } }
      })
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  baixar(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `${r.arquivo}.xlsx`,
  )
}
