import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { carregarRascunho, salvarRascunho } from '../lib/draft'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { logar, renderTela, USUARIO } from '../test/render'
import { NovoPedidoPage } from './NovoPedidoPage'

const PRODUTOS = [
  {
    id: 'a',
    nome: 'Morango',
    codigoInterno: 'M1',
    unidadeVenda: 'CX',
    estoqueAtual: 8,
    precoSugerido: 28,
  },
  {
    id: 'b',
    nome: 'Uva',
    codigoInterno: 'U1',
    unidadeVenda: 'CX',
    estoqueAtual: 0,
    precoSugerido: 40,
  },
  {
    id: 'c',
    nome: 'Amora',
    codigoInterno: 'A1',
    unidadeVenda: 'CX',
    estoqueAtual: 4,
    precoSugerido: 50,
  },
]
const LOTES = [
  {
    id: 'l1',
    produtoId: 'a',
    numero: '7',
    dataEntrada: '2026-11-10T15:00:00Z',
    quantidadeDisponivel: 5,
    precoSugeridoVenda: 30,
  },
  {
    id: 'l2',
    produtoId: 'a',
    numero: '8',
    dataEntrada: '2026-11-11T15:00:00Z',
    quantidadeDisponivel: 3,
    precoSugeridoVenda: null,
  },
  {
    id: 'l3',
    produtoId: 'c',
    numero: '9',
    dataEntrada: '2026-11-11T15:00:00Z',
    quantidadeDisponivel: 4,
  },
]

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiFalsa(api)
  fake.quando('GET /clientes', ({ params }) =>
    params?.busca === 'nada'
      ? []
      : {
          data: [
            {
              id: 'c1',
              razaoSocialOuNome: 'Mercado VV',
              nomeFantasia: 'VV',
              cnpjCpf: '12.345.678/0001-90',
            },
            { id: 'c2', razaoSocialOuNome: 'Padaria', cnpjCpf: 'SEM-DOC-1' },
            { id: 'c3', razaoSocialOuNome: 'Doceria', cidade: 'Barueri' },
            { id: 'c4', razaoSocialOuNome: 'Sorveteria' },
            { id: 'c5', razaoSocialOuNome: 'Bar', cnpjCpf: null },
          ],
        },
  )
  fake.quando('GET /produtos', { items: PRODUTOS })
  fake.quando('GET /estoque/lotes/disponiveis', { results: LOTES })
  fake.quando('GET /localidades/estados', [
    { id: 'sp', sigla: 'SP', nome: 'São Paulo' },
    { id: 'rj', sigla: 'RJ', nome: 'Rio' },
  ])
  fake.quando('GET /localidades/estados/:id/cidades', [
    { id: 'bar', nome: 'Barueri' },
    { id: 'sao', nome: 'São Paulo' },
  ])
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const abrir = () => renderTela(<NovoPedidoPage />)
const continuar = () => fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
// Cartão do produto na etapa de produtos
const cartao = (nome: string) =>
  screen.getByText(nome).closest('div[class*="bg-white rounded-xl border"]') as HTMLElement

async function esperarAvanco() {
  await act(() => new Promise((r) => setTimeout(r, 400)))
}

describe('Novo pedido', () => {
  it('fluxo completo: cliente, lotes, detalhes e envio', async () => {
    fake.quando('POST /pedidos', { id: 'novo' })
    abrir()
    // Voltar na primeira etapa sai para o início
    expect(await screen.findByText('Mercado VV')).toBeTruthy()
    expect(screen.getByText('VV')).toBeTruthy()
    expect(screen.getAllByText('CPF/CNPJ não informado')).toHaveLength(2)
    expect(screen.getByText('Barueri')).toBeTruthy()
    expect(screen.getByText('Cidade não informada')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome, CNPJ/), {
      target: { value: 'nada' },
    })
    await waitFor(() => expect(screen.queryByText('Mercado VV')).toBeNull())
    fireEvent.change(screen.getByPlaceholderText(/Buscar por nome, CNPJ/), {
      target: { value: '' },
    })
    fireEvent.click(await screen.findByText('Mercado VV'))

    // Produtos
    expect(await screen.findByText(/sem lote com saldo/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /Continuar/ })).toHaveProperty('disabled', true)
    fireEvent.click(screen.getByText('Morango'))
    expect(screen.getByText('Selecione o lote de cada produto para continuar.')).toBeTruthy()
    const morango = cartao('Morango')
    fireEvent.change(within(morango).getByRole('combobox'), { target: { value: 'l1' } })
    expect(
      within(morango).getByText(/Preço sugerido: R\$\s30,00\/cx • preço abaixo do sugerido/),
    ).toBeTruthy()
    const [menos, mais] = within(morango)
      .getAllByRole('button')
      .filter((b) => !b.textContent)
    for (let i = 0; i < 5; i++) fireEvent.click(mais)
    expect(within(morango).getByText(/Lote no limite/)).toBeTruthy()
    const qtd = within(morango).getByLabelText('Quantidade de caixas')
    fireEvent.change(qtd, { target: { value: '9' } })
    expect(screen.getByText(/Há lote com saldo insuficiente/)).toBeTruthy()
    expect(within(morango).getByText(/Saldo insuficiente: o lote tem 5 cx/)).toBeTruthy()
    fireEvent.change(qtd, { target: { value: '' } })
    fireEvent.blur(qtd)
    fireEvent.focus(qtd)
    fireEvent.change(qtd, { target: { value: '2' } })
    fireEvent.blur(qtd)
    fireEvent.change(within(morango).getAllByRole('spinbutton')[1], { target: { value: '31' } })
    fireEvent.change(within(morango).getAllByRole('spinbutton')[1], { target: { value: 'x' } })
    fireEvent.change(within(morango).getAllByRole('spinbutton')[1], { target: { value: '31' } })

    // Divide em outro lote: herda o preço; trocar o lote limita à quantidade do lote
    fireEvent.click(within(morango).getByRole('button', { name: /Dividir em outro lote/ }))
    const combos = within(cartao('Morango')).getAllByRole('combobox')
    expect(combos).toHaveLength(2)
    expect(within(cartao('Morango')).queryByRole('button', { name: /Dividir/ })).toBeNull()
    fireEvent.change(combos[1], { target: { value: 'l2' } })
    fireEvent.change(combos[1], { target: { value: '' } })
    fireEvent.change(combos[1], { target: { value: 'l2' } })
    // Linha que vai a zero sai
    fireEvent.click(menos)
    fireEvent.click(menos)
    expect(within(cartao('Morango')).getAllByRole('combobox')).toHaveLength(1)
    // Amora tem um lote só: já vem escolhido
    fireEvent.click(within(cartao('Amora')).getAllByRole('button')[1])
    expect(within(cartao('Amora')).getByRole('combobox')).toHaveProperty('value', 'l3')
    continuar()
    await esperarAvanco()

    // Detalhes
    fireEvent.change(document.querySelector('input[type=date]')!, {
      target: { value: '2020-01-01' },
    })
    expect(screen.getByText(/Venda de outro dia/)).toBeTruthy()
    const frete = screen.getAllByPlaceholderText('0,00')[0]
    fireEvent.focus(frete)
    fireEvent.change(frete, { target: { value: '1.234,5' } })
    fireEvent.blur(frete)
    expect(frete).toHaveProperty('value', '1.234,50')
    fireEvent.focus(frete)
    fireEvent.change(frete, { target: { value: '10' } })
    fireEvent.blur(frete)
    fireEvent.click(screen.getByLabelText('Frete incluso no preço'))

    fireEvent.click(screen.getByRole('button', { name: /R\$\s20,00/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Outros' }))
    const outros = screen.getAllByPlaceholderText('0,00')[1]
    fireEvent.focus(outros)
    fireEvent.change(outros, { target: { value: '7,5' } })
    fireEvent.blur(outros)
    expect(outros).toHaveProperty('value', '7,50')
    fireEvent.click(screen.getByRole('button', { name: '%' }))
    fireEvent.click(screen.getByRole('button', { name: '10%' }))
    fireEvent.click(screen.getByRole('button', { name: 'Outros' }))
    const pct = screen.getByPlaceholderText('Ex.: 12,5')
    fireEvent.focus(pct)
    fireEvent.change(pct, { target: { value: '12,5' } })
    fireEvent.blur(pct)
    expect(pct).toHaveProperty('value', '12,5')
    fireEvent.focus(pct)
    fireEvent.change(pct, { target: { value: '' } })
    fireEvent.blur(pct)
    fireEvent.click(screen.getByRole('button', { name: '%' }))
    fireEvent.click(screen.getByRole('button', { name: '5%'.replace('5', '50') }))
    fireEvent.click(screen.getByRole('button', { name: 'R$' }))

    fireEvent.click(screen.getByRole('button', { name: 'Faturado' }))
    fireEvent.change(document.querySelectorAll('input[type=date]')[1], {
      target: { value: '2026-12-01' },
    })
    fireEvent.change(screen.getByPlaceholderText(/Condição negociada/), {
      target: { value: '30 dias' },
    })
    fireEvent.click(screen.getByLabelText('Necessita Nota Fiscal'))
    fireEvent.click(screen.getByLabelText('Necessita Recibo de Venda'))
    fireEvent.change(screen.getByPlaceholderText(/Horário de entrega/), {
      target: { value: 'manhã' },
    })
    expect(screen.getByText('5/255')).toBeTruthy()
    continuar()
    await esperarAvanco()

    // Confirmação e envio
    expect(screen.getByText('Mercado VV')).toBeTruthy()
    expect(screen.getAllByText('✅ Sim')).toHaveLength(2)
    expect(screen.getByText('manhã')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Enviar Pedido/ }))
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/'))
    expect(fake.feitas('POST', '/pedidos')[0].data).toMatchObject({
      clienteId: 'c1',
      data: '2020-01-01',
      valorFrete: 10,
      freteInclusoNoPreco: true,
      // Voltou para R$: vale o valor em reais digitado antes (7,50)
      descontoValor: 7.5,
      formaPagamento: 'FATURADO',
      dataVencimento: '2026-12-01',
      condicaoNegociada: '30 dias',
      necessitaNF: true,
      necessitaRecibo: true,
      observacoes: 'manhã',
      itens: [
        // A linha do lote 7 foi zerada no "−"; ficou a do lote 8, com o preço herdado
        { produtoId: 'a', quantidade: 1, valorUnitario: 31, loteId: 'l2' },
        { produtoId: 'c', quantidade: 1, valorUnitario: 50, loteId: 'l3' },
      ],
    })
    expect(carregarRascunho()).toBeNull()
  })

  it('rascunho com desconto percentual, erro no envio e voltar etapas', async () => {
    salvarRascunho({
      clienteId: 'c1',
      clienteNome: 'Mercado VV',
      itens: [
        {
          produtoId: 'a',
          nome: 'Morango',
          quantidade: 2,
          valorUnitario: 30,
          loteId: 'l1',
          loteLabel: '10/11 - lote 7',
        },
      ],
      valorFrete: 0,
      usarPercentual: true,
      descontoPercentual: 15,
      descontoValor: 0,
      formaPagamento: 'PIX',
    })
    fake.quando('POST /pedidos', new ErroApi(400, ['Sem saldo', 'no lote']))
    abrir()
    continuar()
    await esperarAvanco()
    continuar()
    await esperarAvanco()
    // 15% não é preset: o campo "Outros" já aparece preenchido
    expect(screen.getByPlaceholderText('Ex.: 12,5')).toHaveProperty('value', '15,0')
    fireEvent.click(screen.getByRole('button', { name: 'Outros' }))
    fireEvent.click(screen.getByRole('button', { name: 'R$' }))
    fireEvent.click(screen.getByRole('button', { name: 'Outros' }))
    fireEvent.click(screen.getByRole('button', { name: '%' }))
    continuar()
    await esperarAvanco()
    fireEvent.click(screen.getByRole('button', { name: /Enviar Pedido/ }))
    expect(await screen.findByText('Falha ao enviar pedido')).toBeTruthy()
    expect(screen.getByText('Sem saldo no lote')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))
    fake.quando('POST /pedidos', new ErroApi(500, null))
    fireEvent.click(screen.getByRole('button', { name: /Enviar Pedido/ }))
    expect(await screen.findByText('Não foi possível enviar o pedido.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

    // Voltar: confirmar -> detalhes -> produtos -> cliente -> início
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByTestId('rota').textContent).toBe('/')
  })

  it('revendedor: preço de venda, sem frete e desconto', async () => {
    logar({ ...USUARIO, papel: 'REVENDEDOR' })
    salvarRascunho({ clienteId: 'c3', clienteNome: 'Doceria', itens: [] })
    abrir()
    expect(await screen.findByPlaceholderText('Buscar pelo nome...')).toBeTruthy()
    continuar()
    await esperarAvanco()
    fireEvent.click(await screen.findByText('Amora'))
    expect(screen.getByText('Seu preço de venda (R$/cx):')).toBeTruthy()
    continuar()
    await esperarAvanco()
    expect(screen.getByText('Como você vai pagar a Flórida')).toBeTruthy()
    expect(screen.queryByText('Frete')).toBeNull()
  })

  describe('novo cliente', () => {
    const preencher = (campo: string, valor: string) =>
      fireEvent.change(screen.getByPlaceholderText(campo), { target: { value: valor } })

    async function abrirCadastro() {
      abrir()
      fireEvent.click(await screen.findByText('Novo cliente', { exact: false }))
      expect(await screen.findByText('Novo Cliente')).toBeTruthy()
    }

    it('valida nome, documento, telefone e endereço', async () => {
      await abrirCadastro()
      const cadastrar = screen.getByRole('button', { name: 'Cadastrar' })
      fireEvent.click(cadastrar)
      expect(screen.getByText('Informe o nome ou razão social.')).toBeTruthy()
      expect(screen.getByText('Informe o telefone.')).toBeTruthy()
      expect(screen.getByText('Endereço obrigatório')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

      preencher('Nome / Razão Social *', 'AB')
      expect(screen.getByText('Use pelo menos 3 caracteres.')).toBeTruthy()
      preencher('Nome / Razão Social *', 'Loja <script>')
      expect(screen.getByText('Use apenas letras, números e sinais básicos.')).toBeTruthy()
      preencher('Nome / Razão Social *', 'Loja da Ana')

      const doc = screen.getByPlaceholderText('CNPJ / CPF (opcional)') as HTMLInputElement
      for (const [digitado, esperado] of [
        ['1', '1'],
        ['1234', '123.4'],
        ['1234567', '123.456.7'],
        ['12345678901', '123.456.789-01'],
        ['123', '123'],
        ['123456789012', '12.345.678/9012'],
        ['1234567890123', '12.345.678/9012-3'],
        ['', ''],
      ]) {
        fireEvent.change(doc, { target: { value: digitado } })
        expect(doc.value).toBe(esperado)
      }
      for (const invalido of [
        '123',
        '111.111.111-11',
        '529.982.247-26',
        '11.111.111/1111-11',
        '11.222.333/0001-80',
      ]) {
        fireEvent.change(doc, { target: { value: invalido } })
        expect(screen.getByText('CPF ou CNPJ inválido.')).toBeTruthy()
      }
      fireEvent.change(doc, { target: { value: '529.982.247-25' } })
      expect(screen.queryByText('CPF ou CNPJ inválido.')).toBeNull()
      fireEvent.change(doc, { target: { value: '11.222.333/0001-81' } })
      expect(screen.queryByText('CPF ou CNPJ inválido.')).toBeNull()
      fireEvent.change(doc, { target: { value: '00.000.000/0001-91' } })
      expect(screen.queryByText('CPF ou CNPJ inválido.')).toBeNull()

      const tel = screen.getByPlaceholderText('Telefone *') as HTMLInputElement
      for (const [digitado, esperado] of [
        ['1', '(1'],
        ['119', '(11) 9'],
        ['1199998888', '(11) 9999-8888'],
        ['11999998888', '(11) 99999-8888'],
      ]) {
        fireEvent.change(tel, { target: { value: digitado } })
        expect(tel.value).toBe(esperado)
      }
      fireEvent.change(tel, { target: { value: '1111111111' } })
      expect(screen.getByText('Telefone inválido.')).toBeTruthy()
      fireEvent.change(tel, { target: { value: '119' } })
      expect(screen.getByText('Telefone inválido.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
      expect(await screen.findByText('Mercado VV')).toBeTruthy()
    })

    it('busca o CEP e cadastra', async () => {
      const fetchCep = vi.fn(async (url: string) => ({
        json: async () =>
          url.includes('00000000')
            ? { erro: true }
            : url.includes('11111111')
              ? { uf: 'MG', localidade: 'Belo Horizonte' }
              : url.includes('22222222')
                ? { uf: 'SP' }
                : {
                    uf: 'SP',
                    localidade: 'Barueri',
                    logradouro: 'Rua A',
                    bairro: 'Centro',
                    complemento: 'sala 1',
                  },
      }))
      vi.stubGlobal('fetch', fetchCep)
      fake.quando('POST /clientes', { id: 'novo', razaoSocialOuNome: 'Loja da Ana' })
      await abrirCadastro()
      await screen.findByRole('option', { name: 'SP - São Paulo' })

      const buscar = screen.getByRole('button', { name: 'Buscar CEP' })
      preencher('CEP *', '123')
      fireEvent.click(buscar)
      expect(await screen.findByText('CEP inválido')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }))

      preencher('CEP *', '00000-000')
      fireEvent.click(buscar)
      expect(await screen.findByText('Falha na busca de CEP')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

      // Estado não cadastrado e CEP sem cidade
      preencher('CEP *', '11111111')
      fireEvent.click(buscar)
      await waitFor(() => expect(fetchCep).toHaveBeenCalledTimes(2))
      preencher('CEP *', '22222222')
      fireEvent.click(buscar)
      await waitFor(() => expect(fetchCep).toHaveBeenCalledTimes(3))

      preencher('CEP *', '06454000')
      expect(screen.getByPlaceholderText('CEP *')).toHaveProperty('value', '06454-000')
      fireEvent.click(buscar)
      await waitFor(() =>
        expect(screen.getByPlaceholderText('Logradouro *')).toHaveProperty('value', 'Rua A'),
      )
      const [estado, cidade] = screen.getAllByRole('combobox')
      expect(estado).toHaveProperty('value', 'sp')
      await waitFor(() => expect(cidade).toHaveProperty('value', 'bar'))
      fireEvent.change(estado, { target: { value: 'rj' } })
      fireEvent.change(estado, { target: { value: 'sp' } })
      await screen.findByRole('option', { name: 'São Paulo' })
      fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'sao' } })
      preencher('Número *', '10')
      preencher('Bairro *', 'Centro')
      preencher('Complemento *', 'sala 2')
      preencher('Logradouro *', 'Rua B')
      preencher('Ponto de referência *', 'perto da praça')
      preencher('Nome / Razão Social *', 'Loja da Ana')
      preencher('Telefone *', '11999998888')

      fake.quando('POST /clientes', new ErroApi(400, ['CPF', 'repetido']))
      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
      expect(await screen.findByText('Falha ao cadastrar cliente')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
      fake.quando('POST /clientes', new ErroApi(500, null))
      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
      expect(await screen.findAllByText('Não foi possível cadastrar o cliente.')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

      fake.quando('POST /clientes', { id: 'novo', razaoSocialOuNome: 'Loja da Ana' })
      fireEvent.click(screen.getByRole('button', { name: 'Cadastrar' }))
      expect(await screen.findByText('Morango')).toBeTruthy()
      expect(fake.feitas('POST', '/clientes').at(-1)?.data).toMatchObject({
        razaoSocialOuNome: 'Loja da Ana',
        telefone: '(11) 99999-8888',
        endereco: { cidadeId: 'sao', complemento: 'sala 2', principal: true },
      })
    })

    it('busca de CEP com a rede fora', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
          throw new Error('offline')
        }),
      )
      await abrirCadastro()
      preencher('CEP *', '06454000')
      fireEvent.click(screen.getByRole('button', { name: 'Buscar CEP' }))
      expect(await screen.findByText('Falha na busca de CEP')).toBeTruthy()
    })
  })
})
