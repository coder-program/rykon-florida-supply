import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from './App'
import { api, resolveAssetUrl } from './lib/api'
import {
  caminhoAtual,
  mensagemErroLogin,
  temSessaoPainelAdmin,
  TOKEN_KEY,
  urlPedidoNoPainel,
  USUARIO_KEY,
  usuarioSalvo,
} from './lib/session'
import { carregarRascunho, limparRascunho, salvarRascunho } from './lib/draft'
import { apiFalsa, ErroApi } from './test/api-falsa'
import { logar, renderTela, USUARIO } from './test/render'
import { HomePage } from './pages/HomePage'
import { EstoquePage } from './pages/EstoquePage'
import { AbrirPedidoPage } from './pages/AbrirPedidoPage'
import { LoginPage } from './pages/LoginPage'
import { DetalhePedidoPage } from './pages/DetalhePedidoPage'

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  fake = apiFalsa(api)
  fake.quando('GET /pedidos', [])
  fake.quando('GET /devolucoes/minhas', [])
  fake.quando('GET /metas/hoje', { temMeta: false })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('sessão, rascunho e login', () => {
  it('sessão do app e do painel', () => {
    expect(usuarioSalvo()).toBeNull()
    localStorage.setItem(USUARIO_KEY, '{x')
    expect(usuarioSalvo()).toBeNull()
    logar({ ...USUARIO, papel: 'MOTORISTA' })
    expect(usuarioSalvo()).toBeNull()
    logar()
    expect(usuarioSalvo()).toMatchObject({ papel: 'VENDEDOR' })
    expect(caminhoAtual()).toBe('/')
    expect(urlPedidoNoPainel('a b')).toBe('/admin/abrir-pedido/a%20b')
    expect(temSessaoPainelAdmin()).toBe(false)
    localStorage.setItem('fh-admin:token', 't')
    expect(temSessaoPainelAdmin()).toBe(true)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado')
    })
    expect(temSessaoPainelAdmin()).toBe(false)
    expect(carregarRascunho()).toBeNull()
  })

  it('rascunho', () => {
    salvarRascunho({ a: 1 })
    expect(carregarRascunho()).toEqual({ a: 1 })
    limparRascunho()
    expect(carregarRascunho()).toBeNull()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cheio')
    })
    salvarRascunho({ b: 2 })
  })

  it('mensagens do login e arquivos', () => {
    expect(mensagemErroLogin({ response: { status: 403, data: { message: 'x' } } })).toBe('x')
    expect(mensagemErroLogin({ response: { status: 403 } })).toMatch(/não tem acesso/)
    expect(mensagemErroLogin(new Error('Este usuário não tem acesso a este app.'))).toMatch(
      /não tem acesso/,
    )
    expect(mensagemErroLogin({})).toBe('E-mail ou senha inválidos.')
    expect(resolveAssetUrl(undefined)).toBe('')
    expect(resolveAssetUrl('//cdn/a')).toBe('//cdn/a')
    expect(resolveAssetUrl('blob:x')).toBe('blob:x')
    expect(resolveAssetUrl('a.jpg')).toBe('/a.jpg')
  })

  it('401 manda para o login lembrando a tela', async () => {
    logar()
    fake.quando('GET /x', new ErroApi(401))
    window.history.pushState({}, '', '/pedido/9')
    await api.get('/x').catch(() => {})
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    window.history.pushState({}, '', '/login')
    await api.get('/x').catch(() => {})
    window.history.pushState({}, '', '/')
  })

  it('login com senha visível, erro e sucesso; QR leva ao painel', async () => {
    fake.quando('POST /auth/login', ({ data }) =>
      data.senha === 'errada' ? new ErroApi(401) : { access_token: 't', usuario: USUARIO },
    )
    renderTela(<LoginPage />, { rota: '/login?redirect=/abrir-pedido/tok%201', caminho: '/login' })
    expect(screen.getByText(/Abrir este pedido no painel/).getAttribute('href')).toBe(
      '/admin/abrir-pedido/tok%201',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar senha' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar senha' }))
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'c@x' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'errada' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'certa' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/abrir-pedido/tok 1'))
  })

  it('redirect para outro domínio vai para o início', () => {
    logar()
    for (const fora of ['//fora.com', '/%5Cfora.com']) {
      renderTela(<LoginPage />, { rota: `/login?redirect=${fora}`, caminho: '/login' })
      expect(screen.getByTestId('rota').textContent).toBe('/')
      cleanup()
    }
  })

  it('login com perfil de outro app e redirect inválido', async () => {
    fake.quando('POST /auth/login', {
      access_token: 't',
      usuario: { ...USUARIO, papel: 'CLIENTE' },
    })
    renderTela(<LoginPage />, { rota: '/login?redirect=http://fora' })
    expect(screen.queryByText(/Abrir este pedido no painel/)).toBeNull()
    fireEvent.change(screen.getByPlaceholderText('seu@email.com'), { target: { value: 'c@x' } })
    fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText(/não tem acesso a este app/)).toBeTruthy()
  })

  it('app inteiro: sem login vai ao login; logado vê os pedidos', async () => {
    window.history.pushState({}, '', '/estoque')
    const { unmount } = render(<App />)
    expect(await screen.findByPlaceholderText('seu@email.com')).toBeTruthy()
    unmount()
    logar()
    window.history.pushState({}, '', '/rota-que-nao-existe')
    render(<App />)
    expect(await screen.findByText('MEUS PEDIDOS')).toBeTruthy()
    window.history.pushState({}, '', '/')
  })
})

describe('início', () => {
  it('vendedor: meta do dia, devoluções pendentes, rascunho e pedidos', async () => {
    logar()
    salvarRascunho({ x: 1 })
    fake.quando('GET /pedidos', {
      data: [
        {
          id: 'p1',
          numero: 1,
          status: 'APROVADO',
          cliente: { razaoSocialOuNome: 'Mercado' },
          data: '2026-11-10',
          totalFinal: 100,
        },
        {
          id: 'p2',
          numero: 2,
          status: 'APROVADO',
          aguardandoAlteracao: true,
          data: '2026-11-10',
          totalFinal: 50,
        },
        { id: 'p3', numero: 3, status: 'XYZ', data: '2026-11-10', totalFinal: 0 },
      ],
    })
    fake.quando('GET /devolucoes/minhas', [{ status: 'PENDENTE' }, { status: 'NEGADA' }])
    fake.quando('GET /metas/hoje', {
      temMeta: true,
      percentual: 140,
      atingida: false,
      temAcumulado: true,
    })
    renderTela(<HomePage />)
    expect(await screen.findByText('140%')).toBeTruthy()
    expect(screen.getByText(/faltou no dia anterior/)).toBeTruthy()
    expect(await screen.findByText(/1 pendente\(s\)/)).toBeTruthy()
    expect(await screen.findByText('Aguardando alteração')).toBeTruthy()
    expect(screen.getByText('XYZ')).toBeTruthy()
    expect(fake.feitas('GET', '/pedidos')[0].params).toEqual({ vendedorId: 'v1' })

    fireEvent.click(screen.getByText('Rascunho salvo'))
    expect(screen.getByTestId('rota').textContent).toBe('/pedido/novo')
    fireEvent.click(screen.getByText('Mercado'))
    expect(screen.getByTestId('rota').textContent).toBe('/pedido/p1')
    fireEvent.click(screen.getByText('Novo Pedido'))
    fireEvent.click(screen.getByText('Devolução'))
    expect(screen.getByTestId('rota').textContent).toBe('/devolucoes')
    fireEvent.click(screen.getByRole('button', { name: 'Recarregar pedidos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('meta batida e formatos de lista da API', async () => {
    logar()
    fake.quando('GET /metas/hoje', {
      temMeta: true,
      percentual: 100,
      atingida: true,
      temAcumulado: true,
    })
    for (const corpo of [{ items: [] }, { results: [] }, { nada: 1 }, 'texto']) {
      fake.quando('GET /pedidos', corpo)
      const { unmount } = renderTela(<HomePage />)
      expect(await screen.findByText(/Nenhum pedido ainda/)).toBeTruthy()
      unmount()
    }
    fake.quando('GET /pedidos', {
      results: [{ id: 'r', numero: 1, status: 'ENTREGUE', data: '2026-11-10', totalFinal: 1 }],
    })
    fake.quando('GET /devolucoes/minhas', null)
    renderTela(<HomePage />)
    expect(await screen.findByText('Batida! 🎉')).toBeTruthy()
    expect(await screen.findByText('#000001')).toBeTruthy()
  })

  it('revendedor: estoque e sem meta', async () => {
    logar({ ...USUARIO, papel: 'REVENDEDOR' })
    renderTela(<HomePage />)
    fireEvent.click(await screen.findByText('Estoque'))
    expect(screen.getByTestId('rota').textContent).toBe('/estoque')
    expect(fake.feitas('GET', '/metas/hoje')).toHaveLength(0)
  })

  it('estoque por produto e lote', async () => {
    logar()
    fake.quando('GET /produtos', [
      { id: 'a', nome: 'Morango' },
      { id: 'b', nome: 'Uva' },
      { id: 'c', nome: 'Amora' },
    ])
    fake.quando('GET /estoque/lotes/disponiveis', [
      {
        id: 'l1',
        produtoId: 'a',
        numero: '7',
        dataEntrada: '2026-11-10T15:00:00Z',
        quantidadeDisponivel: 3,
      },
    ])
    renderTela(<EstoquePage />)
    expect(await screen.findByText('10/11 - lote 7')).toBeTruthy()
    const nomes = screen.getAllByText(/^(Morango|Uva|Amora)$/).map((e) => e.textContent)
    expect(nomes).toEqual(['Morango', 'Amora', 'Uva'])
    expect(screen.getAllByText('Sem caixas disponíveis')).toHaveLength(2)

    fake.quando('GET /produtos', 'x')
    fake.quando('GET /estoque/lotes/disponiveis', 'x')
    renderTela(<EstoquePage />)
  })
})

describe('abrir pedido pelo QR', () => {
  it('sem login vai ao login; com sessão do painel abre por lá', async () => {
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido/tok', caminho: '/abrir-pedido/:token' })
    expect(screen.getByTestId('rota').textContent).toBe('/login')
    cleanup()
    localStorage.setItem('fh-admin:token', 't')
    const replace = vi.fn()
    vi.stubGlobal('location', { ...window.location, replace })
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido/tok', caminho: '/abrir-pedido/:token' })
    expect(replace).toHaveBeenCalledWith('/admin/abrir-pedido/tok')
  })

  it('logado abre o pedido ou mostra o erro', async () => {
    logar()
    fake.quando(
      'GET /p/:token',
      ({ url }) =>
        ({
          '/p/ok': { pedidoId: 'p1' },
          '/p/sem': {},
          '/p/proibido': { pedidoId: 'p2' },
          '/p/sumiu': new ErroApi(404),
          '/p/falhou': new ErroApi(500),
        })[url],
    )
    fake.quando('GET /pedidos/:id', ({ url }) =>
      url === '/pedidos/p2' ? new ErroApi(403) : { id: 'p1' },
    )
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido/ok', caminho: '/abrir-pedido/:token' })
    expect(screen.getByText('Abrindo o pedido...')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/pedido/p1'))

    for (const [token, msg] of [
      ['sem', 'Pedido não encontrado.'],
      ['proibido', 'Você não tem acesso a este pedido.'],
      ['sumiu', 'Pedido não encontrado.'],
      ['falhou', 'Não foi possível abrir o pedido.'],
    ]) {
      cleanup()
      renderTela(<AbrirPedidoPage />, {
        rota: `/abrir-pedido/${token}`,
        caminho: '/abrir-pedido/:token',
      })
      expect(await screen.findByText(msg)).toBeTruthy()
    }
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByTestId('rota').textContent).toBe('/')
  })

  it('sem token volta ao início; desmontar no meio não mexe na tela', async () => {
    logar()
    renderTela(<AbrirPedidoPage />, { rota: '/abrir-pedido', caminho: '/abrir-pedido' })
    expect(screen.getByTestId('rota').textContent).toBe('/')
    cleanup()
    let responder: (v: unknown) => void = () => {}
    fake.quando('GET /p/:token', () => new Promise((r) => (responder = r)))
    const { unmount } = renderTela(<AbrirPedidoPage />, {
      rota: '/abrir-pedido/x',
      caminho: '/abrir-pedido/:token',
    })
    await waitFor(() => expect(fake.feitas('GET', '/p/x')).toHaveLength(1))
    unmount()
    await act(async () => responder({ pedidoId: 'p' }))
    cleanup()
    fake.quando('GET /p/:token', { pedidoId: 'p' })
    fake.quando('GET /pedidos/:id', () => new Promise((r) => (responder = r)))
    const segundo = renderTela(<AbrirPedidoPage />, {
      rota: '/abrir-pedido/y',
      caminho: '/abrir-pedido/:token',
    })
    await waitFor(() => expect(fake.feitas('GET', '/pedidos/p')).toHaveLength(1))
    segundo.unmount()
    await act(async () => responder({}))
    fake.quando(
      'GET /p/:token',
      () => new Promise((_, rej) => setTimeout(() => rej({ response: { status: 500 } }), 10)),
    )
    const terceiro = renderTela(<AbrirPedidoPage />, {
      rota: '/abrir-pedido/z',
      caminho: '/abrir-pedido/:token',
    })
    terceiro.unmount()
    await act(() => new Promise((r) => setTimeout(r, 30)))
  })
})

describe('detalhe do pedido', () => {
  const pedido = (extra: object = {}) => ({
    id: 'p1',
    numero: 5,
    status: 'APROVADO',
    data: '2026-11-10T12:00:00Z',
    vendedorId: 'v1',
    vendedor: { nome: 'Cesar' },
    cliente: { razaoSocialOuNome: 'Mercado' },
    formaPagamento: 'PIX',
    statusPagamento: 'EM_ABERTO',
    pagamentos: [],
    necessitaNF: true,
    necessitaRecibo: true,
    dataVencimento: '2026-11-20',
    observacoes: 'sem gelo',
    subtotal: 60,
    valorFrete: 10,
    descontoValor: 5,
    totalFinal: 65,
    itens: [
      {
        id: 'i1',
        produtoId: 'a',
        loteId: 'l1',
        quantidade: 2,
        valorUnitario: 30,
        produto: { nome: 'Morango' },
        lote: { numero: '7', dataEntrada: '2026-11-10T15:00:00Z' },
      },
      { id: 'i2', produtoId: 'b', loteId: null, quantidade: 0, valorUnitario: 0, produto: null },
    ],
    ...extra,
  })

  beforeEach(() => {
    logar()
    fake.quando('GET /pedidos/:id', pedido())
    fake.quando('GET /produtos', [{ id: 'b', estoqueAtual: 1 }])
    fake.quando('GET /estoque/lotes/disponiveis', [{ id: 'l1', quantidadeDisponivel: 1 }])
    fake.quando('GET /pedidos/:id/solicitacoes-alteracao', [])
    fake.quando('GET /pedidos/:id/lotes', {
      movimentos: [
        {
          id: 'm1',
          tipo: 'SAIDA',
          quantidade: 2,
          produtoNome: 'Morango',
          loteData: '2026-11-10T15:00:00Z',
          loteNumero: '7',
          origem: 'Pedido 5',
          saldoAntes: 5,
          saldoDepois: 3,
        },
        {
          id: 'm2',
          tipo: 'ENTRADA',
          quantidade: 1,
          produtoNome: 'Morango',
          loteData: '2026-11-10T15:00:00Z',
          loteNumero: '7',
          origem: 'Ajuste',
          saldoAntes: null,
        },
      ],
    })
  })
  const abrir = () =>
    renderTela(<DetalhePedidoPage />, { rota: '/pedido/p1', caminho: '/pedido/:id' })

  it('dados do pedido e solicitação de alteração no limite do lote', async () => {
    fake.quando('POST /pedidos/:id/solicitacoes-alteracao', {})
    abrir()
    expect(await screen.findByText('Pedido #000005')).toBeTruthy()
    expect(screen.getByText('Recibo de venda')).toBeTruthy()
    expect(screen.getByText('sem gelo')).toBeTruthy()
    expect(await screen.findByText(/saldo do lote 5 → 3 cx/)).toBeTruthy()
    expect(screen.getAllByText(/10\/11.*- lote 7/).length).toBeGreaterThan(0)

    const linhaMorango = screen.getByText('Morango').closest('div')!.parentElement!
    const [menos, mais] = within(linhaMorango).getAllByRole('button')
    await waitFor(() => expect(mais).toHaveProperty('disabled', false))
    fireEvent.click(mais)
    expect(mais).toHaveProperty('disabled', true)
    fireEvent.click(mais)
    fireEvent.click(menos)
    fireEvent.click(menos)
    fireEvent.click(menos)
    // Volta de 1 para 3 caixas (limite: saldo do lote + o que o pedido já tirou)
    fireEvent.click(mais)
    fireEvent.click(mais)
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar alteração' }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/pedidos/p1/solicitacoes-alteracao')).toHaveLength(1),
    )
    expect(fake.feitas('POST', '/pedidos/p1/solicitacoes-alteracao')[0].data.itens[0]).toEqual({
      produtoId: 'a',
      loteId: 'l1',
      quantidade: 3,
    })
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(screen.getByTestId('rota').textContent).toBe('/')
  })

  it('erro ao solicitar e solicitações anteriores', async () => {
    fake.quando('GET /pedidos/:id/solicitacoes-alteracao', [
      {
        id: 's1',
        status: 'NEGADA',
        resposta: 'sem estoque',
        quantidadeOriginal: 2,
        quantidadeSolicitada: 4,
        criadoEm: '2026-11-10',
      },
      {
        id: 's2',
        status: 'APROVADA',
        quantidadeOriginal: 2,
        quantidadeSolicitada: 3,
        criadoEm: '2026-11-10',
      },
    ])
    fake.quando(
      'POST /pedidos/:id/solicitacoes-alteracao',
      new ErroApi(400, ['Já existe', 'solicitação']),
    )
    abrir()
    expect(await screen.findByText('Motivo: sem estoque')).toBeTruthy()
    expect(screen.getByText('Pedido atualizado com a nova quantidade.')).toBeTruthy()
    const mais = within(screen.getByText('Morango').closest('div')!.parentElement!).getAllByRole(
      'button',
    )[1]
    await waitFor(() => expect(mais).toHaveProperty('disabled', false))
    fireEvent.click(mais)
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar alteração' }))
    expect(await screen.findByText('Já existe solicitação')).toBeTruthy()
    fake.quando('POST /pedidos/:id/solicitacoes-alteracao', new ErroApi(400, null))
    fireEvent.click(screen.getByRole('button', { name: 'Solicitar alteração' }))
    expect(await screen.findByText('Não foi possível enviar a solicitação.')).toBeTruthy()
  })

  it('pendente: aguarda o administrador', async () => {
    fake.quando('GET /pedidos/:id/solicitacoes-alteracao', [
      {
        id: 's',
        status: 'PENDENTE',
        quantidadeOriginal: 2,
        quantidadeSolicitada: 3,
        criadoEm: '2026-11-10',
      },
    ])
    logar({ ...USUARIO, papel: 'SUPERVISOR' })
    abrir()
    expect(await screen.findByText(/Aguarde o administrador/)).toBeTruthy()
    expect(screen.getAllByText('Aguardando alteração').length).toBeGreaterThan(0)
  })

  it('pedido enviado: salva direto', async () => {
    fake.quando(
      'GET /pedidos/:id',
      pedido({ status: 'ENVIADO', vendedor: null, valorFrete: 0, descontoValor: 0 }),
    )
    fake.quando('GET /estoque/lotes/disponiveis', [{ id: 'l1', quantidadeDisponivel: 9 }])
    fake.quando('PATCH /pedidos/:id', ({ data }) =>
      data.itens[1].quantidade > 1 ? new ErroApi(400, 'Sem saldo') : pedido({ status: 'ENVIADO' }),
    )
    abrir()
    const linhaUva = (await screen.findByText('Produtos'.toUpperCase())).parentElement!
      .parentElement!
    expect(screen.getByText(/salvas direto no pedido/)).toBeTruthy()
    const maisMorango = within(
      screen.getByText('Morango').closest('div')!.parentElement!,
    ).getAllByRole('button')[1]
    await waitFor(() => expect(maisMorango).toHaveProperty('disabled', false))
    fireEvent.click(maisMorango)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() => expect(fake.feitas('PATCH', '/pedidos/p1')).toHaveLength(1))
    expect(linhaUva).toBeTruthy()
    fake.quando('PATCH /pedidos/:id', new ErroApi(400, ['a', 'b']))
    await waitFor(() => expect(maisMorango).toHaveProperty('disabled', false))
    fireEvent.click(maisMorango)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('a b')).toBeTruthy()
    fake.quando('PATCH /pedidos/:id', new ErroApi(400, null))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    expect(await screen.findByText('Não foi possível salvar as alterações.')).toBeTruthy()
  })

  it('marcar como pago com a forma do pedido', async () => {
    fake.quando('POST /financeiro/marcar-pago/:id', {})
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: 'Marcar como pago' }))
    expect(screen.getByRole('combobox')).toHaveProperty('value', 'PIX')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como pago' }))
    fireEvent.change(document.querySelector('input[type=date]')!, {
      target: { value: '2026-11-15' },
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'DINHEIRO' } })
    fireEvent.click(screen.getByRole('button', { name: /Confirmar pagamento de R\$\s65,00/ }))
    await waitFor(() =>
      expect(fake.feitas('POST', '/financeiro/marcar-pago/p1')[0]?.data).toEqual({
        data: '2026-11-15',
        formaPagamento: 'DINHEIRO',
      }),
    )
  })

  it('pagar: forma antiga obriga escolher, erro da API e situações', async () => {
    fake.quando(
      'GET /pedidos/:id',
      pedido({ formaPagamento: 'BOLETO', pagamentos: [{ valor: 20, data: '2026-11-11' }] }),
    )
    fake.quando('POST /financeiro/marcar-pago/:id', new ErroApi(403, 'Só os seus'))
    abrir()
    expect(await screen.findByText('Em aberto · pago parcialmente')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Marcar como pago' }))
    const confirmar = screen.getByRole('button', { name: /Confirmar pagamento de R\$\s45,00/ })
    expect(confirmar).toHaveProperty('disabled', true)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'PIX' } })
    fireEvent.click(confirmar)
    expect(await screen.findByText('Só os seus')).toBeTruthy()
    fake.quando('POST /financeiro/marcar-pago/:id', new ErroApi(400, ['x', 'y']))
    fireEvent.click(confirmar)
    expect(await screen.findByText('x y')).toBeTruthy()
    fake.quando('POST /financeiro/marcar-pago/:id', new ErroApi(400, null))
    fireEvent.click(confirmar)
    expect(await screen.findByText('Não foi possível marcar como pago.')).toBeTruthy()
  })

  it('pago, vencido, outro vendedor e cancelado não mostram o botão', async () => {
    for (const [extra, texto] of [
      [
        { statusPagamento: 'PAGO', pagamentos: [{ valor: 65, data: '2026-11-12T12:00:00Z' }] },
        'Pago em 12/11/2026',
      ],
      [{ statusPagamento: 'PAGO', pagamentos: [] }, 'Pago'],
      [{ statusPagamento: 'VENCIDO', vendedorId: 'outro' }, 'Vencido'],
      [{ status: 'CANCELADO', necessitaNF: undefined, necessitaRecibo: false }, 'Em aberto'],
    ] as const) {
      cleanup()
      fake.quando('GET /pedidos/:id', pedido(extra))
      abrir()
      expect(await screen.findByText(texto)).toBeTruthy()
      expect(screen.queryByRole('button', { name: 'Marcar como pago' })).toBeNull()
    }
  })

  it('entregue: dados da entrega, devoluções e sem edição', async () => {
    fake.quando(
      'GET /pedidos/:id',
      pedido({
        status: 'ENTREGUE',
        entregueEm: '2026-11-12',
        recebidoPor: 'Ana',
        observacaoEntrega: 'portão',
        fotoEntrega: '/uploads/f.jpg',
        devolucoes: [
          {
            id: 'd1',
            data: '2026-11-13',
            etiquetaToken: 'tok',
            registradoPor: 'Zé',
            status: 'CONCLUIDA',
            itens: [{ produtoId: 'a', nome: 'Morango', quantidade: 1, valorTotal: 30 }],
            quantidadeCaixas: 1,
            valorDevolucao: 30,
            observacao: 'amassada',
            resposta: 'ok',
          },
          {
            id: 'd2',
            data: '2026-11-13',
            etiquetaToken: null,
            status: 'OUTRO',
            itens: [],
            itensDevolvidos: '1x Uva',
          },
          { id: 'd3', data: '2026-11-13', status: 'PENDENTE' },
        ],
      }),
    )
    abrir()
    expect(await screen.findByAltText('Foto da entrega')).toBeTruthy()
    expect(screen.getByText(/1x Morango · R\$\s30,00/)).toBeTruthy()
    expect(screen.getByText('1x Uva')).toBeTruthy()
    expect(screen.getByText('OUTRO')).toBeTruthy()
    expect(screen.getAllByText(/2 cx × R\$\s30,00/).length).toBeGreaterThan(0)
  })

  it('aguardando aprovação sem rastreio; revendedor vê a revenda', async () => {
    fake.quando(
      'GET /pedidos/:id',
      pedido({ status: 'AGUARDANDO_APROVACAO', precosRevenda: { a: 40 } }),
    )
    logar({ ...USUARIO, papel: 'REVENDEDOR' })
    abrir()
    expect(await screen.findByText('SUA REVENDA')).toBeTruthy()
    expect(screen.getByText('PRODUTOS (PREÇO DA FLÓRIDA)')).toBeTruthy()
    expect(fake.feitas('GET', '/pedidos/p1/lotes')).toHaveLength(0)
  })

  it('não encontrado', async () => {
    fake.quando('GET /pedidos/:id', new ErroApi(404))
    abrir()
    expect(await screen.findByText('Pedido não encontrado.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByTestId('rota').textContent).toBe('/')
  })

  describe('supervisor marca a entrega com foto', () => {
    beforeEach(() => {
      logar({ ...USUARIO, papel: 'SUPERVISOR' })
      vi.stubGlobal(
        'Image',
        class {
          width = 2000
          height = 1500
          onload?: () => void
          onerror?: () => void
          set src(v: string) {
            setTimeout(() => (v.includes('ruim') ? this.onerror?.() : this.onload?.()))
          }
        },
      )
      vi.spyOn(URL, 'createObjectURL').mockImplementation((f: any) => `blob:${f.name}`)
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        drawImage: vi.fn(),
      } as never)
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
        'data:image/jpeg;base64,eA==',
      )
    })
    const foto = (nome: string) => new File(['x'], nome, { type: 'image/jpeg' })

    it('valida a foto e confirma', async () => {
      fake.quando('POST /pedidos/:id/entregue', pedido({ status: 'ENTREGUE' }))
      fake.quando('GET /pedidos', [{ id: 'p1' }, { id: 'p9' }])
      const { client } = abrir()
      client.setQueryData(['meus-pedidos'], [{ id: 'p1' }, { id: 'p9' }])
      fireEvent.click(await screen.findByRole('button', { name: 'Marcar como entregue' }))
      const arquivo = document.querySelector('input[type=file]')!
      fireEvent.change(arquivo, { target: { files: [] } })
      fireEvent.change(arquivo, { target: { files: [foto('ruim.jpg')] } })
      expect(await screen.findByText('Não foi possível ler a foto.')).toBeTruthy()
      vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null)
      fireEvent.change(arquivo, { target: { files: [foto('a.jpg')] } })
      await act(() => new Promise((r) => setTimeout(r, 20)))
      fireEvent.change(arquivo, { target: { files: [foto('a.jpg')] } })
      expect(await screen.findByAltText('Prévia')).toBeTruthy()
      fireEvent.change(screen.getByPlaceholderText('Nome de quem pegou as caixas'), {
        target: { value: ' Ana ' },
      })
      fireEvent.change(screen.getByPlaceholderText(/deixei na porta/), {
        target: { value: ' fundo ' },
      })
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
      await waitFor(() => expect(fake.feitas('POST', '/pedidos/p1/entregue')).toHaveLength(1))
      expect(fake.feitas('POST', '/pedidos/p1/entregue')[0].data).toMatchObject({
        recebidoPor: 'Ana',
        observacaoEntrega: 'fundo',
      })
      expect(client.getQueryData<any[]>(['meus-pedidos'])?.[0].status).toBe('ENTREGUE')
    })

    it('erro da API, fechar o modal e cache vazio', async () => {
      fake.quando('POST /pedidos/:id/entregue', new ErroApi(400, ['Foto', 'grande']))
      abrir()
      fireEvent.click(await screen.findByRole('button', { name: 'Marcar como entregue' }))
      fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
      fireEvent.click(screen.getByRole('button', { name: 'Marcar como entregue' }))
      fireEvent.change(document.querySelector('input[type=file]')!, {
        target: { files: [foto('a.jpg')] },
      })
      expect(await screen.findByText('Trocar foto')).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
      expect(await screen.findByText('Foto grande')).toBeTruthy()
      fake.quando('POST /pedidos/:id/entregue', new ErroApi(400, null))
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
      expect(await screen.findByText('Não foi possível marcar como entregue.')).toBeTruthy()
      fake.quando('POST /pedidos/:id/entregue', pedido({ status: 'ENTREGUE' }))
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Confirmar entrega' })).toBeNull(),
      )
    })
  })
})
