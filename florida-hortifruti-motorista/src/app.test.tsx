import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { api, resolveAssetUrl } from './lib/api'
import {
  caminhoAtual,
  mensagemErroLogin,
  TOKEN_KEY,
  USUARIO_KEY,
  usuarioSalvo,
} from './lib/session'
import { apiFalsa, ErroApi } from './test/api-falsa'
import { logar, renderTela, USUARIO } from './test/render'
import { EntregasPage } from './pages/EntregasPage'
import { EntregaDetalhePage } from './pages/EntregaDetalhePage'
import { ConfirmarPage } from './pages/ConfirmarPage'
import { ScannerPage } from './pages/ScannerPage'
import { Localizacao } from './components/Localizacao'

const zxing = vi.hoisted(() => ({
  callback: null as null | ((r: any, e: any) => void),
  falhar: false,
  stop: vi.fn(),
}))
vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class {
    decodeFromVideoDevice(_: unknown, __: unknown, cb: (r: any, e: any) => void) {
      zxing.callback = cb
      return zxing.falhar
        ? Promise.reject(new Error('sem câmera'))
        : Promise.resolve({ stop: zxing.stop })
    }
  },
}))

const ENTREGA = {
  id: 'p1',
  numero: 12,
  status: 'PRONTO_PARA_ENTREGA',
  cliente: { razaoSocialOuNome: 'Mercado VV', telefone: '1199' },
  endereco: {
    logradouro: 'Rua A',
    numero: '1',
    cidade: { nome: 'Barueri', estado: { sigla: 'SP' } },
  },
  itens: [{ produtoId: 'a', nome: 'Morango', quantidade: 2, unidadeVenda: 'CX' }],
  comprovante: null,
}

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  fake = apiFalsa(api)
  fake.quando('GET /motorista/entregas', [])
})
afterEach(() => {
  // Desmonta antes de devolver o navigator original (o GPS é solto ao desmontar)
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('sessão e login', () => {
  it('usuário salvo só vale para os perfis do app', () => {
    expect(usuarioSalvo()).toBeNull()
    localStorage.setItem(USUARIO_KEY, '{quebrado')
    expect(usuarioSalvo()).toBeNull()
    logar({ ...USUARIO, papel: 'VENDEDOR' })
    expect(usuarioSalvo()).toBeNull()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    logar()
    expect(usuarioSalvo()).toMatchObject({ papel: 'MOTORISTA' })
    expect(caminhoAtual()).toBe('/')
  })

  it('mensagens de erro do login', () => {
    expect(
      mensagemErroLogin({ response: { status: 403, data: { message: 'Use outro app' } } }),
    ).toBe('Use outro app')
    expect(mensagemErroLogin({ response: { status: 403, data: {} } })).toMatch(/não tem acesso/)
    expect(mensagemErroLogin(new Error('Este usuário não tem acesso a este app.'))).toMatch(
      /não tem acesso/,
    )
    expect(mensagemErroLogin({ response: { status: 401 } })).toBe('E-mail ou senha inválidos.')
  })

  it('endereço de arquivos da API', () => {
    expect(resolveAssetUrl(null)).toBe('')
    expect(resolveAssetUrl('https://x/a.jpg')).toBe('https://x/a.jpg')
    expect(resolveAssetUrl('data:image/png;base64,x')).toMatch(/^data:/)
    expect(resolveAssetUrl('uploads/a.jpg')).toBe('/uploads/a.jpg')
    expect(resolveAssetUrl('/uploads/a.jpg')).toBe('/uploads/a.jpg')
  })

  it('login: perfil errado, senha errada e sucesso', async () => {
    window.history.pushState({}, '', '/login')
    fake.quando('POST /auth/login', ({ data }) =>
      data.senha === 'errada'
        ? new ErroApi(401, 'Credenciais inválidas')
        : data.email === 'v@x'
          ? { access_token: 't', usuario: { ...USUARIO, papel: 'VENDEDOR' } }
          : { access_token: 't', usuario: USUARIO },
    )
    render(<App />)
    const email = await screen.findByPlaceholderText('E-mail')
    const senha = screen.getByPlaceholderText('Senha')
    const entrar = screen.getByRole('button', { name: 'Entrar' })

    fireEvent.change(email, { target: { value: 'ze@x' } })
    fireEvent.change(senha, { target: { value: 'errada' } })
    fireEvent.click(entrar)
    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeTruthy()

    fireEvent.change(email, { target: { value: 'v@x' } })
    fireEvent.change(senha, { target: { value: 'certa' } })
    fireEvent.click(entrar)
    expect(await screen.findByText(/não tem acesso a este app/)).toBeTruthy()

    fireEvent.change(email, { target: { value: 'ze@x' } })
    fireEvent.click(entrar)
    expect(await screen.findByText('Entregas de hoje')).toBeTruthy()
    expect(localStorage.getItem(TOKEN_KEY)).toBe('t')
    expect(fake.feitas('POST', '/auth/login')[0].data.app).toBe('motorista')

    // Sair volta ao login
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(await screen.findByPlaceholderText('E-mail')).toBeTruthy()
  })

  it('rota protegida sem login vai para o login; 401 da API desloga', async () => {
    window.history.pushState({}, '', '/scan')
    render(<App />)
    expect(await screen.findByPlaceholderText('E-mail')).toBeTruthy()

    logar()
    fake.quando('GET /motorista/entregas', new ErroApi(401))
    await api.get('/motorista/entregas').catch(() => {})
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(fake.chamadas.at(-1)).toBeTruthy()
  })

  it('token vai no cabeçalho e rota desconhecida volta para as entregas', async () => {
    logar()
    window.history.pushState({}, '', '/qualquer')
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: { watchPosition: () => 1, clearWatch: () => {} },
    })
    render(<App />)
    expect(await screen.findByText('Entregas de hoje')).toBeTruthy()
  })
})

describe('entregas', () => {
  beforeEach(() => logar())

  it('lista vazia e resumo', async () => {
    renderTela(<EntregasPage />)
    expect(await screen.findByText('Nenhuma entrega atribuída')).toBeTruthy()
  })

  it('lista com resumo por status', async () => {
    fake.quando('GET /motorista/entregas', [
      ENTREGA,
      { ...ENTREGA, id: 'p2', status: 'APROVADO', endereco: null, itens: undefined },
      { ...ENTREGA, id: 'p3', status: 'EM_ENTREGA' },
      { ...ENTREGA, id: 'p4', status: 'OUTRO' },
    ])
    localStorage.setItem(USUARIO_KEY, JSON.stringify({ ...USUARIO, nome: '' }))
    renderTela(<EntregasPage />)
    expect(await screen.findAllByText('#000012')).toHaveLength(4)
    expect(screen.getByText('Sem endereço')).toBeTruthy()
    expect(screen.getByText('0 itens')).toBeTruthy()
    expect(screen.getByText('OUTRO')).toBeTruthy()
    expect(screen.getByText('Motorista')).toBeTruthy()
  })

  it('detalhe: iniciar a entrega', async () => {
    fake.quando('GET /motorista/entregas/:id', ENTREGA)
    fake.quando('POST /motorista/entregas/:id/iniciar', { ...ENTREGA, status: 'EM_ENTREGA' })
    renderTela(<EntregaDetalhePage />, { rota: '/entrega/p1', caminho: '/entrega/:id' })
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(
      (await screen.findByRole('link', { name: /Abrir no mapa/ })).getAttribute('href'),
    ).toContain('Rua%20A')
    fireEvent.click(await screen.findByRole('button', { name: /Iniciar entrega/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Confirmar entrega/ }))
    expect(screen.getByTestId('rota').textContent).toBe('/entrega/p1/confirmar')
  })

  it('detalhe entregue com comprovante e sem telefone/endereço', async () => {
    fake.quando('GET /motorista/entregas/:id', {
      ...ENTREGA,
      status: 'ENTREGUE',
      endereco: null,
      cliente: { razaoSocialOuNome: 'M', whatsapp: '1188' },
      itens: [],
      comprovante: {
        fotoUrl: '/uploads/f.jpg',
        nomeRecebedor: 'Ana',
        dataHora: '2026-11-18T15:00:00Z',
      },
    })
    renderTela(<EntregaDetalhePage />, { rota: '/entrega/p1', caminho: '/entrega/:id' })
    expect(await screen.findByText('Recebido por: Ana')).toBeTruthy()
    expect(screen.getByText('1188')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()

    fake.quando('GET /motorista/entregas/:id', {
      ...ENTREGA,
      status: 'XYZ',
      cliente: { razaoSocialOuNome: 'M' },
      itens: [],
      comprovante: { fotoUrl: '/f.jpg' },
    })
    renderTela(<EntregaDetalhePage />, { rota: '/entrega/p2', caminho: '/entrega/:id' })
    expect(await screen.findByText('Telefone não informado')).toBeTruthy()
  })
})

describe('confirmar entrega', () => {
  beforeEach(() => {
    logar()
    // Imagem e canvas para comprimir a foto
    vi.stubGlobal(
      'Image',
      class {
        width = 2000
        height = 1000
        onload?: () => void
        onerror?: () => void
        set src(v: string) {
          setTimeout(() => (v.includes('ruim') ? this.onerror?.() : this.onload?.()))
        }
      },
    )
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(function (cb) {
      cb(new Blob(['x'], { type: 'image/jpeg' }))
    })
  })

  const foto = (nome = 'foto.jpg') => new File(['x'], nome, { type: 'image/jpeg' })

  it('envia nome, observação, foto e GPS', async () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: any) =>
      b instanceof File ? `blob:${b.name}` : 'blob:ok',
    )
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 1, longitude: 2 } } as never),
      },
    })
    fake.quando('POST /motorista/entregas/:id/confirmar', {})
    const { container } = renderTela(<ConfirmarPage />, {
      rota: '/entrega/p1/confirmar',
      caminho: '/entrega/:id/confirmar',
    })
    const botao = screen.getByRole('button', { name: 'Confirmar entrega' })
    expect(botao).toHaveProperty('disabled', true)

    fireEvent.change(container.querySelector('input:not([type])')!, { target: { value: ' Ana ' } })
    fireEvent.change(screen.getByPlaceholderText('Observação (opcional)'), {
      target: { value: ' portão ' },
    })
    const input = container.querySelector('input[type=file]')!
    fireEvent.change(input, { target: { files: [] } })
    fireEvent.change(input, { target: { files: [foto()] } })
    expect(await screen.findByAltText('Prévia')).toBeTruthy()
    fireEvent.click(botao)
    await waitFor(() => expect(screen.getByTestId('rota').textContent).toBe('/entrega/p1'))
    const body = fake.feitas('POST', '/motorista/entregas/p1/confirmar')[0].data as FormData
    expect(body.get('nomeRecebedor')).toBe('Ana')
    expect(body.get('observacao')).toBe('portão')
    expect(body.get('latitude')).toBe('1')
  })

  it('foto ilegível, canvas indisponível, GPS negado e erro da API', async () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b: any) =>
      b instanceof File ? `blob:${b.name}` : 'blob:ok',
    )
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        getCurrentPosition: (_: unknown, erro: PositionErrorCallback) => erro({} as never),
      },
    })
    fake.quando(
      'POST /motorista/entregas/:id/confirmar',
      new ErroApi(400, ['Já confirmada', 'Veja o pedido']),
    )
    const { container } = renderTela(<ConfirmarPage />, {
      rota: '/entrega/p1/confirmar',
      caminho: '/entrega/:id/confirmar',
    })
    const input = container.querySelector('input[type=file]')!

    fireEvent.change(input, { target: { files: [foto('ruim.jpg')] } })
    expect(await screen.findByText('Não foi possível ler a foto.')).toBeTruthy()

    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null)
    fireEvent.change(input, { target: { files: [foto()] } })
    await act(() => new Promise((r) => setTimeout(r, 20)))

    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementationOnce((cb) => cb(null))
    fireEvent.change(input, { target: { files: [foto()] } })
    await act(() => new Promise((r) => setTimeout(r, 20)))

    fireEvent.change(input, { target: { files: [foto()] } })
    expect(await screen.findByAltText('Prévia')).toBeTruthy()
    fireEvent.change(container.querySelector('input:not([type])')!, { target: { value: 'Ana' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByText('Já confirmada Veja o pedido')).toBeTruthy()

    fake.quando('POST /motorista/entregas/:id/confirmar', new ErroApi(400, 'Pedido cancelado'))
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar entrega' }))
    expect(await screen.findByText('Pedido cancelado')).toBeTruthy()
  })
})

describe('scanner', () => {
  beforeEach(() => {
    logar()
    zxing.falhar = false
    zxing.callback = null
  })

  it('lê o QR e marca a caminho', async () => {
    fake.quando('POST /motorista/entregas/scan', { numero: 7 })
    renderTela(<ScannerPage />)
    await waitFor(() => expect(zxing.callback).toBeTruthy())
    act(() => zxing.callback!(null, { name: 'NotFoundException' }))
    act(() => zxing.callback!(null, null))
    act(() => zxing.callback!({ getText: () => '  ' }, null))
    act(() => zxing.callback!(null, { name: 'ChecksumException' }))
    expect(screen.getByText(/aproximar melhor a câmera/)).toBeTruthy()
    act(() => zxing.callback!({ getText: () => ' token ' }, null))
    expect(await screen.findByText('Pedido #000007 está a caminho')).toBeTruthy()
    expect(fake.feitas('POST', '/motorista/entregas/scan')[0].data).toEqual({ token: 'token' })
    expect(zxing.stop).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Ver entregas' }))
    expect(screen.getByTestId('rota').textContent).toBe('/')
  })

  it('erros da leitura e da câmera', async () => {
    fake.quando('POST /motorista/entregas/scan', new ErroApi(404, ['Etiqueta', 'não encontrada']))
    const { unmount } = renderTela(<ScannerPage />)
    await waitFor(() => expect(zxing.callback).toBeTruthy())
    act(() => zxing.callback!({ getText: () => 't' }, null))
    expect(await screen.findByText('Etiqueta não encontrada')).toBeTruthy()
    fake.quando('POST /motorista/entregas/scan', new ErroApi(500, null))
    act(() => zxing.callback!({ getText: () => 't' }, null))
    expect(await screen.findByText('Não foi possível confirmar a leitura.')).toBeTruthy()
    unmount()

    zxing.falhar = true
    renderTela(<ScannerPage />)
    expect(await screen.findByText(/Não foi possível abrir a câmera/)).toBeTruthy()
  })
})

describe('localização', () => {
  beforeEach(() => logar())

  function gps() {
    const estado = {
      ok: null as null | PositionCallback,
      erro: null as null | PositionErrorCallback,
      clear: vi.fn(),
    }
    vi.stubGlobal('navigator', {
      ...navigator,
      geolocation: {
        watchPosition: (ok: PositionCallback, erro: PositionErrorCallback) => {
          estado.ok = ok
          estado.erro = erro
          return 1
        },
        clearWatch: estado.clear,
      },
    })
    return estado
  }
  const pos = (lat: number, accuracy = 5) =>
    ({ coords: { latitude: lat, longitude: -46, accuracy } }) as never

  it('envia a posição no máximo a cada 15 s ou quando anda', async () => {
    const g = gps()
    fake.quando('POST /motorista/entregas/localizacao', {})
    const { unmount } = renderTela(<Localizacao />)
    expect(screen.queryByText(/Localização/)).toBeNull()
    act(() => g.ok!(pos(-23)))
    expect(await screen.findByText('Localização ativa')).toBeTruthy()
    act(() => g.ok!(pos(-23.00001)))
    act(() => g.ok!(pos(-23.01, Infinity)))
    await waitFor(() =>
      expect(fake.feitas('POST', '/motorista/entregas/localizacao')).toHaveLength(2),
    )
    expect(fake.feitas('POST', '/motorista/entregas/localizacao')[1].data.precisao).toBeUndefined()

    fake.quando('POST /motorista/entregas/localizacao', new ErroApi(500))
    act(() => g.ok!(pos(-23.5)))
    await waitFor(() =>
      expect(fake.feitas('POST', '/motorista/entregas/localizacao')).toHaveLength(3),
    )
    unmount()
    expect(g.clear).toHaveBeenCalledWith(1)
  })

  it('permissão negada ou GPS indisponível', async () => {
    const g = gps()
    renderTela(<Localizacao />)
    act(() => g.erro!({ code: 1, PERMISSION_DENIED: 1 } as never))
    expect(await screen.findByText(/Localização bloqueada/)).toBeTruthy()
    act(() => g.erro!({ code: 2, PERMISSION_DENIED: 1 } as never))
    expect(await screen.findByText(/indisponível neste aparelho/)).toBeTruthy()
  })

  it('sem GPS no aparelho', async () => {
    const nav = { ...navigator }
    delete (nav as any).geolocation
    vi.stubGlobal('navigator', nav)
    renderTela(<Localizacao />)
    expect(await screen.findByText(/indisponível neste aparelho/)).toBeTruthy()
  })

  it('com entrega a caminho mantém a tela acesa', async () => {
    const g = gps()
    const release = vi.fn(async () => {})
    const request = vi.fn(async () => ({ release }))
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
    let visivel = 'visible'
    vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visivel as never)
    fake.quando('GET /motorista/entregas', [{ status: 'EM_ENTREGA' }])
    const { unmount } = renderTela(<Localizacao />)
    act(() => g.ok?.(pos(-23)))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/deixe o app aberto na rota/)).toBeTruthy()

    visivel = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    visivel = 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    request.mockRejectedValueOnce(new Error('negado'))
    document.dispatchEvent(new Event('visibilitychange'))
    unmount()
    await waitFor(() => expect(release).toHaveBeenCalled())
  })

  it('tela escondida não pede a trava; desmontar antes da resposta solta a trava', async () => {
    gps()
    const release = vi.fn(async () => {})
    let responder: (v: unknown) => void = () => {}
    const request = vi.fn(() => new Promise((r) => (responder = r)))
    vi.stubGlobal('navigator', { ...navigator, wakeLock: { request } })
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    fake.quando('GET /motorista/entregas', [{ status: 'EM_ENTREGA' }])
    const { unmount } = renderTela(<Localizacao />)
    await waitFor(() => expect(request).toHaveBeenCalled())
    unmount()
    responder({ release })
    await waitFor(() => expect(release).toHaveBeenCalled())

    vi.mocked(Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState')!.get!)
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    request.mockClear()
    renderTela(<Localizacao />)
    await act(() => new Promise((r) => setTimeout(r, 50)))
    expect(request).not.toHaveBeenCalled()
  })
})
