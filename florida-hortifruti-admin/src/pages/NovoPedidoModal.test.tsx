import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { hojeISO } from '../lib/utils'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta, CLIENTE, PRODUTO, PRODUTO_2 } from '../test/dados'
import { campo, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { NovoPedidoModal } from './NovoPedidoModal'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function escolherCliente(nome = 'Mercado Vale Verde') {
  const busca = screen.getByPlaceholderText('Digite o nome do cliente')
  fireEvent.focus(busca)
  fireEvent.change(busca, { target: { value: nome.slice(0, 5) } })
  fireEvent.click(screen.getByRole('button', { name: new RegExp(nome) }))
}
const enviar = () =>
  fireEvent.submit(screen.getByRole('button', { name: /Criar Pedido|Salvando/ }).closest('form')!)
async function aviso(titulo: string, fechar: 'Entendi' | 'Fechar aviso' = 'Entendi') {
  expect(await screen.findByText(titulo)).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: fechar }))
  expect(screen.queryByText(titulo)).toBeNull()
}
const qtd = () => screen.getAllByLabelText('Quantidade de caixas') as HTMLInputElement[]

describe('NovoPedidoModal', () => {
  it('monta o pedido escolhendo lote, dividindo e validando', async () => {
    fake.quando('POST /pedidos', { id: 'p9' })
    const onClose = vi.fn()
    renderTela(<NovoPedidoModal open onClose={onClose} />)
    await screen.findByText('Uva Vitória', {}, { timeout: 20_000 })
    expect(screen.getByText('Sem lote com saldo')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Adicionar Uva Vitória' })).toBeDisabled()

    // Sem cliente
    enviar()
    await aviso('Cliente obrigatório')
    escolherCliente()
    // Sem itens
    enviar()
    await aviso('Itens obrigatórios', 'Fechar aviso')

    // Dois lotes livres: o lote fica para escolher
    await screen.findByText('12 cx', {}, { timeout: 20_000 })
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Morango B3' }))
    expect(screen.getByText('Selecione o lote de cada produto para continuar.')).toBeTruthy()
    enviar()
    await aviso('Lote obrigatório')

    fireEvent.change(screen.getByDisplayValue('Selecione o lote'), { target: { value: 'l1' } })
    expect(screen.getByText(/Preço sugerido: R\$\s30,00\/cx/)).toBeTruthy()
    for (let i = 0; i < 6; i++)
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar caixas' }))
    expect(qtd()[0].value).toBe('6')
    expect(screen.getByRole('button', { name: 'Aumentar caixas' })).toBeDisabled()
    expect(screen.getByText(/Lote no limite/)).toBeTruthy()

    // Divide: o único lote livre já vem escolhido, com o mesmo preço
    fireEvent.click(screen.getByRole('button', { name: /Dividir em outro lote/ }))
    expect(screen.queryByRole('button', { name: /Dividir em outro lote/ })).toBeNull()
    expect(qtd()).toHaveLength(2)
    fireEvent.change(qtd()[1], { target: { value: '5' } })
    expect(screen.getByText(/Saldo insuficiente: o lote tem 3 cx/)).toBeTruthy()
    expect(screen.getByText(/Ajuste a quantidade ou escolha outro lote/)).toBeTruthy()
    enviar()
    await aviso('Saldo insuficiente')
    // Apagar o número volta para 1 ao sair do campo
    fireEvent.change(qtd()[1], { target: { value: '' } })
    expect(qtd()[1].value).toBe('')
    fireEvent.focus(qtd()[1])
    fireEvent.blur(qtd()[1])
    expect(qtd()[1].value).toBe('1')
    fireEvent.blur(qtd()[0])
    // Diminuir de 1 tira a linha
    fireEvent.click(screen.getAllByRole('button', { name: 'Diminuir caixas' })[1])
    expect(qtd()).toHaveLength(1)

    // Preço: zerado não passa; abaixo do sugerido avisa
    const preco = screen.getByDisplayValue('30') as HTMLInputElement
    fireEvent.change(preco, { target: { value: '' } })
    enviar()
    await aviso('Preço obrigatório')
    fireEvent.change(preco, { target: { value: '25' } })
    expect(screen.getByText(/preço abaixo do sugerido/)).toBeTruthy()

    // Trocar o lote ajusta a quantidade ao saldo; sem lote mantém
    fireEvent.change(screen.getByDisplayValue(/lote 7/), { target: { value: 'l3' } })
    expect(qtd()[0].value).toBe('3')
    fireEvent.change(screen.getByDisplayValue(/lote 9/), { target: { value: '' } })
    expect(qtd()[0].value).toBe('3')
    expect(screen.queryByText(/Preço sugerido/)).toBeNull()
    fireEvent.change(screen.getByDisplayValue('Selecione o lote'), { target: { value: 'l1' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Diminuir caixas' })[0])

    preencher('Data do pedido *', '2026-01-02')
    expect(screen.getByText(/Venda de outro dia/)).toBeTruthy()
    preencher('Frete (R$)', '10')
    preencher('Desconto (R$)', '5')
    preencher('Pagamento *', 'DINHEIRO')
    preencher('Vencimento', '2026-12-01')
    fireEvent.click(screen.getByLabelText('Necessita Nota Fiscal'))
    fireEvent.click(screen.getByLabelText('Necessita Recibo de Venda'))
    preencher('Observações', 'x'.repeat(300))
    expect(screen.getByText('255/255')).toBeTruthy()
    // 2 cx × 25 + 10 − 5
    expect(screen.getByText(/Total R\$\s55,00/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Criar Pedido' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(fake.feitas('POST', '/pedidos')[0].data).toEqual({
      clienteId: 'c1',
      data: '2026-01-02',
      itens: [{ produtoId: 'a', loteId: 'l1', quantidade: 2, valorUnitario: 25 }],
      valorFrete: 10,
      descontoValor: 5,
      formaPagamento: 'DINHEIRO',
      dataVencimento: '2026-12-01',
      necessitaNF: true,
      necessitaRecibo: true,
      observacoes: 'x'.repeat(255),
    })
  })

  it('lote único já vem escolhido; erros da API; cancelar limpa', async () => {
    // listas em envelopes diferentes
    fake.quando('GET /clientes', { data: [CLIENTE] })
    fake.quando('GET /produtos', { items: [PRODUTO, PRODUTO_2] })
    fake.quando('GET /estoque/lotes/disponiveis', {
      results: [
        {
          id: 'l1',
          produtoId: 'a',
          numero: '7',
          dataEntrada: '2026-11-10T15:00:00Z',
          quantidadeDisponivel: 6,
        },
      ],
    })
    fake.quando('POST /pedidos', new ErroApi(400, ['Lote sem saldo', 'tente outro']))
    const onClose = vi.fn()
    renderTela(<NovoPedidoModal open onClose={onClose} />)
    await screen.findByText('12 cx', {}, { timeout: 20_000 })
    escolherCliente()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar Morango B3' }))
    expect(screen.getByDisplayValue(/lote 7/)).toBeTruthy()
    expect(screen.queryByText(/Preço sugerido/)).toBeNull()
    expect(screen.queryByRole('button', { name: /Dividir em outro lote/ })).toBeNull()
    preencher('Observações', '')

    fireEvent.click(screen.getByRole('button', { name: 'Criar Pedido' }))
    await aviso('Falha ao criar pedido')
    const corpo = fake.feitas('POST', '/pedidos')[0].data
    expect(corpo).toMatchObject({ valorFrete: 0, descontoValor: 0, data: hojeISO() })
    expect(corpo).not.toHaveProperty('dataVencimento')
    expect(corpo).not.toHaveProperty('observacoes')

    fake.quando('POST /pedidos', new ErroApi(400, 'Cliente inativo'))
    fireEvent.click(screen.getByRole('button', { name: 'Criar Pedido' }))
    expect(await screen.findByText('Cliente inativo')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

    fake.quando('POST /pedidos', () => Promise.reject(new Error('rede')))
    fireEvent.click(screen.getByRole('button', { name: 'Criar Pedido' }))
    expect(await screen.findByText('Não foi possível criar o pedido.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(
      within(screen.getByText('Novo Pedido').parentElement!).getByRole('button', {
        name: 'Fechar',
      }),
    )
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(qtd).toThrow()
  })

  it('respostas que não são lista viram lista vazia; cadastrar cliente abre o cadastro', async () => {
    fake.quando('GET /clientes', null)
    fake.quando('GET /produtos', { outra: 1 })
    renderTela(<NovoPedidoModal open onClose={() => {}} />)
    const busca = screen.getByPlaceholderText('Digite o nome do cliente')
    fireEvent.focus(busca)
    await waitFor(() => expect(fake.feitas('GET', '/produtos')).toHaveLength(1))
    expect(screen.getByText('Nenhum cliente encontrado')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar cliente/ }))
    expect(await screen.findAllByText(/Novo Cliente|Cadastrar Cliente/i)).toBeTruthy()
    expect(campo('Data do pedido *').value).toBe(hojeISO())
  })

  it('fechado não busca nada', () => {
    renderTela(<NovoPedidoModal open={false} onClose={() => {}} />)
    expect(fake.chamadas).toHaveLength(0)
  })
})
