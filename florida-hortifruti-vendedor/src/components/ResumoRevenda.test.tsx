import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { logar, renderTela } from '../test/render'
import { ResumoRevenda } from './ResumoRevenda'

const PEDIDO = {
  id: 'p1',
  status: 'AGUARDANDO_APROVACAO',
  totalFinal: 100,
  precosRevenda: { a: 40 },
  itens: [
    { produtoId: 'a', quantidade: 1, valorUnitario: 30, produto: { nome: 'Morango' } },
    { produtoId: 'a', quantidade: 1, valorUnitario: 30, produto: { nome: 'Morango' } },
    { produtoId: 'b', quantidade: '1', valorUnitario: '40' },
  ],
}

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiFalsa(api)
})

describe('Resumo da revenda', () => {
  it('mostra venda, custo e margem; edita e salva os preços', async () => {
    fake.quando('PATCH /pedidos/:id/precos-revenda', {})
    renderTela(<ResumoRevenda pedido={PEDIDO} />)
    expect(screen.getByText('Produto')).toBeTruthy()
    expect(screen.getByText('2 cx')).toBeTruthy()
    // Venda 80 (2 x 40) e 0 do produto sem preço; paga 100 à Flórida: margem negativa
    expect(screen.getByText(/-R\$\s20,00/)).toBeTruthy()
    expect(screen.getByText(/pode ser ajustado na aprovação/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Editar preços' }))
    const [a, b] = screen.getAllByPlaceholderText('R$/cx')
    fireEvent.change(a, { target: { value: '45,5' } })
    fireEvent.change(b, { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Editar preços' })).toBeTruthy())
    expect(fake.feitas('PATCH', '/pedidos/p1/precos-revenda')[0].data).toEqual({
      precos: [
        { produtoId: 'a', valor: 45.5 },
        { produtoId: 'b', valor: 0 },
      ],
    })
  })

  it('erro ao salvar e pedido aprovado sem preços', async () => {
    fake.quando('PATCH /pedidos/:id/precos-revenda', new ErroApi(400))
    renderTela(
      <ResumoRevenda
        pedido={{
          ...PEDIDO,
          status: 'APROVADO',
          precosRevenda: null,
          itens: undefined,
          totalFinal: null,
        }}
      />,
    )
    expect(screen.queryByText(/pode ser ajustado/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Editar preços' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByText('Não foi possível salvar os preços.')).toBeTruthy()
  })

  it('margem positiva', () => {
    renderTela(<ResumoRevenda pedido={{ ...PEDIDO, precosRevenda: { a: 80, b: 50 } }} />)
    expect(screen.getByText(/R\$\s110,00/).className).toContain('text-green-700')
  })
})
