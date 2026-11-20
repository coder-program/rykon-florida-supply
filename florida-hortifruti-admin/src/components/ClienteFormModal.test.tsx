import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta, CLIENTE } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { ClienteFormModal } from './ClienteFormModal'
import { ContatosClienteModal } from './ContatosClienteModal'
import { BuscaCliente } from './BuscaCliente'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const enviar = (modal: HTMLElement) => fireEvent.submit(modal.querySelector('form')!)

describe('Formulário de cliente', () => {
  it('fechado não renderiza nada', () => {
    renderTela(<ClienteFormModal open={false} cliente={null} onClose={() => {}} />)
    expect(screen.queryByRole('heading')).toBeNull()
  })

  it('novo cliente: validações, máscaras, erros da API e salvar', async () => {
    let n = 0
    fake.quando('POST /clientes', () => {
      n += 1
      if (n === 1) return new ErroApi(400, ['CPF/CNPJ já cadastrado'])
      if (n === 2) return new ErroApi(500, '')
      if (n === 3) return new ErroApi(400, 'Nome repetido')
      return { id: 'novo', razaoSocialOuNome: 'Hortifruti Nova' }
    })
    const onSalvo = vi.fn()
    const onClose = vi.fn()
    renderTela(<ClienteFormModal open cliente={null} onClose={onClose} onSalvo={onSalvo} />)
    const modal = janela('Novo Cliente')

    enviar(modal)
    expect(within(modal).getByText('Informe o nome ou razão social.')).toBeTruthy()
    expect(within(modal).getByText('Informe o telefone.')).toBeTruthy()
    expect(within(modal).getByText(/Preencha CEP, logradouro/)).toBeTruthy()

    preencher('Razão Social / Nome *', 'Ab', modal)
    preencher('CNPJ / CPF', '123', modal)
    enviar(modal)
    expect(within(modal).getByText('Use pelo menos 3 caracteres.')).toBeTruthy()
    expect(within(modal).getByText('CPF ou CNPJ inválido.')).toBeTruthy()
    preencher('Razão Social / Nome *', 'x'.repeat(121), modal)
    for (const doc of [
      '111.111.111-11',
      '529.982.247-24',
      '11.111.111/1111-11',
      '11.222.333/0001-82',
      '11.222.333/0001-71',
    ]) {
      preencher('CNPJ / CPF', doc, modal)
      enviar(modal)
      expect(within(modal).getByText('CPF ou CNPJ inválido.')).toBeTruthy()
    }
    expect(within(modal).getByText('Use no máximo 120 caracteres.')).toBeTruthy()

    for (const [digitado, esperado] of [
      ['', ''],
      ['12', '12'],
      ['12345', '123.45'],
      ['12345678', '123.456.78'],
      ['5299822472', '529.982.247-2'],
      ['112223330', '112.223.330'],
      ['112223330001', '11.222.333/0001'],
      ['1122233300018', '11.222.333/0001-8'],
      ['11222333000181', '11.222.333/0001-81'],
    ]) {
      preencher('CNPJ / CPF', digitado, modal)
      expect(campo('CNPJ / CPF', modal).value).toBe(esperado)
    }
    for (const [digitado, esperado] of [
      ['', ''],
      ['1', '(1'],
      ['113', '(11) 3'],
      ['1133334444', '(11) 3333-4444'],
      ['11999998888', '(11) 99999-8888'],
    ]) {
      preencher('Telefone *', digitado, modal)
      expect(campo('Telefone *', modal).value).toBe(esperado)
    }
    preencher('WhatsApp', '11988887777', modal)
    preencher('Razão Social / Nome *', 'Hortifruti Nova', modal)
    preencher('Nome Fantasia', 'HN', modal)
    preencher('E-mail', 'hn@x', modal)
    preencher('Responsável pelo Contato', 'Bia', modal)
    preencher('CEP', '06454000', modal)
    preencher('Logradouro', 'Rua B', modal)
    preencher('Número', '5', modal)
    preencher('Complemento', 'fundos', modal)
    preencher('Bairro', 'Centro', modal)
    await waitFor(() =>
      expect(within(campo('Estado', modal)).getByText('SP - São Paulo')).toBeTruthy(),
    )
    preencher('Estado', 'sp', modal)
    await waitFor(() => expect(within(campo('Cidade', modal)).getByText('Barueri')).toBeTruthy())
    preencher('Cidade', 'bar', modal)
    preencher('Ponto de Referência', 'mercado', modal)
    preencher('Condição de Pagamento', '15 dias', modal)
    preencher('Forma de Pagamento Habitual', 'PIX', modal)
    fireEvent.click(within(modal).getByLabelText('Necessita Nota Fiscal'))
    preencher('Observações', 'entrega cedo', modal)

    enviar(modal)
    expect(await within(modal).findByText('CPF/CNPJ já cadastrado')).toBeTruthy()
    expect(within(modal).getByText('Já existe cliente cadastrado com este CPF/CNPJ.')).toBeTruthy()
    enviar(modal)
    expect(await within(modal).findByText('Não foi possível salvar o cliente.')).toBeTruthy()
    enviar(modal)
    expect(await within(modal).findByText('Nome repetido')).toBeTruthy()
    enviar(modal)
    await waitFor(() =>
      expect(onSalvo).toHaveBeenCalledWith({ id: 'novo', razaoSocialOuNome: 'Hortifruti Nova' }),
    )
    expect(onClose).toHaveBeenCalled()
    expect(fake.feitas('POST', '/clientes').at(-1)!.data).toEqual({
      razaoSocialOuNome: 'Hortifruti Nova',
      nomeFantasia: 'HN',
      cnpjCpf: '11.222.333/0001-81',
      telefone: '(11) 99999-8888',
      whatsapp: '(11) 98888-7777',
      email: 'hn@x',
      responsavelContato: 'Bia',
      condicaoPagamento: '15 dias',
      formaPagamentoUsual: 'PIX',
      necessitaNF: true,
      observacoes: 'entrega cedo',
      endereco: {
        cep: '06454000',
        logradouro: 'Rua B',
        numero: '5',
        complemento: 'fundos',
        bairro: 'Centro',
        estadoId: 'sp',
        cidadeId: 'bar',
        pontoReferencia: 'mercado',
        principal: true,
      },
    })
  })

  it('editar cliente existente (endereço não principal e sem dados)', async () => {
    fake.quando('PUT /clientes/:id', { id: 'c1' })
    const onClose = vi.fn()
    renderTela(<ClienteFormModal open cliente={CLIENTE as never} onClose={onClose} />)
    const modal = janela('Editar Cliente')
    await waitFor(() => expect(campo('Cidade', modal).value).toBe('bar'))
    expect(campo('CNPJ / CPF', modal).value).toBe('11.222.333/0001-81')
    enviar(modal)
    await waitFor(() => expect(fake.feitas('PUT', '/clientes/c1')).toHaveLength(1))
    expect(onClose).toHaveBeenCalled()
    cleanup()

    renderTela(
      <ClienteFormModal
        open
        cliente={{
          id: 'c5',
          razaoSocialOuNome: 'Outro',
          cnpjCpf: null,
          enderecos: [{ id: 'e', principal: false, cep: '1', cidade: null }],
        }}
        onClose={() => {}}
      />,
    )
    const m2 = janela('Editar Cliente')
    expect(campo('CEP', m2).value).toBe('1')
    expect(campo('CNPJ / CPF', m2).value).toBe('')
    expect(campo('Observações', m2).value).toBe('')
    cleanup()
    renderTela(
      <ClienteFormModal
        open
        cliente={{ id: 'c6', razaoSocialOuNome: 'Sem end' }}
        onClose={() => {}}
      />,
    )
    expect(campo('CEP', janela('Editar Cliente')).value).toBe('')
  })

  it('busca de CEP', async () => {
    const respostas: unknown[] = [
      { erro: true },
      {
        cep: '06454-000',
        logradouro: 'Al. Rio Negro',
        bairro: 'Alphaville',
        complemento: 'b2',
        uf: 'SP',
        localidade: 'barueri ',
      },
      { uf: 'MG', localidade: 'Belo Horizonte' },
      { uf: 'SP' },
    ]
    const buscar = vi.fn(async () => {
      const r = respostas.shift()
      if (!r) throw new Error('offline')
      return { json: async () => r }
    })
    vi.stubGlobal('fetch', buscar)
    renderTela(<ClienteFormModal open cliente={null} onClose={() => {}} />)
    const modal = janela('Novo Cliente')
    await waitFor(() =>
      expect(within(campo('Estado', modal)).getByText('SP - São Paulo')).toBeTruthy(),
    )
    const botao = within(modal).getByRole('button', { name: 'Buscar CEP' })
    fireEvent.click(botao)
    preencher('CEP', '064', modal)
    fireEvent.click(botao)
    expect(buscar).not.toHaveBeenCalled()
    preencher('CEP', '06454-000', modal)
    fireEvent.click(botao)
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1))
    fireEvent.click(botao)
    await waitFor(() => expect(campo('Logradouro', modal).value).toBe('Al. Rio Negro'))
    await waitFor(() => expect(campo('Cidade', modal).value).toBe('bar'))
    expect(campo('Complemento', modal).value).toBe('b2')
    fireEvent.click(botao)
    await waitFor(() => expect(campo('Logradouro', modal).value).toBe(''))
    expect(campo('Estado', modal).value).toBe('sp')
    expect(campo('Cidade', modal).value).toBe('')
    fireEvent.click(botao)
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(4))
    fireEvent.click(botao)
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(5))
  })

  it('CEP de estado desconhecido sem estado escolhido', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ uf: 'XX', localidade: 'Lugar' }) })),
    )
    renderTela(<ClienteFormModal open cliente={null} onClose={() => {}} />)
    const modal = janela('Novo Cliente')
    preencher('CEP', '01001000', modal)
    fireEvent.click(within(modal).getByRole('button', { name: 'Buscar CEP' }))
    await waitFor(() => expect(campo('Logradouro', modal).value).toBe(''))
    await new Promise((r) => setTimeout(r, 50))
    expect(campo('Estado', modal).value).toBe('')
  })
})

describe('Contatos do cliente', () => {
  it('fechado, lista e registro com erros', async () => {
    renderTela(<ContatosClienteModal cliente={null} onClose={() => {}} />)
    expect(screen.queryByRole('heading')).toBeNull()
    cleanup()

    let n = 0
    fake.quando('POST /clientes/:id/contatos', () => {
      n += 1
      if (n === 1) return new ErroApi(400, ['resumo curto', 'data inválida'])
      if (n === 2) return new ErroApi(400, 'sem permissão')
      return {}
    })
    fake.quando('GET /clientes/:id/contatos', [
      {
        id: 'ct1',
        tipo: 'VISITA',
        resumo: 'Pediu desconto',
        data: '2026-11-10T12:00:00Z',
        proximoContato: '2026-11-20T12:00:00Z',
        usuario: { nome: 'Cesar' },
      },
      {
        id: 'ct2',
        tipo: 'ESTRANHO',
        resumo: 'Sem usuário',
        data: '2026-11-11T12:00:00Z',
        proximoContato: null,
        usuario: null,
      },
    ])
    const onClose = vi.fn()
    renderTela(
      <ContatosClienteModal cliente={{ id: 'c1', razaoSocialOuNome: 'VV' }} onClose={onClose} />,
    )
    const modal = janela('Contatos — VV')
    expect(within(modal).getByText('Carregando...')).toBeTruthy()
    expect(await within(modal).findByText('10/11/2026 · Visita · Cesar')).toBeTruthy()
    expect(within(modal).getByText('Próximo contato: 20/11/2026')).toBeTruthy()
    expect(within(modal).getByText('11/11/2026 · ESTRANHO')).toBeTruthy()

    preencher('Tipo', 'WHATSAPP', modal)
    preencher('Data', '', modal)
    preencher('Próximo contato', '2026-12-01', modal)
    preencher('O que foi conversado *', 'Combinou pedido', modal)
    fireEvent.submit(modal.querySelector('form')!)
    expect(await within(modal).findByText('resumo curto data inválida')).toBeTruthy()
    fireEvent.submit(modal.querySelector('form')!)
    expect(await within(modal).findByText('sem permissão')).toBeTruthy()
    fireEvent.submit(modal.querySelector('form')!)
    await waitFor(() => expect(campo('O que foi conversado *', modal).value).toBe(''))
    expect(fake.feitas('POST', '/clientes/c1/contatos').at(-1)!.data).toEqual({
      tipo: 'WHATSAPP',
      resumo: 'Combinou pedido',
      proximoContato: '2026-12-01',
    })
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('sem contatos', async () => {
    fake.quando('GET /clientes/:id/contatos', [])
    renderTela(
      <ContatosClienteModal cliente={{ id: 'c1', razaoSocialOuNome: 'VV' }} onClose={() => {}} />,
    )
    expect(await screen.findByText('Nenhum contato registrado ainda')).toBeTruthy()
  })
})

describe('Busca de cliente', () => {
  const CLIENTES = [
    { id: 'c1', razaoSocialOuNome: 'São João Hortifruti', nomeFantasia: 'SJ' },
    { id: 'c2', razaoSocialOuNome: 'Padaria Sol', nomeFantasia: 'Padaria Sol' },
    { id: 'c3', razaoSocialOuNome: 'Bar do Zé', nomeFantasia: null },
  ]

  function Teste({ onCadastrar }: { onCadastrar?: () => void }) {
    const [id, setId] = useState('')
    return (
      <>
        <BuscaCliente
          clientes={CLIENTES}
          clienteId={id}
          onChange={setId}
          onCadastrar={onCadastrar}
        />
        <output data-testid="id">{id}</output>
      </>
    )
  }

  it('filtra sem acento, escolhe por clique e Enter, limpa e cadastra', () => {
    const cadastrar = vi.fn()
    render(<Teste onCadastrar={cadastrar} />)
    const input = screen.getByPlaceholderText('Digite o nome do cliente')
    fireEvent.focus(input)
    expect(screen.getAllByRole('button')).toHaveLength(4)
    expect(screen.getByText('SJ')).toBeTruthy()
    expect(screen.queryByText('Padaria Sol', { selector: 'span' })).toBeNull()

    fireEvent.change(input, { target: { value: 'sao' } })
    expect(screen.getAllByRole('button')).toHaveLength(2)
    fireEvent.mouseDown(screen.getByText('São João Hortifruti'))
    fireEvent.click(screen.getByText('São João Hortifruti'))
    expect(screen.getByTestId('id').textContent).toBe('c1')
    expect((input as HTMLInputElement).value).toBe('São João Hortifruti')

    fireEvent.click(screen.getByRole('button', { name: 'Limpar cliente' }))
    expect(screen.getByTestId('id').textContent).toBe('')

    fireEvent.change(input, { target: { value: 'zé' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('id').textContent).toBe('c3')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('id').textContent).toBe('c3')

    fireEvent.change(input, { target: { value: 'nada disso' } })
    expect(screen.getByText('Nenhum cliente encontrado')).toBeTruthy()
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByText('Nenhum cliente encontrado')).toBeNull()

    fireEvent.focus(input)
    fireEvent.click(screen.getByText('Cadastrar cliente'))
    expect(cadastrar).toHaveBeenCalled()
    expect(screen.queryByText('Cadastrar cliente')).toBeNull()
    fireEvent.focus(input)
    fireEvent.blur(input)
    expect(screen.queryByText('Bar do Zé')).toBeNull()
  })

  it('sem opção de cadastrar', () => {
    render(<Teste />)
    fireEvent.focus(screen.getByPlaceholderText('Digite o nome do cliente'))
    expect(screen.queryByText('Cadastrar cliente')).toBeNull()
    fireEvent.click(screen.getByText('Padaria Sol'))
    expect(screen.getByTestId('id').textContent).toBe('c2')
  })
})
