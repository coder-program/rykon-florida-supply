import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { EstoquePage } from './EstoquePage'
import { EditarEntradaModal } from '../components/EditarEntradaModal'
import { FornecedorSelect } from '../components/FornecedorSelect'

const pdf = vi.hoisted(() => ({
  save: vi.fn(),
  text: vi.fn(),
  autoTable: vi.fn(),
  linhas: [] as unknown[],
}))
vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize() {}
    text = pdf.text
    save = pdf.save
  },
}))
vi.mock('jspdf-autotable', () => ({ default: pdf.autoTable }))
vi.mock('exceljs', () => ({
  default: {
    Workbook: class {
      addWorksheet() {
        return { columns: [], addRows: (l: unknown[]) => pdf.linhas.push(...l) }
      }
      xlsx = { writeBuffer: async () => new ArrayBuffer(1) }
    },
  },
}))

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
  pdf.linhas.length = 0
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Estoque', () => {
  it('saldos, alerta de mínimo e exportações', async () => {
    fake.quando('GET /estoque/saldos', [
      {
        produtoId: 'a',
        nome: 'Morango B3',
        saldoAtual: 12,
        unidadeVenda: 'CX',
        estoqueMinimo: 5,
        abaixoMinimo: false,
        custoCaixa: 21,
      },
      {
        produtoId: 'b',
        nome: 'Uva Vitória',
        saldoAtual: 1,
        unidadeVenda: 'CX',
        estoqueMinimo: 5,
        abaixoMinimo: true,
        custoCaixa: null,
      },
      {
        produtoId: 'c',
        nome: 'Kiwi',
        saldoAtual: 0,
        unidadeVenda: 'CX',
        estoqueMinimo: null,
        abaixoMinimo: false,
      },
      { produtoId: 'd' },
    ])
    const clicar = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderTela(<EstoquePage />)
    expect(await screen.findByText(/Uva Vitória — abaixo do estoque mínimo/)).toBeTruthy()
    expect(screen.getByText(/Custo caixa: R\$\s21,00/)).toBeTruthy()
    expect(screen.getAllByText(/Mínimo: 5 CX/).length).toBe(2)

    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/ }))
    await waitFor(() => expect(clicar).toHaveBeenCalled())
    expect(pdf.linhas.map((l: any) => l.Status)).toEqual([
      'Normal',
      'Abaixo do mínimo',
      'Sem estoque',
      'Normal',
    ])

    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(pdf.save).toHaveBeenCalledWith(expect.stringMatching(/^estoque-.*\.pdf$/))
    const corpo = pdf.autoTable.mock.calls[0][1].body
    expect(corpo.map((l: string[]) => l[5])).toEqual([
      'Normal',
      'Abaixo do mínimo',
      'Sem estoque',
      'Normal',
    ])
    expect(corpo[1][3]).toBe('—')
  })

  it('sem saldos usa a lista de produtos e não exporta', async () => {
    fake.quando('GET /estoque/saldos', [])
    renderTela(<EstoquePage />)
    fireEvent.click(await screen.findByRole('button', { name: /Ajuste/ }))
    const modal = janela('Ajuste de Estoque')
    await waitFor(() =>
      expect(within(modal).getAllByRole('option', { name: 'Uva Vitória' }).length).toBe(1),
    )
    expect(
      (screen.getByRole('button', { name: /Exportar Excel/ }) as HTMLButtonElement).disabled,
    ).toBe(true)
  })

  it('registra entrada com rateio, vários produtos e erro', async () => {
    let n = 0
    fake.quando('POST /estoque/entrada', () =>
      ++n === 1 ? new ErroApi(400, ['sem', 'fornecedor']) : {},
    )
    renderTela(<EstoquePage />)
    fireEvent.click(await screen.findByRole('button', { name: /Registrar Entrada/ }))
    const modal = janela('Registrar Entrada de Estoque')
    await waitFor(() =>
      expect(within(modal).getAllByRole('option', { name: 'Ceasa' }).length).toBe(1),
    )
    fireEvent.change(campo('Fornecedor *', modal), { target: { value: 'f1' } })
    preencher('Data do lote', '2026-11-18', modal)
    preencher('Nº do lote', ' 12 ', modal)
    preencher('Frete da compra (opcional)', '1000', modal)
    preencher('Comissão da compra (opcional)', '500', modal)
    preencher('Observação', 'chegou', modal)
    fireEvent.change(campo('Produto *', modal), { target: { value: 'a' } })
    preencher('Quantidade (caixas) *', '10', modal)
    preencher('Valor do produto (por caixa) *', '2000', modal)
    preencher('Preço sugerido de venda (por caixa)', '3000', modal)
    expect(within(modal).getAllByText(/10 cx × R\$\s20,00 =/).length).toBeGreaterThan(0)

    fireEvent.click(within(modal).getByRole('button', { name: /Adicionar produto/ }))
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Remover produto' })[1])
    fireEvent.click(within(modal).getByRole('button', { name: /Adicionar produto/ }))
    const selects = within(modal).getAllByText('Produto *')
    fireEvent.change(campo('Produto *', selects[1].parentElement!.parentElement!.parentElement!), {
      target: { value: 'b' },
    })
    const qtds = within(modal).getAllByText('Quantidade (caixas) *')
    fireEvent.change(qtds[1].parentElement!.querySelector('input')!, { target: { value: '2' } })
    expect(within(modal).getByText(/Valor total R\$\s200,00/)).toBeTruthy()

    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar Entrada' }))
    expect(await within(modal).findByText('sem fornecedor')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Registrar Entrada' }))
    await waitFor(() => expect(screen.queryByText('Registrar Entrada de Estoque')).toBeNull())
    expect(fake.feitas('POST', '/estoque/entrada')[1].data).toEqual({
      fornecedorId: 'f1',
      valorFrete: 10,
      valorComissao: 5,
      observacao: 'chegou',
      dataLote: '2026-11-18',
      numeroLote: '12',
      itens: [
        { produtoId: 'a', quantidade: 10, valorProduto: 20, precoSugeridoVenda: 30 },
        { produtoId: 'b', quantidade: 2, valorProduto: 0 },
      ],
    })
  })

  it('entrada com erro sem mensagem e cancelar', async () => {
    fake.quando('POST /estoque/entrada', new ErroApi(500, null))
    renderTela(<EstoquePage />)
    fireEvent.click(await screen.findByRole('button', { name: /Registrar Entrada/ }))
    const modal = janela('Registrar Entrada de Estoque')
    fireEvent.submit(modal.querySelector('form')!)
    await waitFor(() => expect(fake.feitas('POST', '/estoque/entrada')).toHaveLength(1))
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Registrar Entrada de Estoque')).toBeNull()
  })

  it('entrada com erro de texto', async () => {
    fake.quando('POST /estoque/entrada', new ErroApi(400, 'Fornecedor inválido'))
    renderTela(<EstoquePage />)
    fireEvent.click(await screen.findByRole('button', { name: /Registrar Entrada/ }))
    fireEvent.submit(janela('Registrar Entrada de Estoque').querySelector('form')!)
    expect(await screen.findByText('Fornecedor inválido')).toBeTruthy()
  })

  it('ajuste num lote, com erros', async () => {
    let n = 0
    fake.quando('POST /estoque/ajuste', () => {
      n++
      if (n === 1) return new ErroApi(400, ['saldo', 'negativo'])
      if (n === 2) return new ErroApi(400, 'Lote fechado')
      if (n === 3) return new ErroApi(500, null)
      return {}
    })
    renderTela(<EstoquePage />)
    fireEvent.click(await screen.findByRole('button', { name: /Ajuste/ }))
    const modal = janela('Ajuste de Estoque')
    expect(within(modal).getByRole('option', { name: 'Escolha o produto' })).toBeTruthy()
    fireEvent.change(campo('Produto *', modal), { target: { value: 'a' } })
    await waitFor(() =>
      expect(within(modal).getByRole('option', { name: /lote 7 • saldo 6 cx/ })).toBeTruthy(),
    )
    fireEvent.change(campo('Lote *', modal), { target: { value: 'l1' } })
    preencher(/Quantidade \(positivo/, '-2', modal)
    fireEvent.change(campo('Motivo *', modal), { target: { value: 'Perda' } })
    preencher('Observação', 'caiu', modal)
    const salvar = () =>
      fireEvent.click(within(modal).getByRole('button', { name: 'Salvar Ajuste' }))
    salvar()
    expect(await within(modal).findByText('saldo negativo')).toBeTruthy()
    salvar()
    expect(await within(modal).findByText('Lote fechado')).toBeTruthy()
    salvar()
    expect(await within(modal).findByText('Não foi possível salvar o ajuste.')).toBeTruthy()
    salvar()
    await waitFor(() => expect(screen.queryByText('Ajuste de Estoque')).toBeNull())
    expect(fake.feitas('POST', '/estoque/ajuste')[3].data).toEqual({
      produtoId: 'a',
      loteId: 'l1',
      quantidade: -2,
      motivo: 'Perda',
      observacao: 'caiu',
    })
    fireEvent.click(screen.getByRole('button', { name: /Ajuste/ }))
    fireEvent.click(within(janela('Ajuste de Estoque')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Ajuste de Estoque')).toBeNull()
  })

  it('histórico do produto com compra, ajuste e editar entrada', async () => {
    fake.quando('GET /estoque/:id/historico', ({ url }: { url: string }) =>
      url.includes('/b/')
        ? []
        : [
            {
              id: 'mv1',
              data: '2026-11-18T12:00:00Z',
              tipo: 'ENTRADA',
              quantidade: 10,
              custoUnitario: 21,
              usuario: { nome: 'Duda' },
              itemCompra: {
                rateioFrete: 1,
                rateioComissao: 0,
                compra: {
                  id: 'cp1',
                  fornecedor: 'Ceasa',
                  valorFrete: 10,
                  valorComissao: 0,
                  observacao: 'obs compra',
                  itens: [
                    {
                      id: 'it1',
                      produto: { id: 'a', nome: 'Morango B3' },
                      quantidade: 10,
                      valorProdutoInformado: 200,
                    },
                    { id: 'it2', produto: { id: 'b', nome: 'Uva' }, quantidade: 0 },
                  ],
                },
              },
            },
            {
              id: 'mv4',
              data: '2026-11-18T12:00:00Z',
              tipo: 'ENTRADA',
              quantidade: 3,
              custoUnitario: 20,
              observacao: 'obs mov',
              usuario: null,
              itemCompra: {
                rateioFrete: 0,
                rateioComissao: 0,
                compra: { id: 'cp2', fornecedor: 'X', valorFrete: 0, valorComissao: 0 },
              },
            },
            {
              id: 'mv3',
              data: '2026-11-18T12:00:00Z',
              tipo: 'AJUSTE',
              quantidade: -1,
              origem: 'Ajuste manual',
              custoUnitario: 19,
              motivoAjuste: 'quebra',
              observacao: 'x',
              usuario: { nome: 'Duda' },
              itemCompra: null,
            },
          ],
    )
    renderTela(<EstoquePage />)
    fireEvent.click((await screen.findAllByRole('button', { name: /Ver histórico/ }))[0])
    const modal = janela('Histórico — Morango B3')
    expect(
      await within(modal).findByText(/Morango B3: 10 cx × R\$\s20,00 = R\$\s200,00 · este produto/),
    ).toBeTruthy()
    expect(within(modal).getByText(/Uva: 0 cx × R\$\s0,00/)).toBeTruthy()
    expect(within(modal).getByText(/rateio frete R\$\s1,00/)).toBeTruthy()
    expect(within(modal).getByText('Observação: obs compra')).toBeTruthy()
    expect(within(modal).getByText('Observação: obs mov')).toBeTruthy()
    expect(within(modal).getByText('Motivo: quebra')).toBeTruthy()
    expect(within(modal).getByText('Observação: x')).toBeTruthy()
    expect(within(modal).getByText('-1 cx')).toBeTruthy()
    expect(within(modal).getByText(/Custo caixa R\$\s19,00/)).toBeTruthy()

    fireEvent.click(within(modal).getAllByRole('button', { name: /Editar entrada/ })[0])
    expect(await screen.findByText('Editar entrada de estoque')).toBeTruthy()
    fireEvent.click(
      await within(janela('Editar entrada de estoque')).findByRole('button', { name: 'Cancelar' }),
    )
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))

    fireEvent.click(screen.getAllByRole('button', { name: /Ver histórico/ })[1])
    expect(await screen.findByText('Nenhuma movimentação')).toBeTruthy()
  })
})

describe('Editar entrada', () => {
  const COMPRA = {
    id: 'cp1',
    fornecedor: 'Ceasa',
    fornecedorId: 'f1',
    valorFrete: 10,
    valorComissao: 0,
    observacao: 'obs',
    data: '2026-11-18T12:00:00Z',
    itens: [
      {
        id: 'ic1',
        produto: { id: 'a', nome: 'Morango B3' },
        quantidade: 10,
        valorUnitario: 20,
        custoUnitarioFinal: 21,
        lote: { id: 'l1', numero: '7', dataEntrada: '2026-11-10T15:00:00Z', quantidadeVendida: 4 },
      },
      {
        id: 'ic2',
        produto: { id: 'z', nome: 'Pera antiga' },
        quantidade: 5,
        valorUnitario: 10,
        custoUnitarioFinal: 10,
        lote: null,
      },
    ],
  }

  it('recalcula custo, troca produto e salva', async () => {
    let n = 0
    fake.quando('GET /estoque/compras/:id', COMPRA)
    fake.quando('PATCH /estoque/compras/:id', () =>
      ++n === 1 ? new ErroApi(400, ['qtd', 'baixa']) : {},
    )
    const fechar = vi.fn()
    renderTela(<EditarEntradaModal compraId="cp1" onClose={fechar} />)
    expect(screen.getByText('Carregando...')).toBeTruthy()
    const modal = await waitFor(() => {
      const m = janela('Editar entrada de estoque')
      within(m).getByText(/inclusive das caixas que já foram vendidas/)
      return m
    })
    expect(within(modal).getByText(/lote 7 · 10 cx · 4 cx já vendidas/)).toBeTruthy()
    expect(within(modal).getByRole('option', { name: 'Pera antiga' })).toBeTruthy()
    preencher('Frete da compra', '3000', modal)
    preencher('Comissão da compra', '1500', modal)
    expect(within(modal).getAllByText(/→/).length).toBeGreaterThan(0)
    const linhas = within(modal).getAllByText('Quantidade (cx) *')
    fireEvent.change(linhas[1].parentElement!.querySelector('input')!, { target: { value: '6' } })
    const valores = within(modal).getAllByText('Valor do produto (por caixa) *')
    fireEvent.change(valores[1].parentElement!.querySelector('input')!, {
      target: { value: '1200' },
    })
    const prods = within(modal).getAllByText('Produto')
    fireEvent.change(prods[1].parentElement!.querySelector('select')!, { target: { value: 'b' } })
    preencher('Observação', 'novo frete', modal)
    fireEvent.change(campo('Fornecedor *', modal), { target: { value: 'f1' } })

    fireEvent.click(within(modal).getByRole('button', { name: /Salvar e recalcular/ }))
    expect(await within(modal).findByText('qtd baixa')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: /Salvar e recalcular/ }))
    await waitFor(() => expect(fechar).toHaveBeenCalled())
    expect(fake.feitas('PATCH', '/estoque/compras/cp1')[1].data).toEqual({
      fornecedorId: 'f1',
      valorFrete: 30,
      valorComissao: 15,
      observacao: 'novo frete',
      itens: [
        { id: 'ic1', valorProduto: 20, quantidade: 10, produtoId: 'a' },
        { id: 'ic2', valorProduto: 12, quantidade: 6, produtoId: 'b' },
      ],
    })
  })

  it('entrada antiga sem fornecedor cadastrado e erros', async () => {
    let n = 0
    fake.quando('GET /estoque/compras/:id', {
      ...COMPRA,
      fornecedorId: null,
      observacao: null,
      valorFrete: 0,
      itens: [
        {
          ...COMPRA.itens[0],
          custoUnitarioFinal: 20,
          lote: { ...COMPRA.itens[0].lote, quantidadeVendida: 0 },
        },
      ],
    })
    fake.quando('PATCH /estoque/compras/:id', () =>
      ++n === 1 ? new ErroApi(400, 'Inválido') : new ErroApi(500, null),
    )
    renderTela(<EditarEntradaModal compraId="cp9" onClose={() => {}} />)
    expect(await screen.findByRole('option', { name: 'Ceasa (sem cadastro)' })).toBeTruthy()
    const modal = janela('Editar entrada de estoque')
    expect(within(modal).queryByText(/inclusive/)).toBeNull()
    expect(within(modal).queryByText(/→/)).toBeNull()
    fireEvent.click(within(modal).getByRole('button', { name: /Salvar e recalcular/ }))
    expect(await within(modal).findByText('Inválido')).toBeTruthy()
    expect(fake.feitas('PATCH', '/estoque/compras/cp9')[0].data.fornecedor).toBe('Ceasa')
    fireEvent.click(within(modal).getByRole('button', { name: /Salvar e recalcular/ }))
    expect(await within(modal).findByText('Não foi possível salvar a entrada.')).toBeTruthy()
  })

  it('fechado não busca nada', () => {
    renderTela(<EditarEntradaModal compraId={null} onClose={() => {}} />)
    expect(screen.queryByText('Editar entrada de estoque')).toBeNull()
  })
})

describe('Seletor de fornecedor', () => {
  it('cadastra fornecedor novo pelo seletor', async () => {
    let n = 0
    fake.quando('POST /fornecedores', ({ data }: { data: object }) =>
      ++n === 1
        ? new ErroApi(400, 'Já existe')
        : n === 2
          ? new ErroApi(500, null)
          : { id: 'f9', ...data, ativo: true },
    )
    const mudou = vi.fn()
    renderTela(<FornecedorSelect fornecedorId="" onChange={mudou} label="Forn" />)
    expect(screen.getByRole('option', { name: 'Carregando...' })).toBeTruthy()
    await screen.findByRole('option', { name: 'Ceasa' })
    fireEvent.change(campo('Forn'), { target: { value: 'f2' } })
    expect(mudou).toHaveBeenCalledWith({ id: 'f2', nome: 'Sítio Velho' })
    fireEvent.change(campo('Forn'), { target: { value: 'nada' } })
    expect(mudou).toHaveBeenCalledTimes(1)

    fireEvent.change(campo('Forn'), { target: { value: '__novo' } })
    let modal = janela('Cadastrar fornecedor')
    const cadastrar = () =>
      within(modal).getByRole('button', { name: 'Cadastrar' }) as HTMLButtonElement
    expect(cadastrar().disabled).toBe(true)
    fireEvent.keyDown(campo('Nome *', modal), { key: 'Enter' })
    expect(fake.feitas('POST', '/fornecedores')).toHaveLength(0)
    preencher('Nome *', 'Abacaxi Ltda', modal)
    preencher('CNPJ/CPF', '1', modal)
    preencher('Telefone', '2', modal)
    preencher('Observação', '3', modal)
    fireEvent.keyDown(campo('Nome *', modal), { key: 'a' })
    fireEvent.keyDown(campo('Nome *', modal), { key: 'Enter' })
    expect(await within(modal).findByText('Já existe')).toBeTruthy()
    fireEvent.click(cadastrar())
    expect(await within(modal).findByText('Não foi possível cadastrar o fornecedor.')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Cadastrar fornecedor')).toBeNull()

    fireEvent.change(campo('Forn'), { target: { value: '__novo' } })
    modal = janela('Cadastrar fornecedor')
    expect(campo('Nome *', modal).value).toBe('')
    preencher('Nome *', 'Abacaxi Ltda', modal)
    fireEvent.click(cadastrar())
    await waitFor(() => expect(mudou).toHaveBeenLastCalledWith({ id: 'f9', nome: 'Abacaxi Ltda' }))
    expect(screen.queryByText('Cadastrar fornecedor')).toBeNull()
  })

  it('fornecedor inativo e lista vazia', async () => {
    fake.quando('GET /fornecedores', [])
    renderTela(<FornecedorSelect fornecedorId="f7" nomeAtual="Velho" onChange={() => {}} />)
    expect(await screen.findByText(/Nenhum fornecedor cadastrado/)).toBeTruthy()
    expect(screen.getByRole('option', { name: 'Velho (inativo)' })).toBeTruthy()
  })
})
