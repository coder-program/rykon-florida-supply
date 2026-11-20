import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa } from '../test/api-falsa'
import { apiCompleta, pedido } from '../test/dados'
import { campo, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { RelatoriosPage } from './RelatoriosPage'

const pdf = vi.hoisted(() => ({ salvos: [] as string[], tabela: vi.fn(), excelFalha: false }))

vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize() {}
    setTextColor() {}
    text() {}
    save(nome: string) {
      pdf.salvos.push(nome)
    }
  },
}))
vi.mock('jspdf-autotable', () => ({ default: pdf.tabela }))
vi.mock('exceljs', () => ({
  default: {
    Workbook: class {
      xlsx = {
        writeBuffer: async () => {
          if (pdf.excelFalha) throw new Error('falhou')
          return new ArrayBuffer(1)
        },
      }
      addWorksheet() {
        return { columns: [], addRows: vi.fn() }
      }
    },
  },
}))

let fake: ReturnType<typeof apiFalsa>
let baixados: string[]
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
  pdf.salvos = []
  pdf.excelFalha = false
  baixados = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    baixados.push(this.download)
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const aba = (nome: string) =>
  fireEvent.click(screen.getByRole('button', { name: new RegExp(nome) }))
const menu = () => {
  fireEvent.click(screen.getByRole('button', { name: /Exportar/ }))
  return screen.getByRole('menu')
}
async function exportarTudo() {
  for (const formato of ['Excel', 'PDF', 'CSV', 'JSON', 'XML']) {
    fireEvent.click(within(menu()).getByRole('menuitem', { name: new RegExp(formato) }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  }
}

describe('Relatórios', () => {
  it('todas as abas com dados e exportação em todos os formatos', async () => {
    fake.quando('GET /relatorios/vendas', [
      pedido(),
      {
        id: 'x',
        numero: 2,
        data: '2026-11-10T12:00:00Z',
        formaPagamento: 'OUTRA',
        itens: [{ id: 'ix', produtoId: 'b' }],
      },
      { id: 'y', numero: 3, data: '2026-11-10T12:00:00Z' },
    ])
    fake.quando('GET /relatorios/estoque', [
      {
        produtoId: 'a',
        codigoInterno: 'M1',
        nome: 'Morango B3',
        categoria: 'Frutas',
        saldoAtual: 12,
        unidadeVenda: 'CX',
      },
      { produtoId: 'b' },
    ])
    fake.quando('GET /relatorios/vendas/por-produto', [
      {
        produto: 'Morango B3',
        codigoInterno: 'M1',
        quantidadeVendida: 40,
        faturamento: 1080,
        precoMedioVenda: 27,
      },
      {},
    ])
    fake.quando('GET /relatorios/vendas/por-vendedor', [
      { vendedor: 'Cesar', totalPedidos: 3, totalVendido: 354 },
      {},
    ])
    fake.quando('GET /relatorios/financeiro', {
      pagos: { total: 500, quantidade: 3 },
      emAberto: {},
      vencidos: { total: 50, quantidade: 1 },
    })
    renderTela(<RelatoriosPage />)

    expect(await screen.findByText('#000181')).toBeTruthy()
    expect(screen.getByText(/3 registros · Todo o período/)).toBeTruthy()
    expect(screen.getByText('OUTRA')).toBeTruthy()
    const m = menu()
    expect(within(m).getByText('Exportar pedidos e vendas')).toBeTruthy()
    fireEvent.keyDown(document, { key: 'a' })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    menu()
    fireEvent.mouseDown(screen.getByRole('menu'))
    expect(screen.getByRole('menu')).toBeTruthy()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
    await exportarTudo()
    expect(baixados.map((n) => n.split('.').pop())).toEqual(['xlsx', 'csv', 'json', 'xml'])
    expect(pdf.salvos[0]).toMatch(/^relatorio-vendas-.*\.pdf$/)

    aba('Itens vendidos')
    expect((await screen.findAllByText('4 cx')).length).toBe(2)
    expect(screen.getAllByText(/R\$\s108,00/).length).toBeGreaterThan(1)
    await exportarTudo()

    aba('Estoque')
    expect(await screen.findByText('Frutas')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(within(menu()).getByText(/2 registros desta tela/)).toBeTruthy()
    fireEvent.keyDown(document, { key: 'Escape' })
    await exportarTudo()

    aba('Por Produto')
    expect(await screen.findByText('40 cx')).toBeTruthy()
    await exportarTudo()

    aba('Por Vendedor')
    expect(await screen.findByText('Cesar', { selector: 'td' })).toBeTruthy()
    await exportarTudo()

    aba('Financeiro')
    expect(await screen.findByText('Recebidos (pagos)')).toBeTruthy()
    expect(screen.getByText('3 pedido(s)')).toBeTruthy()
    await exportarTudo()
    expect(pdf.tabela).toHaveBeenCalledTimes(6)
  })

  it('filtros, resumo, limpar e itens filtrados por produto', async () => {
    renderTela(<RelatoriosPage />)
    await screen.findByText('#000181')
    await waitFor(() =>
      expect(campo('Vendedor').querySelectorAll('option').length).toBeGreaterThan(1),
    )
    preencher('Data início', '2026-11-01')
    expect(await screen.findByText(/01\/11\/2026 — hoje/)).toBeTruthy()
    preencher('Data início', '')
    preencher('Data fim', '2026-11-30')
    expect(await screen.findByText(/início — 30\/11\/2026/)).toBeTruthy()
    preencher('Status do pedido', 'APROVADO')
    preencher('Status do pagamento', 'PAGO')
    preencher('Vendedor', 'v1')
    preencher('Produto', 'b')
    expect(await screen.findByText(/Aprovado · Pago · Cesar · Uva Vitória/)).toBeTruthy()
    await waitFor(() =>
      expect(fake.feitas('GET', '/relatorios/vendas').at(-1)?.params).toEqual({
        dataInicio: undefined,
        dataFim: '2026-11-30',
        status: 'APROVADO',
        statusPagamento: 'PAGO',
        vendedorId: 'v1',
        produtoId: 'b',
      }),
    )
    aba('Itens vendidos')
    expect(await screen.findByText('Nenhum dado no período')).toBeTruthy()
    expect((screen.getByRole('button', { name: /Exportar/ }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    preencher('Produto', 'a')
    expect((await screen.findAllByText('4 cx')).length).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }))
    expect(await screen.findByText(/Todo o período$/)).toBeTruthy()
  })

  it('listas vazias, financeiro sem dados e erro ao gerar', async () => {
    for (const rota of [
      'GET /relatorios/vendas',
      'GET /relatorios/estoque',
      'GET /relatorios/vendas/por-produto',
      'GET /relatorios/vendas/por-vendedor',
    ]) {
      fake.quando(rota, [])
    }
    fake.quando('GET /relatorios/financeiro', null)
    renderTela(<RelatoriosPage />)
    expect(await screen.findByText('Nenhum dado no período')).toBeTruthy()
    for (const nome of ['Estoque', 'Por Produto', 'Por Vendedor', 'Financeiro']) {
      aba(nome)
      expect(await screen.findByText('Nenhum dado no período')).toBeTruthy()
    }
    cleanup()

    pdf.excelFalha = true
    fake.quando('GET /relatorios/vendas/por-vendedor', [
      { vendedor: 'Cesar', totalPedidos: 1, totalVendido: 1 },
    ])
    renderTela(<RelatoriosPage />)
    aba('Por Vendedor')
    await screen.findByText(/1 registro ·/)
    fireEvent.click(within(menu()).getByRole('menuitem', { name: /Excel/ }))
    expect(await screen.findByText('Não foi possível gerar o arquivo.')).toBeTruthy()
  })

  it('usuário sem financeiro não busca vendedores', async () => {
    logar({ id: 'v1', nome: 'Cesar', email: 'c@x', papel: 'SUPERVISOR' })
    renderTela(<RelatoriosPage />)
    await screen.findByText('#000181')
    expect(fake.feitas('GET', '/usuarios')).toHaveLength(0)
  })
})
