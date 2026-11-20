import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta, LOTE } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { LotesPage } from './LotesPage'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const LOTE_NOVO = {
  ...LOTE,
  id: 'l5',
  numero: '5',
  quantidadeVendida: 0,
  vendas: [],
  compraId: null,
  observacao: null,
  precoSugeridoVenda: null,
}

describe('Lotes', () => {
  it('lista, totais, filtros e histórico do lote', async () => {
    renderTela(<LotesPage />)
    expect(await screen.findByText('Lote 7')).toBeTruthy()
    expect(screen.getByText('chegou cedo')).toBeTruthy()
    expect(screen.getByText('Esgotado')).toBeTruthy()
    expect(screen.getAllByText('6 cx', { selector: 'strong' }).length).toBe(2)
    expect(screen.getByRole('button', { name: /Histórico \(1 venda\)/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Histórico \(0 vendas\)/ })).toBeTruthy()

    fireEvent.change(campo('Produto'), { target: { value: 'a' } })
    fireEvent.change(campo('Situação'), { target: { value: '' } })
    await waitFor(() =>
      expect(fake.chamadas.at(-1)?.params).toEqual({ produtoId: 'a', situacao: undefined }),
    )

    fake.quando('GET /estoque/lotes/:id/historico', {
      movimentos: [
        {
          id: 'x1',
          data: '2026-11-18T12:00:00Z',
          origem: 'Compra - Ceasa',
          quantidade: 10,
          tipo: 'ENTRADA',
          saldoAntes: 0,
          saldoDepois: 10,
          numeroPedido: null,
          cliente: null,
          usuario: 'Duda',
        },
        {
          id: 'x2',
          data: '2026-11-18T12:00:00Z',
          origem: 'Venda',
          quantidade: 4,
          tipo: 'SAIDA',
          saldoAntes: null,
          saldoDepois: null,
          numeroPedido: 181,
          cliente: 'Mercado',
          usuario: null,
        },
      ],
    })
    fireEvent.click(screen.getByRole('button', { name: /Histórico \(1 venda\)/ }))
    const modal = janela(/Histórico — .* - lote 7 — Morango B3/)
    expect(await within(modal).findByText('Pedido #181 · Mercado')).toBeTruthy()
    expect(within(modal).getByText('Compra - Ceasa')).toBeTruthy()
    expect(within(modal).getByText('−4 cx')).toBeTruthy()
    expect(within(modal).getByText('+10 cx')).toBeTruthy()
    expect(within(modal).getByText('saldo 0 → 10')).toBeTruthy()
    expect(within(modal).getByText(/ · Venda$/)).toBeTruthy()
    expect(within(modal).getByText(/ · Duda$/)).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))

    fake.quando('GET /estoque/lotes/:id/historico', { movimentos: [] })
    fireEvent.click(screen.getByRole('button', { name: /Histórico \(0 vendas\)/ }))
    expect(await screen.findByText('Nenhuma movimentação')).toBeTruthy()
  })

  it('lista vazia', async () => {
    fake.quando('GET /estoque/lotes', [])
    renderTela(<LotesPage />)
    expect(await screen.findByText('Nenhum lote encontrado')).toBeTruthy()
  })

  it('cadastra lote com número sugerido e erros', async () => {
    let n = 0
    fake.quando('GET /estoque/lotes/proximo-numero', { numero: '3' })
    fake.quando('POST /estoque/entrada', () =>
      ++n === 1 ? new ErroApi(400, ['qtd', 'inválida']) : n === 2 ? new ErroApi(500, null) : {},
    )
    renderTela(<LotesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Novo lote/ }))
    const modal = janela('Novo lote')
    await waitFor(() => expect(campo('Nº do lote *', modal).value).toBe('3'))
    preencher('Data *', '2026-11-18', modal)
    fireEvent.change(campo('Produto *', modal), { target: { value: 'a' } })
    preencher('Quantidade (caixas) *', '10', modal)
    preencher('Valor por caixa *', '2000', modal)
    preencher('Preço sugerido de venda (por caixa)', '3000', modal)
    await waitFor(() =>
      expect(within(modal).getAllByRole('option', { name: 'Ceasa' }).length).toBe(1),
    )
    fireEvent.change(campo('Fornecedor *', modal), { target: { value: 'f1' } })
    preencher('Observação', 'cedo', modal)
    preencher('Nº do lote *', '', modal)
    expect(
      within(modal).getByText(/18\/11 - lote \? - 10 caixas Morango B3 - R\$\s20,00/),
    ).toBeTruthy()
    preencher('Nº do lote *', ' 4 ', modal)

    const cadastrar = () =>
      fireEvent.click(within(modal).getByRole('button', { name: 'Cadastrar lote' }))
    cadastrar()
    expect(await within(modal).findByText('qtd inválida')).toBeTruthy()
    cadastrar()
    expect(await within(modal).findByText('Não foi possível cadastrar o lote.')).toBeTruthy()
    cadastrar()
    await waitFor(() => expect(screen.queryByText('Novo lote', { selector: 'h2' })).toBeNull())
    expect(fake.feitas('POST', '/estoque/entrada')[2].data).toEqual({
      fornecedorId: 'f1',
      observacao: 'cedo',
      dataLote: '2026-11-18',
      numeroLote: '4',
      itens: [{ produtoId: 'a', quantidade: 10, valorProduto: 20, precoSugeridoVenda: 30 }],
    })

    fireEvent.click(screen.getByRole('button', { name: /Novo lote/ }))
    const m2 = janela('Novo lote')
    fireEvent.change(campo('Produto *', m2), { target: { value: 'zz' } })
    preencher('Quantidade (caixas) *', '1', m2)
    preencher('Nº do lote *', '', m2)
    fireEvent.submit(m2.querySelector('form')!)
    await waitFor(() => expect(fake.feitas('POST', '/estoque/entrada')).toHaveLength(4))
    expect(fake.feitas('POST', '/estoque/entrada')[3].data.numeroLote).toBeUndefined()
    await waitFor(() => expect(screen.queryByText('Novo lote', { selector: 'h2' })).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Novo lote/ }))
    fireEvent.click(within(janela('Novo lote')).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Novo lote', { selector: 'h2' })).toBeNull()
  })

  it('edita lote com erros e cancela', async () => {
    let n = 0
    fake.quando('PATCH /estoque/lotes/:id', () =>
      ++n === 1 ? new ErroApi(400, 'Número repetido') : n === 2 ? new ErroApi(500, null) : {},
    )
    renderTela(<LotesPage />)
    await screen.findByText('Lote 7')
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar lote' })[0])
    const modal = janela('Editar lote — Morango B3')
    expect(campo('Observação', modal).value).toBe('chegou cedo')
    preencher('Nº do lote *', '70', modal)
    preencher('Observação', 'x', modal)
    preencher('Preço sugerido de venda (por caixa)', '0', modal)
    const salvar = () => fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    salvar()
    expect(await within(modal).findByText('Número repetido')).toBeTruthy()
    salvar()
    expect(await within(modal).findByText('Não foi possível salvar o lote.')).toBeTruthy()
    salvar()
    await waitFor(() => expect(screen.queryByText('Editar lote — Morango B3')).toBeNull())
    expect(fake.feitas('PATCH', '/estoque/lotes/l1')[2].data).toEqual({
      numero: '70',
      observacao: 'x',
      precoSugeridoVenda: null,
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar lote' })[1])
    const m2 = janela('Editar lote — Morango B3')
    expect(campo('Observação', m2).value).toBe('')
    preencher('Preço sugerido de venda (por caixa)', '2500', m2)
    fireEvent.click(within(m2).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(fake.feitas('PATCH', '/estoque/lotes/l2')[0]?.data.precoSugeridoVenda).toBe(25),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar lote' })[0])
    fireEvent.click(
      within(janela('Editar lote — Morango B3')).getByRole('button', { name: 'Cancelar' }),
    )
    expect(screen.queryByText('Editar lote — Morango B3')).toBeNull()
  })

  it('remove lote sem saída, com confirmação e erro', async () => {
    fake.quando('GET /estoque/lotes', [LOTE_NOVO])
    let n = 0
    fake.quando('DELETE /estoque/lotes/:id', () =>
      ++n === 1 ? new ErroApi(400, 'Já saiu caixa') : n === 2 ? new ErroApi(500, null) : {},
    )
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => {})
    renderTela(<LotesPage />)
    const remover = () => fireEvent.click(screen.getByRole('button', { name: /Remover lote/ }))
    await screen.findByText('Lote 5')
    expect(screen.queryByRole('button', { name: /Editar entrada/ })).toBeNull()
    remover()
    expect(confirmar).toHaveBeenCalledWith(
      'Remover o lote 5 de Morango B3? As 10 cx saem do estoque.',
    )
    expect(fake.feitas('DELETE', '/estoque/lotes/l5')).toHaveLength(0)
    remover()
    await waitFor(() => expect(alerta).toHaveBeenCalledWith('Já saiu caixa'))
    remover()
    await waitFor(() => expect(alerta).toHaveBeenCalledWith('Não foi possível remover o lote.'))
    remover()
    await waitFor(() => expect(fake.feitas('DELETE', '/estoque/lotes/l5')).toHaveLength(3))
  })

  it('abre a edição da entrada do lote', async () => {
    renderTela(<LotesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Editar entrada/ }))
    expect(await screen.findByText('Editar entrada de estoque')).toBeTruthy()
    fireEvent.click(
      await within(janela('Editar entrada de estoque')).findByRole('button', { name: 'Cancelar' }),
    )
    expect(screen.queryByText('Editar entrada de estoque')).toBeNull()
  })
})
