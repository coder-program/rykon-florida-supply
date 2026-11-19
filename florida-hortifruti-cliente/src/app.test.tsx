import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { api } from './lib/api'
import { lerCarrinho, salvarCarrinho } from './lib/cart'
import { ativarPush, desativarPush, estadoPush } from './lib/push'
import {
  caminhoAtual,
  mensagemErroLogin,
  TOKEN_KEY,
  USUARIO_KEY,
  usuarioSalvo,
} from './lib/session'
import { apiFalsa, ErroApi } from './test/api-falsa'
import { logar, renderTela, USUARIO } from './test/render'
import { Layout } from './components/Layout'
import { AtivarNotificacoes } from './components/AtivarNotificacoes'
import { LoginPage } from './pages/LoginPage'
import { DefinirSenhaPage } from './pages/DefinirSenhaPage'
import { ProdutosPage } from './pages/ProdutosPage'
import { CarrinhoPage } from './pages/CarrinhoPage'
import { PedidosPage } from './pages/PedidosPage'
import { PedidoDetalhePage } from './pages/PedidoDetalhePage'
import { AvisosPage } from './pages/AvisosPage'
import { ContaPage } from './pages/ContaPage'

const PRODUTOS = [
  {
    id: 'a',
    nome: 'Morango',
    unidadeVenda: 'CX',
    preco: 30,
    quantidadeAproximada: 12,
    disponibilidade: 'DISPONIVEL',
    categoria: { id: 'f', nome: 'Frutas' },
  },
  {
    id: 'b',
    nome: 'Alface',
    unidadeVenda: 'UN',
    preco: null,
    disponibilidade: 'POUCA_QUANTIDADE',
    categoria: { id: 'v', nome: 'Verduras' },
  },
  {
    id: 'c',
    nome: 'Uva',
    unidadeVenda: 'CX',
    preco: 40,
    disponibilidade: 'INDISPONIVEL',
    categoria: null,
  },
  { id: 'd', nome: 'Amora', unidadeVenda: 'CX', preco: 50, disponibilidade: 'OUTRA' },
]

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  fake = apiFalsa(api)
  fake.quando('GET /portal-cliente/notificacoes', [])
  fake.quando('GET /portal-cliente/produtos', PRODUTOS)
  fake.quando('GET /portal-cliente/pedidos', [])
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

// Navegador com suporte a push, para os testes de notificações
function comPush({ permissao = 'default', inscrito = false, pedir = 'granted' } = {}) {
  const inscricao = {
    endpoint: 'https://push/1',
    toJSON: () => ({ endpoint: 'https://push/1' }),
    unsubscribe: vi.fn(async () => true),
  }
  const pushManager = {
    getSubscription: vi.fn(async () => (inscrito ? inscricao : null)),
    subscribe: vi.fn(async () => inscricao),
  }
  vi.stubGlobal('Notification', {
    permission: permissao,
    requestPermission: vi.fn(async () => pedir),
  })
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => ({ pushManager })),
      ready: Promise.resolve({ pushManager }),
    },
  })
  return { inscricao, pushManager }
}
function semPush() {
  delete (navigator as any).serviceWorker
}

describe('sessão e carrinho', () => {
  it('sessão, erros de login e 401', async () => {
    expect(usuarioSalvo()).toBeNull()
    localStorage.setItem(USUARIO_KEY, '{x')
    expect(usuarioSalvo()).toBeNull()
    logar({ ...USUARIO, papel: 'VENDEDOR' })
    expect(usuarioSalvo()).toBeNull()
    logar()
    expect(usuarioSalvo()).toMatchObject({ papel: 'CLIENTE' })
    expect(caminhoAtual()).toBe('/')
    expect(mensagemErroLogin({ response: { status: 403, data: { message: 'x' } } })).toBe('x')
    expect(mensagemErroLogin({ response: { status: 403 } })).toMatch(/não tem acesso/)
    expect(mensagemErroLogin(new Error('Este usuário não tem acesso a este app.'))).toMatch(
      /não tem acesso/,
    )
    expect(mensagemErroLogin(null)).toBe('E-mail ou senha inválidos.')

    fake.quando('GET /x', new ErroApi(401))
    for (const rota of ['/pedidos', '/login', '/definir-senha']) {
      logar()
      window.history.pushState({}, '', rota)
      await api.get('/x').catch(() => {})
      expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    }
    window.history.pushState({}, '', '/')
  })

  it('carrinho guardado no aparelho', () => {
    expect(lerCarrinho()).toEqual([])
    localStorage.setItem('portal_carrinho', '{x')
    expect(lerCarrinho()).toEqual([])
    salvarCarrinho([{ produtoId: 'a', nome: 'M', unidadeVenda: 'CX', preco: 1, quantidade: 2 }])
    expect(lerCarrinho()).toHaveLength(1)
  })

  it('app: sem login vai ao login; logado vai aos produtos', async () => {
    semPush()
    window.history.pushState({}, '', '/conta')
    const { unmount } = render(<App />)
    expect(await screen.findByText('Área do cliente')).toBeTruthy()
    unmount()
    logar()
    window.history.pushState({}, '', '/qualquer')
    render(<App />)
    expect(await screen.findByText('Morango')).toBeTruthy()
    window.history.pushState({}, '', '/')
  })
})

describe('login e convite', () => {
  it('login: erro, perfil errado e sucesso com redirect', async () => {
    fake.quando('POST /auth/login', ({ data }) =>
      data.senha === 'errada'
        ? new ErroApi(401)
        : data.email === 'v@x'
          ? { access_token: 't', usuario: { ...USUARIO, papel: 'VENDEDOR' } }
          : { access_token: 't', usuario: USUARIO },
    )
    const { container } = renderTela(<LoginPage />, {
      rota: '/login?redirect=/pedidos',
      caminho: '/login',
    })
    const [email, senha] = Array.from(container.querySelectorAll('input'))
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    fireEvent.change(email, { target: { value: 'v@x' } })
    fireEvent.change(senha, { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()
    fireEvent.change(senha, { target: { value: 'certa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/não tem acesso a este app/)).toBeTruthy()
    fireEvent.change(email, { target: { value: 'c@x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/pedidos'))
  })

  it('redirect para outro domínio vai para o início', async () => {
    logar()
    for (const fora of ['//fora.com', '/%5Cfora.com']) {
      renderTela(<LoginPage />, { rota: `/login?redirect=${fora}`, caminho: '/login' })
      expect(screen.getByTestId('rota').textContent).toBe('/')
      cleanup()
    }
    renderTela(<LoginPage />, { rota: '/login?redirect=http://fora', caminho: '/login' })
    expect(screen.getByTestId('rota').textContent).toBe('/')
  })

  it('definir senha pelo convite', async () => {
    fake.quando('POST /auth/definir-senha', ({ data }) =>
      data.senha === 'curta1'
        ? new ErroApi(400, ['Senha', 'fraca'])
        : data.senha === 'nula12'
          ? new ErroApi(400, null)
          : { ok: true },
    )
    renderTela(<DefinirSenhaPage />, { rota: '/definir-senha' })
    const salvar = screen.getByRole('button', { name: 'Salvar senha' })
    expect(salvar).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByPlaceholderText('Cole o código do convite'), {
      target: { value: 'tok' },
    })
    const senha = screen.getByPlaceholderText('Nova senha (mín. 6)')
    fireEvent.change(senha, { target: { value: 'curta1' } })
    fireEvent.click(salvar)
    expect(await screen.findByText('Senha fraca')).toBeTruthy()
    fireEvent.change(senha, { target: { value: 'nula12' } })
    fireEvent.click(salvar)
    expect(await screen.findByText('Não foi possível definir a senha.')).toBeTruthy()
    fireEvent.change(senha, { target: { value: 'boa123' } })
    fireEvent.click(salvar)
    expect(await screen.findByRole('link', { name: 'Ir para o login' })).toBeTruthy()
    expect(fake.feitas('POST', '/auth/definir-senha').at(-1)?.data).toEqual({
      token: 'tok',
      senha: 'boa123',
    })

    cleanup()
    renderTela(<DefinirSenhaPage />, { rota: '/definir-senha?token=abc' })
    expect(screen.queryByPlaceholderText('Cole o código do convite')).toBeNull()
  })
})

describe('compras', () => {
  beforeEach(() => logar())

  it('catálogo: busca, categorias e carrinho', async () => {
    renderTela(
      <Layout>
        <ProdutosPage />
      </Layout>,
    )
    expect(await screen.findByText('~12 CX')).toBeTruthy()
    expect(screen.getByText('Pouca quantidade')).toBeTruthy()
    expect(screen.getAllByText('Disponível')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Verduras' }))
    expect(screen.queryByText('Morango')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Todas' }))
    fireEvent.change(screen.getByPlaceholderText('Buscar'), { target: { value: 'mor' } })
    expect(screen.queryByText('Alface')).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('Buscar'), { target: { value: '' } })

    // Botões na ordem do catálogo: Morango, Alface, Uva, Amora
    const botoes = () => screen.getAllByRole('button', { name: /Adicionar/ })
    fireEvent.click(botoes()[0])
    fireEvent.click(botoes()[0])
    fireEvent.click(botoes()[1])
    expect(lerCarrinho().map((i) => [i.produtoId, i.quantidade])).toEqual([
      ['a', 2],
      ['b', 1],
    ])
    expect(within(screen.getByRole('navigation')).getByText('3')).toBeTruthy()
    // Indisponível não entra
    expect(botoes()[2]).toHaveProperty('disabled', true)
    fireEvent.click(botoes()[2])
    window.dispatchEvent(new Event('storage'))
  })

  it('carrinho vazio e envio do pedido', async () => {
    const { unmount } = renderTela(<CarrinhoPage />)
    expect(screen.getByText('Seu carrinho está vazio')).toBeTruthy()
    unmount()

    salvarCarrinho([
      { produtoId: 'a', nome: 'Morango', unidadeVenda: 'CX', preco: 30, quantidade: 2 },
      { produtoId: 'b', nome: 'Alface', unidadeVenda: 'UN', preco: null, quantidade: 1 },
    ])
    fake.quando('POST /portal-cliente/pedidos', ({ data }) =>
      data.observacoes === 'erro'
        ? new ErroApi(400, ['Sem', 'estoque'])
        : data.observacoes === 'nulo'
          ? new ErroApi(500, null)
          : { id: 'p' },
    )
    renderTela(<CarrinhoPage />)
    const linhaAlface = screen.getByText('Alface').closest('article')!
    fireEvent.click(within(linhaAlface).getAllByRole('button')[0])
    expect(screen.queryByText('Alface')).toBeNull()
    const linha = screen.getByText('Morango').closest('article')!
    fireEvent.click(within(linha).getAllByRole('button')[1])
    expect(lerCarrinho()[0].quantidade).toBe(3)

    const obs = screen.getByPlaceholderText(/separar caixas menores/)
    fireEvent.change(obs, { target: { value: 'erro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fazer pedido' }))
    expect(await screen.findByText('Sem estoque')).toBeTruthy()
    fireEvent.change(obs, { target: { value: 'nulo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fazer pedido' }))
    expect(await screen.findByText('Não foi possível enviar o pedido.')).toBeTruthy()
    fireEvent.change(obs, { target: { value: '  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fazer pedido' }))
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/pedidos'))
    expect(fake.feitas('POST', '/portal-cliente/pedidos').at(-1)?.data).toEqual({
      itens: [{ produtoId: 'a', quantidade: 3 }],
    })
    expect(lerCarrinho()).toEqual([])
  })

  it('meus pedidos', async () => {
    semPush()
    renderTela(<PedidosPage />)
    expect(await screen.findByText(/Quando seu primeiro pedido/)).toBeTruthy()
    cleanup()
    fake.quando('GET /portal-cliente/pedidos', [
      {
        id: 'p1',
        numero: 1,
        status: 'ENTREGUE',
        data: '2026-11-10',
        totalEstimado: 100,
        itens: [{}],
      },
      {
        id: 'p2',
        numero: 2,
        status: 'AGUARDANDO_APROVACAO',
        data: '2026-11-10',
        totalEstimado: null,
        itens: null,
      },
      { id: 'p3', numero: 3, status: 'OUTRO', data: '2026-11-10', totalEstimado: 5 },
    ])
    renderTela(<PedidosPage />)
    expect(await screen.findByText('#000001')).toBeTruthy()
    expect(screen.getByText('Sob consulta')).toBeTruthy()
    expect(screen.getByText('OUTRO')).toBeTruthy()
  })
})

describe('detalhe do pedido', () => {
  beforeEach(() => logar())
  const pedido = (extra: object = {}) => ({
    id: 'p1',
    numero: 7,
    status: 'AGUARDANDO_APROVACAO',
    data: '2026-11-10',
    totalEstimado: 60,
    observacoes: 'portão azul',
    itens: [
      { produtoId: 'a', nome: 'Morango', unidadeVenda: 'CX', quantidade: 2, valorUnitario: 30 },
    ],
    historicoStatus: [{ status: 'AGUARDANDO_APROVACAO', alteradoEm: '2026-11-10T12:00:00Z' }],
    ...extra,
  })
  const abrir = () =>
    renderTela(<PedidoDetalhePage />, { rota: '/pedidos/p1', caminho: '/pedidos/:id' })

  it('ajusta itens antes da aprovação', async () => {
    fake.quando('GET /portal-cliente/pedidos/:id', pedido())
    fake.quando('PUT /portal-cliente/pedidos/:id', ({ data }) =>
      data.itens.length === 3
        ? new ErroApi(400, ['Produto', 'indisponível'])
        : data.itens[0].quantidade === 1
          ? new ErroApi(400, null)
          : pedido(),
    )
    abrir()
    expect(await screen.findByText(/ainda pode ser ajustado/)).toBeTruthy()
    const salvar = screen.getByRole('button', { name: /Salvar alterações/ })
    expect(salvar).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: 'Diminuir quantidade' })).toHaveProperty(
      'disabled',
      false,
    )

    // Catálogo: busca, adicionar (Alface sem preço) e produto indisponível fora
    fireEvent.change(screen.getByPlaceholderText('Buscar no catálogo'), {
      target: { value: 'xyz' },
    })
    expect(screen.getByText('Nenhum produto encontrado.')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Buscar no catálogo'), { target: { value: 'al' } })
    fireEvent.click(await screen.findByText('Alface'))
    fireEvent.click(screen.getByText('Amora'))
    expect(screen.getByText('Todos os produtos disponíveis já estão no pedido.')).toBeTruthy()
    fireEvent.click(salvar)
    expect(await screen.findByText('Produto indisponível')).toBeTruthy()

    // Tira os dois incluídos e muda a quantidade
    // Linhas: Morango, Alface, Amora (as duas incluídas têm 1 caixa e saem)
    fireEvent.click(screen.getAllByRole('button', { name: 'Diminuir quantidade' })[2])
    fireEvent.click(screen.getAllByRole('button', { name: 'Diminuir quantidade' })[1])
    fireEvent.click(screen.getAllByRole('button', { name: 'Diminuir quantidade' })[0])
    fireEvent.click(salvar)
    expect(await screen.findByText('Não foi possível salvar.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    fireEvent.click(salvar)
    await waitFor(() =>
      expect(fake.feitas('PUT', '/portal-cliente/pedidos/p1').at(-1)?.data.itens).toEqual([
        { produtoId: 'a', quantidade: 3 },
      ]),
    )
  })

  it('entregue com linha do tempo; rejeitado sem; produto sem preço', async () => {
    fake.quando(
      'GET /portal-cliente/pedidos/:id',
      pedido({
        status: 'EM_ENTREGA',
        observacoes: null,
        totalEstimado: null,
        itens: [
          {
            produtoId: 'b',
            nome: 'Alface',
            unidadeVenda: 'UN',
            quantidade: 1,
            valorUnitario: null,
          },
        ],
        historicoStatus: undefined,
      }),
    )
    abrir()
    expect(await screen.findByText(/Acompanhe abaixo os itens/)).toBeTruthy()
    expect(screen.queryByPlaceholderText('Buscar no catálogo')).toBeNull()
    expect(screen.getByText('A caminho', { selector: 'span' })).toBeTruthy()
    cleanup()
    fake.quando('GET /portal-cliente/pedidos/:id', pedido({ status: 'REJEITADO' }))
    abrir()
    expect(await screen.findByText('Não aprovado')).toBeTruthy()
    cleanup()
    fake.quando('GET /portal-cliente/pedidos/:id', pedido({ status: 'XYZ', itens: [] }))
    abrir()
    expect(await screen.findByText('XYZ')).toBeTruthy()
  })
})

describe('avisos e notificações', () => {
  beforeEach(() => logar())

  it('avisos: marca como lidos ao abrir', async () => {
    semPush()
    fake.quando('GET /portal-cliente/notificacoes', [
      {
        id: '1',
        tipo: 'PEDIDO_A_CAMINHO',
        titulo: 'A caminho',
        mensagem: 'Saiu',
        criadoEm: '2026-11-10',
        lidaEm: null,
        pedidoId: 'p1',
      },
      {
        id: '2',
        tipo: 'OUTRO',
        titulo: 'Velho',
        mensagem: 'x',
        criadoEm: '2026-11-10',
        lidaEm: '2026-11-10',
        pedidoId: null,
      },
    ])
    fake.quando('POST /portal-cliente/notificacoes/lidas', { lidas: 1 })
    renderTela(
      <Layout>
        <AvisosPage />
      </Layout>,
    )
    expect(await screen.findByText('Novo')).toBeTruthy()
    expect(screen.getByRole('link', { name: '1 avisos novos' })).toBeTruthy()
    await waitFor(() =>
      expect(fake.feitas('POST', '/portal-cliente/notificacoes/lidas')).toHaveLength(1),
    )
    cleanup()
    fake.quando('GET /portal-cliente/notificacoes', [])
    renderTela(<AvisosPage />)
    expect(await screen.findByText('Nenhum aviso no momento.')).toBeTruthy()
  })

  it('estado do push no aparelho', async () => {
    semPush()
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPhone')
    expect(await estadoPush()).toBe('instalar-ios')
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as never)
    expect(await estadoPush()).toBe('indisponivel')
    vi.mocked(navigator, true)
    await desativarPush()

    comPush({ permissao: 'denied' })
    expect(await estadoPush()).toBe('bloqueado')
    comPush({ permissao: 'default' })
    expect(await estadoPush()).toBe('desativado')
    comPush({ permissao: 'granted', inscrito: true })
    expect(await estadoPush()).toBe('ativado')
    const { pushManager } = comPush({ permissao: 'granted' })
    expect(await estadoPush()).toBe('desativado')
    ;(navigator.serviceWorker.getRegistration as any).mockResolvedValue(undefined)
    expect(await estadoPush()).toBe('desativado')
    expect(pushManager).toBeTruthy()
  })

  it('ativar e desativar push', async () => {
    comPush({ pedir: 'denied' })
    expect(await ativarPush()).toBe('bloqueado')
    comPush({ pedir: 'default' })
    expect(await ativarPush()).toBe('desativado')

    fake.quando('GET /portal-cliente/push/chave-publica', { chavePublica: null })
    comPush()
    await expect(ativarPush()).rejects.toThrow('não estão configuradas')

    fake.quando('GET /portal-cliente/push/chave-publica', { chavePublica: 'BAbc-_1' })
    fake.quando('POST /portal-cliente/push/inscricao', {})
    const { pushManager } = comPush()
    expect(await ativarPush()).toBe('ativado')
    const [opcoes] = pushManager.subscribe.mock.calls[0] as unknown as [PushSubscriptionOptionsInit]
    expect(opcoes.applicationServerKey).toBeInstanceOf(Uint8Array)
    comPush({ inscrito: true })
    expect(await ativarPush()).toBe('ativado')

    fake.quando('DELETE /portal-cliente/push/inscricao', {})
    const { inscricao } = comPush({ inscrito: true })
    await desativarPush()
    expect(inscricao.unsubscribe).toHaveBeenCalled()
    comPush()
    await desativarPush()
  })

  it('convite para ativar notificações', async () => {
    fake.quando('GET /portal-cliente/push/chave-publica', { chavePublica: 'BAbc' })
    fake.quando('POST /portal-cliente/push/inscricao', {})
    comPush()
    renderTela(<AtivarNotificacoes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar notificações' }))
    await waitFor(() => expect(screen.queryByText(/Saiba quando/)).toBeNull())

    cleanup()
    fake.quando('GET /portal-cliente/push/chave-publica', { chavePublica: null })
    comPush()
    renderTela(<AtivarNotificacoes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar notificações' }))
    expect(await screen.findByText(/não estão configuradas/)).toBeTruthy()

    cleanup()
    const { pushManager } = comPush()
    ;(navigator as any).serviceWorker.ready = Promise.reject('x')
    ;(navigator as any).serviceWorker.ready.catch(() => {})
    fake.quando('GET /portal-cliente/push/chave-publica', { chavePublica: 'BAbc' })
    renderTela(<AtivarNotificacoes />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar notificações' }))
    expect(await screen.findByText('Não foi possível ativar as notificações')).toBeTruthy()
    expect(pushManager).toBeTruthy()

    cleanup()
    comPush({ permissao: 'denied' })
    renderTela(<AtivarNotificacoes />)
    expect(await screen.findByText(/estão bloqueadas/)).toBeTruthy()
    cleanup()
    semPush()
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('iPad')
    renderTela(<AtivarNotificacoes />)
    expect(await screen.findByText(/Adicionar à Tela de Início/)).toBeTruthy()
    cleanup()
    comPush({ permissao: 'granted' })
    ;(navigator.serviceWorker.getRegistration as any).mockRejectedValue(new Error('x'))
    renderTela(<AtivarNotificacoes />)
    await act(() => new Promise((r) => setTimeout(r, 20)))
    expect(screen.queryByText(/Saiba quando/)).toBeNull()
  })
})

describe('minha conta', () => {
  beforeEach(() => logar())
  const CONTA = {
    razaoSocialOuNome: 'Mercado VV',
    nomeFantasia: 'VV',
    email: 'vv@x',
    telefone: '1199',
    whatsapp: null,
    enderecos: [
      {
        logradouro: 'Rua A',
        numero: '1',
        bairro: 'Centro',
        cep: '06454',
        complemento: null,
        pontoReferencia: null,
        cidadeId: 'bar',
      },
    ],
  }

  it('edita os dados e o endereço', async () => {
    fake.quando('GET /portal-cliente/conta', CONTA)
    fake.quando('PATCH /portal-cliente/conta', ({ data }) =>
      data.telefone === '0'
        ? new ErroApi(400, ['Telefone', 'inválido'])
        : data.telefone === '1'
          ? new ErroApi(400, 'Recusado')
          : {},
    )
    renderTela(<ContaPage />)
    expect(await screen.findByText('Rua A, 1 — Centro')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Editar meus dados/ }))
    // Campo do formulário pelo rótulo (o cartão de cima também mostra "Telefone")
    const campo = (rotulo: string) =>
      within(screen.getByRole('button', { name: /Salvar dados/ }).closest('form')!)
        .getByText(rotulo)
        .closest('label')!
        .querySelector('input')!

    fireEvent.change(campo('Nome ou razão social'), { target: { value: ' ' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }))
    expect(await screen.findByText('Informe o nome do cliente')).toBeTruthy()
    fireEvent.change(campo('Nome ou razão social'), { target: { value: 'Mercado Novo' } })
    fireEvent.change(campo('Telefone'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }))
    expect(await screen.findByText('Informe o telefone')).toBeTruthy()
    fireEvent.change(campo('Telefone'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }))
    expect(await screen.findByText('Telefone inválido')).toBeTruthy()
    fireEvent.change(campo('Telefone'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }))
    expect(await screen.findByText('Recusado')).toBeTruthy()

    for (const [rotulo, valor] of [
      ['Nome fantasia', ''],
      ['E-mail', ''],
      ['WhatsApp', '1188'],
      ['Logradouro', 'Rua B'],
      ['Número', '2'],
      ['CEP', '06455'],
      ['Bairro', 'Alpha'],
      ['Complemento', 'sala'],
      ['Ponto de referência', 'praça'],
      ['Telefone', '1177'],
    ]) {
      fireEvent.change(campo(rotulo), { target: { value: valor } })
    }
    fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Salvar dados/ })).toBeNull())
    expect(fake.feitas('PATCH', '/portal-cliente/conta').at(-1)?.data).toEqual({
      razaoSocialOuNome: 'Mercado Novo',
      telefone: '1177',
      whatsapp: '1188',
      endereco: {
        cidadeId: 'bar',
        logradouro: 'Rua B',
        numero: '2',
        complemento: 'sala',
        bairro: 'Alpha',
        cep: '06455',
        pontoReferencia: 'praça',
        principal: true,
      },
    })

    fireEvent.click(screen.getByRole('button', { name: /Editar meus dados/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar edição' }))
    fireEvent.click(screen.getByRole('button', { name: /Editar meus dados/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  })

  it('conta sem endereço e sair', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    semPush()
    fake.quando('GET /portal-cliente/conta', { razaoSocialOuNome: 'M', enderecos: [] })
    fake.quando('PATCH /portal-cliente/conta', {})
    renderTela(<ContaPage />)
    expect(await screen.findByText('Sem endereço principal cadastrado')).toBeTruthy()
    expect(screen.getByText('Mantenha seus dados sempre atualizados')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Editar meus dados/ }))
    expect(screen.getByText(/não tem cidade vinculada/)).toBeTruthy()
    fireEvent.change(screen.getByText('Telefone').closest('label')!.querySelector('input')!, {
      target: { value: '11' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Salvar dados/ }))
    await waitFor(() =>
      expect(fake.feitas('PATCH', '/portal-cliente/conta')[0]?.data.endereco).toBeUndefined(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await act(() => vi.advanceTimersByTimeAsync(10))
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('sair espera no máximo 3 s pelo push', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    comPush({ inscrito: true })
    fake.quando('DELETE /portal-cliente/push/inscricao', () => new Promise(() => {}))
    fake.quando('GET /portal-cliente/conta', null)
    renderTela(<ContaPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await act(() => vi.advanceTimersByTimeAsync(3100))
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()

    logar()
    fake.quando('DELETE /portal-cliente/push/inscricao', new ErroApi(500))
    cleanup()
    renderTela(<ContaPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    await act(() => vi.advanceTimersByTimeAsync(50))
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})
