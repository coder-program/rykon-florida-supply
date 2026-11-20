import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa } from '../test/api-falsa'
import { apiCompleta, PRODUTO, PRODUTO_2 } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { ProdutosPage } from './ProdutosPage'

const pdf = vi.hoisted(() => ({ salvo: '', tabela: null as any }))
vi.mock('jspdf', () => ({
  jsPDF: class {
    setFontSize() {}
    text() {}
    save(nome: string) {
      pdf.salvo = nome
    }
  },
}))
vi.mock('jspdf-autotable', () => ({
  default: (_doc: unknown, opts: unknown) => (pdf.tabela = opts),
}))
const excel = vi.hoisted(() => ({ linhas: [] as any[] }))
vi.mock('exceljs', () => ({
  default: {
    Workbook: class {
      xlsx = { writeBuffer: async () => new ArrayBuffer(4) }
      addWorksheet() {
        return {
          columns: [],
          addRows(l: any[]) {
            excel.linhas = l
          },
        }
      }
    },
  },
}))

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const abrir = () => renderTela(<ProdutosPage />)
const nomes = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => r.children[1]?.textContent)

describe('Produtos', () => {
  it('filtros de status, busca, categoria e estoque', async () => {
    fake.quando('GET /produtos', [
      PRODUTO,
      PRODUTO_2,
      {
        ...PRODUTO,
        id: 'c',
        nome: 'Baixo',
        codigoInterno: 'B1',
        estoqueAtual: 3,
        categoriaId: null,
        categoria: { id: 'cat1', nome: 'Frutas' },
      },
      {
        ...PRODUTO,
        id: 'd',
        nome: 'Quase',
        codigoInterno: 'Q1',
        estoqueAtual: 1,
        estoqueMinimo: null,
        categoriaId: 'cat2',
        categoria: null,
      },
      {
        ...PRODUTO,
        id: 'e',
        nome: 'Sobra',
        codigoInterno: 'S1',
        estoqueAtual: 2,
        estoqueMinimo: 0,
        categoriaId: null,
        categoria: null,
      },
      {
        ...PRODUTO,
        id: 'f',
        nome: 'Vazio',
        codigoInterno: 'V1',
        estoqueAtual: undefined,
        estoqueMinimo: undefined,
        categoriaId: null,
        categoria: null,
      },
    ])
    abrir()
    await waitFor(() => expect(nomes()).toEqual(['Morango B3', 'Baixo', 'Quase', 'Sobra', 'Vazio']))
    expect(screen.getByText(/5 produto\(s\) exibido\(s\)/)).toBeTruthy()

    preencher('Estoque', 'sem-estoque')
    expect(nomes()).toEqual(['Vazio'])
    preencher('Estoque', 'baixo')
    expect(nomes()).toEqual(['Baixo', 'Quase'])
    preencher('Estoque', 'normal')
    expect(nomes()).toEqual(['Morango B3', 'Sobra'])
    preencher('Estoque', 'todos')

    await waitFor(() => expect(within(campo('Categoria')).getByText('Frutas')).toBeTruthy())
    preencher('Categoria', 'cat1')
    expect(nomes()).toEqual(['Morango B3', 'Baixo'])
    preencher('Categoria', '')

    fireEvent.change(screen.getByPlaceholderText('Nome, código ou categoria'), {
      target: { value: 'FRUT' },
    })
    expect(nomes()).toEqual(['Morango B3', 'Baixo'])
    fireEvent.change(screen.getByPlaceholderText('Nome, código ou categoria'), {
      target: { value: 'q1' },
    })
    expect(nomes()).toEqual(['Quase'])
    fireEvent.change(screen.getByPlaceholderText('Nome, código ou categoria'), {
      target: { value: '' },
    })

    preencher('Status', 'inativos')
    await waitFor(() => expect(nomes()).toEqual(['Uva Vitória']))
    expect(fake.chamadas.filter((c) => c.url === '/produtos').at(-1)?.params).toEqual({
      incluirInativos: true,
    })
    preencher('Status', 'todos')
    await waitFor(() => expect(nomes()).toHaveLength(6))

    fireEvent.change(screen.getByPlaceholderText('Nome, código ou categoria'), {
      target: { value: 'nada' },
    })
    expect(screen.getAllByText('Nenhum produto encontrado')).toHaveLength(2)
    expect(screen.getByRole('button', { name: /Exportar Excel/ })).toBeDisabled()
  })

  it('exporta Excel e PDF', async () => {
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    fake.quando('GET /produtos', [
      PRODUTO,
      {
        ...PRODUTO_2,
        ativo: true,
        precoSugerido: undefined,
        unidadeVenda: undefined,
        codigoInterno: undefined,
        nome: undefined,
        estoqueAtual: undefined,
      },
    ])
    abrir()
    await screen.findAllByText('Morango B3')
    fireEvent.click(screen.getByRole('button', { name: /Exportar Excel/ }))
    await waitFor(() => expect(clique).toHaveBeenCalled())
    expect(excel.linhas).toEqual([
      {
        Código: 'M1',
        Nome: 'Morango B3',
        Categoria: 'Frutas',
        Unidade: 'CX',
        'Preço Sugerido': 30,
        Custo: 20,
        Estoque: 12,
        'Estoque Mínimo': 5,
        Status: 'Ativo',
      },
      {
        Código: '',
        Nome: '',
        Categoria: '',
        Unidade: '',
        'Preço Sugerido': 0,
        Custo: 0,
        Estoque: 0,
        'Estoque Mínimo': 0,
        Status: 'Ativo',
      },
    ])
    fireEvent.click(screen.getByRole('button', { name: /Exportar PDF/ }))
    expect(pdf.salvo).toMatch(/^produtos-.*\.pdf$/)
    expect(pdf.tabela.body[0]).toEqual([
      'M1',
      'Morango B3',
      'Frutas',
      'CX',
      12,
      expect.stringMatching(/R\$\s30,00/),
      expect.stringMatching(/R\$\s20,00/),
      'Ativo',
    ])
    expect(pdf.tabela.body[1].slice(0, 5)).toEqual(['', '', '', '', 0])
    expect(pdf.tabela.body[1][6]).toBe('—')
  })

  it('cria produto com todos os campos e com o mínimo', async () => {
    fake.quando('POST /produtos', {})
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: /Novo Produto/ }))
    let modal = janela('Novo Produto')
    preencher('Código Interno *', 'K1', modal)
    preencher('Nome *', 'Kiwi', modal)
    await waitFor(() => expect(within(campo('Categoria', modal)).getByText('Frutas')).toBeTruthy())
    preencher('Categoria', 'cat1', modal)
    preencher('Unidade de Venda', 'KG', modal)
    preencher('Preço Sugerido (R$) *', '3550', modal)
    expect(campo('Preço Sugerido (R$) *', modal).value).toBe('35,50')
    preencher('Custo (R$)', '2000', modal)
    preencher('Estoque mínimo', '3', modal)
    preencher('Limite de estoque baixo', '6', modal)
    fireEvent.click(within(modal).getByLabelText(/Mostrar quantidade aproximada/))
    fireEvent.click(within(modal).getByLabelText('Exibir no portal do cliente'))
    fireEvent.submit(modal.querySelector('form')!)
    await waitFor(() => expect(fake.feitas('POST', '/produtos')).toHaveLength(1))
    expect(fake.feitas('POST', '/produtos')[0].data).toEqual({
      codigoInterno: 'K1',
      nome: 'Kiwi',
      categoriaId: 'cat1',
      unidadeVenda: 'KG',
      precoSugerido: 35.5,
      custo: 20,
      estoqueMinimo: 3,
      limiteEstoqueBaixo: 6,
      exibirQuantidadeAproximada: true,
      exibirNoPortalCliente: false,
    })
    await waitFor(() => expect(screen.queryByText('Novo Produto', { selector: 'h2' })).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: /Novo Produto/ }))
    modal = janela('Novo Produto')
    preencher('Preço Sugerido (R$) *', '0', modal)
    expect(campo('Preço Sugerido (R$) *', modal).value).toBe('0,00')
    preencher('Código Interno *', 'Z', modal)
    preencher('Nome *', 'Zeta', modal)
    fireEvent.submit(modal.querySelector('form')!)
    await waitFor(() => expect(fake.feitas('POST', '/produtos')).toHaveLength(2))
    expect(fake.feitas('POST', '/produtos')[1].data).toEqual({
      codigoInterno: 'Z',
      nome: 'Zeta',
      unidadeVenda: 'CAIXA',
      precoSugerido: 0,
      exibirQuantidadeAproximada: false,
      exibirNoPortalCliente: true,
    })
    fireEvent.click(screen.getByRole('button', { name: /Novo Produto/ }))
    fireEvent.click(within(janela('Novo Produto')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Novo Produto', { selector: 'h2' })).toBeNull()
  })

  it('edita produtos existentes', async () => {
    fake.quando('PUT /produtos/:id', {})
    fake.quando('GET /produtos', [
      PRODUTO,
      {
        ...PRODUTO_2,
        ativo: true,
        precoSugerido: 0,
        unidadeVenda: '',
        exibirNoPortalCliente: false,
        exibirQuantidadeAproximada: undefined,
        limiteEstoqueBaixo: null,
        categoria: { id: 'cat1', nome: 'Frutas' },
      },
    ])
    abrir()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[0])
    let modal = janela('Editar Produto')
    expect(campo('Preço Sugerido (R$) *', modal).value).toBe('30,00')
    expect(campo('Custo (R$)', modal).value).toBe('20,00')
    fireEvent.submit(modal.querySelector('form')!)
    await waitFor(() => expect(fake.feitas('PUT', '/produtos/a')).toHaveLength(1))
    expect(fake.feitas('PUT', '/produtos/a')[0].data).toMatchObject({
      precoSugerido: 30,
      custo: 20,
      estoqueMinimo: 5,
      limiteEstoqueBaixo: 8,
      categoriaId: 'cat1',
    })
    await waitFor(() => expect(screen.queryByText('Editar Produto')).toBeNull())

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])
    modal = janela('Editar Produto')
    expect(campo('Preço Sugerido (R$) *', modal).value).toBe('')
    expect(campo('Custo (R$)', modal).value).toBe('')
    expect(campo('Categoria', modal).value).toBe('cat1')
    expect(within(modal).getByLabelText('Exibir no portal do cliente')).not.toBeChecked()
    fireEvent.submit(modal.querySelector('form')!)
    await waitFor(() => expect(fake.feitas('PUT', '/produtos/b')).toHaveLength(1))
    expect(fake.feitas('PUT', '/produtos/b')[0].data).toEqual({
      codigoInterno: 'U1',
      nome: 'Uva Vitória',
      categoriaId: 'cat1',
      unidadeVenda: 'CAIXA',
      precoSugerido: 0,
      exibirQuantidadeAproximada: false,
      exibirNoPortalCliente: false,
    })
  })

  it('histórico de preços, desativar e reativar', async () => {
    fake.quando('DELETE /produtos/:id', {})
    fake.quando('POST /produtos/:id/reativar', {})
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    fake.quando('GET /produtos', [PRODUTO, PRODUTO_2])
    abrir()
    preencher('Status', 'todos')
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Reativar' })).toHaveLength(2))

    fireEvent.click(screen.getAllByRole('button', { name: 'Histórico de preços' })[0])
    let modal = janela('Histórico de Preços — Morango B3')
    expect(await within(modal).findByText('Duda')).toBeTruthy()
    expect(within(modal).getByText(/R\$\s28,00/)).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))

    fake.quando('GET /produtos/:id/historico-precos', [])
    fireEvent.click(screen.getAllByRole('button', { name: 'Histórico de preços' })[3])
    modal = janela('Histórico de Preços — Uva Vitória')
    expect(await within(modal).findByText('Nenhuma alteração de preço registrada')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))

    const desativar = screen.getAllByRole('button', { name: 'Desativar' })
    fireEvent.click(desativar[0])
    expect(fake.feitas('DELETE', '/produtos/a')).toHaveLength(0)
    fireEvent.click(desativar[0])
    fireEvent.click(desativar[1])
    await waitFor(() => expect(fake.feitas('DELETE', '/produtos/a')).toHaveLength(2))
    expect(confirmar).toHaveBeenLastCalledWith(
      'Desativar Morango B3? Pedidos antigos continuam no histórico.',
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Reativar' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Reativar' })[1])
    await waitFor(() => expect(fake.feitas('POST', '/produtos/b/reativar')).toHaveLength(2))
  })
})
