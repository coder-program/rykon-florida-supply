import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela } from '../test/render'
import { UsuariosPage } from './UsuariosPage'

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

const abrir = () => renderTela(<UsuariosPage />)
const enviar = (modal: HTMLElement) => fireEvent.submit(modal.querySelector('form')!)

describe('Usuários', () => {
  it('lista, detalhes e edição com endereço', async () => {
    fake.quando('PUT /usuarios/:id', {})
    abrir()
    expect((await screen.findAllByText('Cesar')).length).toBe(2)
    expect(screen.getAllByText('Inativo').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sem endereço principal cadastrado').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Rua A, 10, Centro, Barueri, SP').length).toBeGreaterThan(0)

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[1])
    let modal = janela('Detalhes do usuário')
    expect(within(modal).getByText('529.982.247-25')).toBeTruthy()
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Fechar' })[1])
    expect(screen.queryByText('Detalhes do usuário')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[2])
    modal = janela('Detalhes do usuário')
    expect(within(modal).getAllByText('—').length).toBeGreaterThan(0)
    fireEvent.click(within(modal).getAllByRole('button', { name: 'Fechar' })[0])

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalhes' })[1])
    fireEvent.click(screen.getByRole('button', { name: /Editar cadastro/ }))
    modal = janela('Editar Usuário')
    expect(campo('CPF', modal).value).toBe('529.982.247-25')
    expect(campo('Telefone', modal).value).toBe('(11) 99999-8888')
    expect(campo('Data de nascimento', modal).value).toBe('1990-01-01')
    await waitFor(() => expect(campo('Cidade', modal).value).toBe('bar'))
    preencher('Complemento', '', modal)
    preencher('Ponto de referência', '', modal)
    enviar(modal)
    await waitFor(() => expect(fake.feitas('PUT', '/usuarios/v1')).toHaveLength(1))
    expect(fake.feitas('PUT', '/usuarios/v1')[0].data).toEqual({
      nome: 'Cesar',
      email: 'cesar@x',
      papel: 'SUPERVISOR',
      cpf: '529.982.247-25',
      dataNascimento: '1990-01-01',
      telefone: '(11) 99999-8888',
      whatsapp: '(11) 99999-8888',
      endereco: {
        cep: '06454-000',
        logradouro: 'Rua A',
        numero: '10',
        bairro: 'Centro',
        cidadeId: 'bar',
        principal: true,
      },
    })
    await waitFor(() => expect(screen.queryByText('Editar Usuário')).toBeNull())
  })

  it('edita usuário sem dados extras e muda a senha', async () => {
    fake.quando('PUT /usuarios/:id', {})
    abrir()
    fireEvent.click((await screen.findAllByRole('button', { name: 'Editar' }))[3])
    const modal = janela('Editar Usuário')
    expect(campo('CPF', modal).value).toBe('')
    preencher('Nova senha (deixe em branco para manter)', 'novaSenha', modal)
    enviar(modal)
    await waitFor(() =>
      expect(fake.feitas('PUT', '/usuarios/r1')[0]?.data).toEqual({
        nome: 'Valderir',
        email: 'val@x',
        papel: 'REVENDEDOR',
        tambemMotorista: false,
        senha: 'novaSenha',
      }),
    )
  })

  it('validações do cadastro operacional e erros da API', async () => {
    let tentativa = 0
    fake.quando('POST /usuarios', () => {
      tentativa += 1
      if (tentativa === 1) return new ErroApi(400, ['CPF já cadastrado', 'e-mail em uso'])
      if (tentativa === 2) return new ErroApi(500, '   ')
      return {}
    })
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: /Novo Usuário/ }))
    const modal = janela('Novo Usuário')
    expect(within(modal).getByText(/cadastro operacional completo/)).toBeTruthy()
    enviar(modal)
    for (const erro of [
      'Informe o nome.',
      'Informe o e-mail.',
      'Informe o CPF.',
      'Informe a data de nascimento.',
      'Informe o telefone.',
      'Informe o WhatsApp.',
      /Preencha CEP/,
    ]) {
      expect(within(modal).getByText(erro)).toBeTruthy()
    }

    preencher('Nome *', 'Jo', modal)
    preencher('CPF', '111.111.111-11', modal)
    preencher('Data de nascimento', '2999-01-01', modal)
    enviar(modal)
    expect(within(modal).getByText('Use pelo menos 3 caracteres.')).toBeTruthy()
    expect(within(modal).getByText('CPF inválido.')).toBeTruthy()
    expect(within(modal).getByText('A data de nascimento não pode ser futura.')).toBeTruthy()
    preencher('Nome *', 'x'.repeat(121), modal)
    preencher('CPF', '529.982.247-24', modal)
    enviar(modal)
    expect(within(modal).getByText('Use no máximo 120 caracteres.')).toBeTruthy()
    expect(within(modal).getByText('CPF inválido.')).toBeTruthy()

    // máscaras
    for (const [digitado, esperado] of [
      ['5', '5'],
      ['5299', '529.9'],
      ['5299822', '529.982.2'],
      ['52998224725', '529.982.247-25'],
    ]) {
      preencher('CPF', digitado, modal)
      expect(campo('CPF', modal).value).toBe(esperado)
    }
    for (const [digitado, esperado] of [
      ['', ''],
      ['1', '(1'],
      ['1199', '(11) 99'],
      ['119999888', '(11) 9999-888'],
      ['11999998888', '(11) 99999-8888'],
    ]) {
      preencher('Telefone', digitado, modal)
      expect(campo('Telefone', modal).value).toBe(esperado)
    }
    preencher('WhatsApp', '11988887777', modal)
    preencher('Nome *', '  Joana Silva  ', modal)
    preencher('E-mail *', ' jo@x ', modal)
    preencher('Data de nascimento', '1995-05-05', modal)
    preencher('Senha *', 'segredo', modal)
    preencher('CEP', '06454000', modal)
    preencher('Logradouro', 'Rua B', modal)
    preencher('Número', '5', modal)
    preencher('Complemento', 'casa', modal)
    preencher('Bairro', 'Alphaville', modal)
    await waitFor(() =>
      expect(within(campo('Estado', modal)).getByText('SP - São Paulo')).toBeTruthy(),
    )
    preencher('Estado', 'sp', modal)
    await waitFor(() => expect(within(campo('Cidade', modal)).getByText('Barueri')).toBeTruthy())
    preencher('Cidade', 'bar', modal)
    preencher('Ponto de referência', 'portaria', modal)

    enviar(modal)
    expect(await within(modal).findByText('CPF já cadastrado e-mail em uso')).toBeTruthy()
    expect(within(modal).getByText('Já existe usuário cadastrado com este CPF.')).toBeTruthy()
    expect(within(modal).getByText('Já existe usuário cadastrado com este e-mail.')).toBeTruthy()
    enviar(modal)
    expect(await within(modal).findByText('Não foi possível salvar o usuário.')).toBeTruthy()
    enviar(modal)
    await waitFor(() => expect(screen.queryByText('Novo Usuário', { selector: 'h2' })).toBeNull())
    expect(fake.feitas('POST', '/usuarios').at(-1)!.data).toEqual({
      nome: 'Joana Silva',
      email: 'jo@x',
      papel: 'VENDEDOR',
      senha: 'segredo',
      cpf: '529.982.247-25',
      dataNascimento: '1995-05-05',
      telefone: '(11) 99999-8888',
      whatsapp: '(11) 98888-7777',
      endereco: {
        cep: '06454000',
        logradouro: 'Rua B',
        numero: '5',
        complemento: 'casa',
        bairro: 'Alphaville',
        cidadeId: 'bar',
        pontoReferencia: 'portaria',
        principal: true,
      },
    })
  })

  it('equipe interna dispensa dados operacionais; cancelar fecha', async () => {
    fake.quando('POST /usuarios', {})
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: /Novo Usuário/ }))
    let modal = janela('Novo Usuário')
    fireEvent.click(within(modal).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByText('Novo Usuário', { selector: 'h2' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Novo Usuário/ }))
    modal = janela('Novo Usuário')
    preencher('Papel *', 'ADMINISTRATIVO', modal)
    expect(within(modal).getByText(/campos operacionais podem ficar opcionais/)).toBeTruthy()
    preencher('Nome *', 'Marcelo', modal)
    preencher('E-mail *', 'marcelo@x', modal)
    enviar(modal)
    await waitFor(() =>
      expect(fake.feitas('POST', '/usuarios')[0]?.data).toEqual({
        nome: 'Marcelo',
        email: 'marcelo@x',
        papel: 'ADMINISTRATIVO',
      }),
    )
  })

  it('busca de CEP', async () => {
    const respostas: unknown[] = [
      { erro: true },
      {
        cep: '06454-000',
        logradouro: 'Al. Rio Negro',
        bairro: 'Alphaville',
        complemento: 'bloco 2',
        uf: 'sp',
        localidade: 'Barueri',
      },
      { uf: 'RJ', localidade: 'Niterói' },
      { uf: 'SP' },
    ]
    const buscar = vi.fn(async () => {
      const r = respostas.shift()
      if (!r) throw new Error('offline')
      return { json: async () => r }
    })
    vi.stubGlobal('fetch', buscar)
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: /Novo Usuário/ }))
    const modal = janela('Novo Usuário')
    await waitFor(() =>
      expect(within(campo('Estado', modal)).getByText('SP - São Paulo')).toBeTruthy(),
    )
    const botao = within(modal).getByRole('button', { name: 'Buscar CEP' })

    fireEvent.click(botao)
    preencher('CEP', '0645', modal)
    fireEvent.click(botao)
    expect(buscar).not.toHaveBeenCalled()

    preencher('CEP', '06454-000', modal)
    fireEvent.click(botao)
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1))
    expect(campo('Logradouro', modal).value).toBe('')

    fireEvent.click(botao)
    await waitFor(() => expect(campo('Logradouro', modal).value).toBe('Al. Rio Negro'))
    expect(campo('Bairro', modal).value).toBe('Alphaville')
    expect(campo('Complemento', modal).value).toBe('bloco 2')
    expect(campo('Estado', modal).value).toBe('sp')
    await waitFor(() => expect(campo('Cidade', modal).value).toBe('bar'))

    // estado sem correspondência mantém o atual; cidade não achada é limpa
    fireEvent.click(botao)
    await waitFor(() => expect(campo('Logradouro', modal).value).toBe(''))
    expect(campo('Estado', modal).value).toBe('sp')
    expect(campo('Cidade', modal).value).toBe('')

    fireEvent.click(botao)
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(4))
    fireEvent.click(botao)
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(5))
    expect(campo('CEP', modal).value).toBe('06454-000')
  })

  it('CEP sem estado escolhido não busca cidades', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => ({ uf: 'XX', localidade: 'Lugar' }) })),
    )
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: /Novo Usuário/ }))
    const modal = janela('Novo Usuário')
    preencher('CEP', '01001000', modal)
    fireEvent.click(within(modal).getByRole('button', { name: 'Buscar CEP' }))
    await waitFor(() => expect(campo('CEP', modal).value).toBe('01001000'))
    await new Promise((r) => setTimeout(r, 50))
    expect(campo('Estado', modal).value).toBe('')
  })

  it('desativa com confirmação e reativa', async () => {
    fake.quando('DELETE /usuarios/:id', {})
    fake.quando('POST /usuarios/:id/reativar', {})
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    abrir()
    const desativar = await screen.findAllByRole('button', { name: 'Desativar' })
    fireEvent.click(desativar[0])
    expect(confirmar).toHaveBeenCalledWith(expect.stringContaining('Desativar Duda Admin?'))
    expect(fake.feitas('DELETE', '/usuarios/adm')).toHaveLength(0)
    fireEvent.click(desativar[0])
    const tabelaDesativar = screen.getAllByRole('button', { name: 'Desativar' }).at(-1)!
    fireEvent.click(tabelaDesativar)
    await waitFor(() => expect(fake.feitas('DELETE', '/usuarios/adm')).toHaveLength(1))
    await waitFor(() => expect(fake.feitas('DELETE', '/usuarios/r1')).toHaveLength(1))

    const reativar = screen.getAllByRole('button', { name: 'Reativar' })
    fireEvent.click(reativar[0])
    fireEvent.click(reativar[1])
    await waitFor(() => expect(fake.feitas('POST', '/usuarios/m1/reativar')).toHaveLength(2))
  })

  it('lista vazia', async () => {
    fake.quando('GET /usuarios', [])
    abrir()
    expect(await screen.findByText('Nenhum usuário cadastrado.')).toBeTruthy()
  })

  it.each([
    [new ErroApi(403), /Sem permissão para visualizar usuários/],
    [new ErroApi(500, ['primeira falha', 'segunda']), /primeira falha/],
    [new ErroApi(500, 'servidor caiu'), /servidor caiu/],
    [new ErroApi(500, []), /Não foi possível carregar os usuários/],
  ])('erro ao carregar %#', async (erro, texto) => {
    fake.quando('GET /usuarios', erro)
    abrir()
    expect(await screen.findByText(texto)).toBeTruthy()
    fake.quando('GET /usuarios', [])
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Nenhum usuário cadastrado.')).toBeTruthy()
  })

  it('sessão expirada', async () => {
    fake.quando('GET /usuarios', new ErroApi(401))
    abrir()
    expect(await screen.findByText('Sessão expirada. Faça login novamente.')).toBeTruthy()
  })
})
