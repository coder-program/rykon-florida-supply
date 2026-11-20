import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { api, resolveAssetUrl } from './lib/api'
import {
  caminhoAtual,
  mensagemErroLogin,
  TOKEN_KEY,
  USUARIO_KEY,
  usuarioSalvo,
} from './lib/session'
import { apiFalsa, ErroApi, type Chamada } from './test/api-falsa'
import { apiCompleta } from './test/dados'
import { campo, janela, preencher } from './test/campos'
import { logar, renderTela, USUARIO } from './test/render'
import { LoginPage } from './pages/LoginPage'
import { AbrirPedidoPage } from './pages/AbrirPedidoPage'
import { FornecedoresPage } from './pages/FornecedoresPage'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  fake = apiCompleta(apiFalsa(api))
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.pushState({}, '', '/')
})

describe('sessão', () => {
  it('usuário salvo, mensagens e arquivos', () => {
    expect(usuarioSalvo()).toBeNull()
    localStorage.setItem(USUARIO_KEY, '{x')
    expect(usuarioSalvo()).toBeNull()
    logar({ ...USUARIO, papel: 'VENDEDOR' })
    expect(usuarioSalvo()).toBeNull()
    logar()
    expect(usuarioSalvo()).toMatchObject({ papel: 'ADMINISTRADOR' })
    expect(caminhoAtual()).toBe('/')
    expect(mensagemErroLogin({ response: { status: 403, data: { message: 'x' } } })).toBe('x')
    expect(mensagemErroLogin({ response: { status: 403 } })).toMatch(/não tem acesso/)
    expect(mensagemErroLogin(new Error('Este usuário não tem acesso a este app.'))).toMatch(
      /não tem acesso/,
    )
    expect(mensagemErroLogin({})).toBe('E-mail ou senha inválidos.')
    expect(resolveAssetUrl(null)).toBe('')
    expect(resolveAssetUrl('blob:x')).toBe('blob:x')
    expect(resolveAssetUrl('a.jpg')).toBe('/a.jpg')
  })

  it('401 desloga, menos no próprio login', async () => {
    logar()
    fake.quando('GET /x', new ErroApi(401))
    fake.quando('POST /auth/login', new ErroApi(401))
    await api.post('/auth/login', {}).catch(() => {})
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-teste')
    await api.get('/x').catch(() => {})
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('login em outra aba recarrega a página', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    logar()
    renderTela(<span>tela</span>)
    window.dispatchEvent(new StorageEvent('storage', { key: 'outra' }))
    expect(reload).not.toHaveBeenCalled()
    window.dispatchEvent(new StorageEvent('storage', { key: USUARIO_KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(reload).toHaveBeenCalledTimes(2)
  })
})

describe('login', () => {
  it('erros e entrada com redirect', async () => {
    fake.quando('POST /auth/login', ({ data }: Chamada) =>
      data.senha === 'errada'
        ? new ErroApi(401)
        : data.email === 'v@x'
          ? { access_token: 't', usuario: { ...USUARIO, papel: 'VENDEDOR' } }
          : { access_token: 't', usuario: USUARIO },
    )
    renderTela(<LoginPage />, { rota: '/login?redirect=/pedidos', caminho: '/login' })
    const email = screen.getByPlaceholderText('seu@email.com')
    const senha = screen.getByPlaceholderText('••••••••')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    fireEvent.change(email, { target: { value: 'd@x' } })
    fireEvent.change(senha, { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()
    fireEvent.change(email, { target: { value: 'v@x' } })
    fireEvent.change(senha, { target: { value: 'certa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/não tem acesso a este app/)).toBeTruthy()
    fireEvent.change(email, { target: { value: 'd@x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/pedidos'))
  })

  it('redirect para outro domínio vai ao início', () => {
    logar()
    for (const fora of ['//fora.com', '/%5Cfora.com', 'http://fora.com']) {
      renderTela(<LoginPage />, { rota: `/login?redirect=${fora}`, caminho: '/login' })
      expect(screen.getByTestId('rota').textContent).toBe('/')
      cleanup()
    }
  })
})

describe('layout, menu e permissões', () => {
  it('sem login: vai ao login guardando a tela', async () => {
    window.history.pushState({}, '', '/pedidos?x=1')
    render(<App />)
    expect(await screen.findByPlaceholderText('seu@email.com')).toBeTruthy()
    expect(window.location.search).toContain('redirect=%2Fpedidos%3Fx%3D1')
    cleanup()
    window.history.pushState({}, '', '/')
    render(<App />)
    expect(await screen.findByPlaceholderText('seu@email.com')).toBeTruthy()
  })

  it('administrador: menu completo, novos pedidos e sair', async () => {
    logar()
    localStorage.setItem('admin-menu-pedidos-vistos-em', 'abc')
    window.history.pushState({}, '', '/fornecedores')
    render(<App />)
    const menu = await screen.findByRole('navigation')
    expect(within(menu).getByText('Usuários')).toBeTruthy()
    expect(within(menu).getByText('Investimentos')).toBeTruthy()
    // Pedidos aguardando aprovação depois da última visita viram um número no menu
    expect(await within(menu).findByText('4')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    expect(document.body.style.overflow).toBe('hidden')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar menu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' }))
    fireEvent.click(document.querySelector('[aria-hidden="false"]')!)
    fireEvent.click(within(menu).getByText('Pedidos'))
    await waitFor(() => expect(within(menu).queryByText('4')).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Sair/ }))
    expect(await screen.findByPlaceholderText('seu@email.com')).toBeTruthy()
  })

  it('supervisor: só as telas dele e o app de entregas', async () => {
    logar({ ...USUARIO, papel: 'SUPERVISOR' })
    fake.quando('GET /pedidos', { nada: 1 })
    window.history.pushState({}, '', '/usuarios')
    render(<App />)
    const menu = await screen.findByRole('navigation')
    expect(within(menu).queryByText('Usuários')).toBeNull()
    expect(within(menu).getByText('Fornecedores')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Minhas entregas/ })).toBeTruthy()
    await waitFor(() => expect(window.location.pathname).toBe('/'))
  })

  it('visão geral: só dashboard e metas', async () => {
    logar({ ...USUARIO, papel: 'VISAO_GERAL' })
    window.history.pushState({}, '', '/pedidos')
    render(<App />)
    const menu = await screen.findByRole('navigation')
    expect(within(menu).getByText('Metas')).toBeTruthy()
    expect(within(menu).queryByText('Pedidos')).toBeNull()
    await waitFor(() => expect(window.location.pathname).toBe('/'))
    expect(fake.feitas('GET', '/pedidos')).toHaveLength(0)
  })

  it('administrativo abre as telas do financeiro', async () => {
    logar({ ...USUARIO, papel: 'ADMINISTRATIVO' })
    window.history.pushState({}, '', '/investimentos')
    render(<App />)
    expect(await screen.findAllByText(/Investimentos/)).toBeTruthy()
  })
})

describe('abrir pedido pelo QR', () => {
  beforeEach(() => logar())
  it('leva ao pedido ou mostra o erro', async () => {
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido/tok', caminho: '/abrir-pedido/:token' })
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/pedidos'))
    cleanup()
    fake.quando('GET /p/:token', ({ url }: Chamada) =>
      url.endsWith('sem') ? {} : new ErroApi(500),
    )
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido/sem', caminho: '/abrir-pedido/:token' })
    expect(await screen.findByText('Pedido não encontrado.')).toBeTruthy()
    cleanup()
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido/x', caminho: '/abrir-pedido/:token' })
    expect(await screen.findByText(/Não foi possível abrir/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ir para Pedidos' }))
    expect(screen.getByTestId('rota').textContent).toBe('/pedidos')
  })

  it('sem token e saída antes da resposta', async () => {
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido', caminho: '/abrir-pedido' })
    let responder: (v: unknown) => void = () => {}
    fake.quando('GET /p/:token', () => new Promise((r) => (responder = r)))
    const a = renderTela(<AbrirPedidoPage />, {
      rota: '/abrir-pedido/y',
      caminho: '/abrir-pedido/:token',
    })
    await waitFor(() => expect(fake.feitas('GET', '/p/y')).toHaveLength(1))
    a.unmount()
    await act(async () => responder({ pedidoId: 'p' }))
    fake.quando(
      'GET /p/:token',
      () => new Promise((_, rej) => setTimeout(() => rej(new Error('x')), 10)),
    )
    const b = renderTela(<AbrirPedidoPage />, {
      rota: '/abrir-pedido/z',
      caminho: '/abrir-pedido/:token',
    })
    b.unmount()
    await act(() => new Promise((r) => setTimeout(r, 30)))
  })
})

describe('fornecedores', () => {
  beforeEach(() => logar())

  it('filtra, cria, edita, desativa e reativa', async () => {
    fake.quando('POST /fornecedores', ({ data }: Chamada) =>
      data.nome === 'Repetido'
        ? new ErroApi(400, 'Já existe')
        : data.nome === 'Nulo'
          ? new ErroApi(500, null)
          : {},
    )
    fake.quando('PUT /fornecedores/:id', {})
    fake.quando('DELETE /fornecedores/:id', {})
    fake.quando('POST /fornecedores/:id/reativar', {})
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    renderTela(<FornecedoresPage />)
    expect((await screen.findAllByText('Ceasa')).length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Sítio Velho')).toHaveLength(0)
    fireEvent.change(campo('Status'), { target: { value: 'inativos' } })
    expect(screen.getAllByText('Sítio Velho').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sem documento ou telefone').length).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Reativar' })[0])
    fireEvent.change(campo('Status'), { target: { value: 'todos' } })
    fireEvent.change(screen.getByPlaceholderText('Nome, documento ou telefone'), {
      target: { value: '123' },
    })
    expect(screen.queryAllByText('Sítio Velho')).toHaveLength(0)
    fireEvent.change(screen.getByPlaceholderText('Nome, documento ou telefone'), {
      target: { value: 'nada' },
    })
    expect(screen.getAllByText(/Nenhum fornecedor/).length).toBeGreaterThan(0)
    fireEvent.change(screen.getByPlaceholderText('Nome, documento ou telefone'), {
      target: { value: '' },
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Desativar' })[0])
    fireEvent.click(screen.getAllByRole('button', { name: 'Desativar' })[0])
    await waitFor(() => expect(fake.feitas('DELETE', '/fornecedores/f1')).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: /Novo Fornecedor/ }))
    const modal = janela('Novo Fornecedor')
    preencher('Nome *', 'Repetido', modal)
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    expect(await within(modal).findByText('Já existe')).toBeTruthy()
    preencher('Nome *', 'Nulo', modal)
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    expect(await within(modal).findByText('Não foi possível salvar o fornecedor.')).toBeTruthy()
    preencher('Nome *', 'Novo', modal)
    preencher('CNPJ/CPF', '1', modal)
    preencher('Telefone', '2', modal)
    preencher('Observação', '3', modal)
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    await waitFor(() =>
      expect(screen.queryByText('Novo Fornecedor', { selector: 'h2' })).toBeNull(),
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[0])
    const editar = janela('Editar Fornecedor')
    expect(campo('Nome *', editar).value).toBe('Ceasa')
    fireEvent.click(within(editar).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(fake.feitas('PUT', '/fornecedores/f1')).toHaveLength(1))
    fireEvent.click(screen.getAllByRole('button', { name: 'Editar' })[1])
    fireEvent.click(within(janela('Editar Fornecedor')).getByRole('button', { name: 'Cancelar' }))
  })

  it('carregando e lista vazia', async () => {
    fake.quando('GET /fornecedores', [])
    renderTela(<FornecedoresPage />)
    expect(screen.getAllByText('Carregando...').length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/Nenhum fornecedor/)).length).toBeGreaterThan(0)
  })
})
