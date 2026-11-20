import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa } from '../test/api-falsa'
import { apiCompleta, pedido } from '../test/dados'
import { logar, renderTela } from '../test/render'
import { FinanceiroPage } from './FinanceiroPage'

const doc = vi.hoisted(() => ({ salvos: [] as string[], tabela: vi.fn() }))
vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize() {}
    text() {}
    save(nome: string) {
      doc.salvos.push(nome)
    }
  },
}))
vi.mock('jspdf-autotable', () => ({ default: doc.tabela }))
vi.mock('exceljs', () => ({
  default: {
    Workbook: class {
      xlsx = { writeBuffer: async () => new ArrayBuffer(1) }
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
  doc.salvos = []
  doc.tabela.mockClear()
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

const linhas = () =>
  screen.queryAllByText(/^#0001\d\d$/, { selector: 'p.font-mono' }).map((p) => p.textContent)
const combos = () => screen.getAllByRole('combobox')

describe('Financeiro', () => {
  it('lista, detalhes, busca, filtros, exportação e reabrir', async () => {
    fake.quando('POST /financeiro/reabrir/:id', {})
    renderTela(<FinanceiroPage />)
    expect(await screen.findByText('Recebido (Este mês)')).toBeTruthy()
    await waitFor(() => expect(linhas()).toEqual(['#000181', '#000182', '#000183']))
    expect(screen.getByText('3 registro(s)')).toBeTruthy()
    expect(screen.getAllByText('Pago parcialmente').length).toBeGreaterThan(1)
    expect(screen.getAllByText('A vencer (7d)').length).toBeGreaterThan(1)

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0])
    expect(screen.getByText('"Enviar recibo"')).toBeTruthy()
    expect(screen.getByText('✅ Sim')).toBeTruthy()
    expect(screen.getByText('(11) 99999-8888')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar detalhes' }))
    expect(screen.queryByText('"Enviar recibo"')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Excel/ }))
    await waitFor(() => expect(baixados[0]).toMatch(/^financeiro-.*\.xlsx$/))
    fireEvent.click(screen.getByRole('button', { name: /PDF/ }))
    expect(doc.salvos[0]).toMatch(/\.pdf$/)
    expect(doc.tabela.mock.calls[0][1].body[2][5]).toBe('Vencido (pago parcialmente)')

    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    fireEvent.click(screen.getAllByRole('button', { name: 'Reabrir' })[0])
    expect(fake.feitas('POST', '/financeiro/reabrir/p2')).toHaveLength(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Reabrir' })[1])
    await waitFor(() => expect(fake.feitas('POST', '/financeiro/reabrir/p2')).toHaveLength(1))
    fireEvent.click(screen.getAllByRole('button', { name: 'Reabrir' })[0])
    await waitFor(() => expect(fake.feitas('POST', '/financeiro/reabrir/p2')).toHaveLength(2))
    expect(confirmar).toHaveBeenCalledTimes(3)

    fireEvent.click(screen.getAllByRole('button', { name: 'Pago' })[0])
    expect(
      await screen.findByText(/Registrar pagamento · #000181/, { selector: 'h2' }),
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Pago' }).at(-1)!)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    const busca = screen.getByLabelText('Pesquisar')
    fireEvent.change(busca, { target: { value: ' VALE ' } })
    expect(linhas()).toHaveLength(3)
    fireEvent.change(busca, { target: { value: '000182' } })
    expect(linhas()).toEqual(['#000182'])
    fireEvent.change(busca, { target: { value: 'ninguém' } })
    expect(screen.getAllByText('Nenhuma conta encontrada')).toHaveLength(2)
    expect((screen.getByRole('button', { name: /Excel/ }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(busca, { target: { value: '' } })

    fireEvent.change(combos()[0], { target: { value: 'Cesar' } })
    expect(linhas()).toHaveLength(3)
    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '2026-11-25' } })
    expect(linhas()).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText('Vencimento até'), { target: { value: '2026-11-10' } })
    expect(linhas()).toHaveLength(0)
    fireEvent.change(screen.getByLabelText('Vencimento até'), { target: { value: '2026-11-30' } })
    expect(linhas()).toHaveLength(3)

    fireEvent.change(combos()[1], { target: { value: 'VENCIDO' } })
    fireEvent.change(combos()[2], { target: { value: 'PIX' } })
    await waitFor(() =>
      expect(fake.feitas('GET', '/financeiro/contas-a-receber').at(-1)?.params).toEqual({
        situacao: 'VENCIDO',
        formaPagamento: 'PIX',
      }),
    )
    for (const nome of ['Hoje', 'Últimos 7d', 'Últimos 30d']) {
      fireEvent.click(screen.getByRole('button', { name: nome }))
      expect(await screen.findByText(`Recebido (${nome})`)).toBeTruthy()
    }
  })

  it('contas incompletas, supervisor e resumo vazio', async () => {
    logar({ id: 'v1', nome: 'Cesar', email: 'c@x', papel: 'SUPERVISOR' })
    fake.quando('GET /financeiro/resumo', {})
    fake.quando('GET /financeiro/contas-a-receber', [
      {
        ...pedido({
          id: 'q1',
          numero: 190,
          statusPagamento: 'PAGO',
          descontoValor: 5,
          valorFrete: 0,
          necessitaNF: false,
          condicaoNegociada: '2x',
          observacoes: null,
          cliente: { razaoSocialOuNome: 'Sem fantasia', telefone: null },
        }),
        situacaoCalculada: 'PAGO',
      },
      {
        id: 'q2',
        numero: undefined,
        situacaoCalculada: 'ESTRANHA',
        formaPagamento: 'OUTRA',
        totalFinal: 7,
        data: '2026-11-10T00:00:00Z',
        dataVencimento: null,
        vendedor: null,
      },
    ])
    renderTela(<FinanceiroPage />)
    expect(await screen.findByText('Sem fantasia', { selector: 'p.font-medium' })).toBeTruthy()
    expect(screen.getAllByText('0 pedido(s)')).toHaveLength(4)
    expect(screen.getAllByText('OUTRA').length).toBe(2)
    expect(screen.getByText('—')).toBeTruthy()
    // Supervisor: no celular não aparece reabrir; na tabela continua
    expect(screen.getAllByRole('button', { name: 'Reabrir' })).toHaveLength(1)
    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[0])
    expect(screen.getByText('2x')).toBeTruthy()
    expect(screen.getByText('Não')).toBeTruthy()
    expect(screen.queryByText(/Frete:/)).toBeNull()
    expect(screen.getByText(/Desconto:/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '2026-11-01' } })
    expect(linhas()).toEqual(['#000190'])
    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Vencimento até'), { target: { value: '2026-11-30' } })
    expect(linhas()).toEqual(['#000190'])
    fireEvent.change(screen.getByLabelText('Vencimento até'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: '190' } })
    expect(linhas()).toEqual(['#000190'])

    fireEvent.click(screen.getByRole('button', { name: /PDF/ }))
    fireEvent.click(screen.getByRole('button', { name: /Excel/ }))
    await waitFor(() => expect(baixados).toHaveLength(1))
    fireEvent.change(screen.getByLabelText('Pesquisar'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /PDF/ }))
    const corpo = doc.tabela.mock.calls[1][1].body
    expect(corpo[1].slice(0, 6)).toEqual(['#000000', '', '', 'OUTRA', '', 'ESTRANHA'])
  })
})
