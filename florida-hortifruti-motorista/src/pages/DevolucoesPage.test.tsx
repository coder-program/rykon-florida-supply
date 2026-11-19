import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { logar, renderTela } from '../test/render'
import { DevolucoesPage } from './DevolucoesPage'

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

const PEDIDO = {
  pedidoId: 'p1',
  pedidoNumero: 12,
  cliente: 'Mercado VV',
  entregueEm: '2026-11-10T12:00:00Z',
  etiquetaToken: 'tok-1',
  itens: [
    { produtoId: 'a', nome: 'Morango', quantidade: 4 },
    { produtoId: 'b', nome: 'Uva', quantidade: 2 },
  ],
}

const foto = (n: number) => new File([`f${n}`], `foto${n}.jpg`, { type: 'image/jpeg' })

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  zxing.callback = null
  zxing.falhar = false
  fake = apiFalsa(api)
  fake.quando('GET /devolucoes/pedidos', [
    PEDIDO,
    {
      ...PEDIDO,
      pedidoId: 'p2',
      pedidoNumero: 99,
      cliente: null,
      entregueEm: null,
      etiquetaToken: null,
      itens: [{ produtoId: 'a', nome: 'Morango', quantidade: 1 }],
    },
  ])
  fake.quando('GET /devolucoes/minhas', [])
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function campoQuantidade(nome: string) {
  return screen.getByText(nome).closest('div')!.parentElement!.querySelector('input')!
}

describe('Devoluções', () => {
  it('busca na lista de pedidos entregues', async () => {
    renderTela(<DevolucoesPage />)
    expect(await screen.findByText('#000012')).toBeTruthy()
    const busca = screen.getByPlaceholderText('Buscar por número ou cliente')
    fireEvent.change(busca, { target: { value: 'mercado' } })
    expect(screen.queryByText('#000099')).toBeNull()
    fireEvent.change(busca, { target: { value: '99' } })
    expect(screen.getByText('#000099')).toBeTruthy()
    fireEvent.change(busca, { target: { value: 'nada' } })
    expect(screen.getByText('Nenhum pedido encontrado.')).toBeTruthy()
  })

  it('lista vazia e resposta que não é lista', async () => {
    fake.quando('GET /devolucoes/pedidos', { erro: true })
    fake.quando('GET /devolucoes/minhas', null)
    renderTela(<DevolucoesPage />)
    expect(await screen.findByText('Nenhum pedido entregue ainda.')).toBeTruthy()
    expect(await screen.findByText('Nenhuma devolução registrada.')).toBeTruthy()
  })

  it('registra devolução com motivo por item e 3 fotos', async () => {
    fake.quando('POST /devolucoes', {})
    renderTela(<DevolucoesPage />)
    fireEvent.click(await screen.findByText('#000012'))
    const enviar = screen.getByRole('button', { name: 'Registrar devolução' })

    // Quantidade acima do pedido e negativa
    fireEvent.change(campoQuantidade('Morango'), { target: { value: '9' } })
    expect(screen.getByText(/não pode ser maior/)).toBeTruthy()
    fireEvent.change(campoQuantidade('Morango'), { target: { value: '-1' } })
    fireEvent.change(campoQuantidade('Morango'), { target: { value: '2' } })

    const fotos = document.querySelector('input[type=file]')!
    fireEvent.change(fotos, { target: { files: [foto(1)] } })
    expect(screen.getByText('Selecione exatamente 3 fotos da caixa devolvida')).toBeTruthy()
    fireEvent.change(fotos, { target: { files: null } })
    fireEvent.change(fotos, { target: { files: [foto(1), foto(2), foto(3)] } })
    expect(screen.getByText('foto1.jpg • foto2.jpg • foto3.jpg')).toBeTruthy()

    // Sem motivo: erro
    fireEvent.click(enviar)
    expect(await screen.findByText('Escolha o motivo da devolução de Morango')).toBeTruthy()

    const motivos = screen.getByText('Motivos').parentElement!
    fireEvent.click(within(motivos).getByRole('button', { name: 'Outros' }))
    fireEvent.click(enviar)
    expect(await screen.findByText('Escreva o motivo "Outros" de Morango')).toBeTruthy()
    fireEvent.click(within(motivos).getByRole('button', { name: 'Melado' }))
    fireEvent.change(within(motivos).getByPlaceholderText('Escreva o motivo'), {
      target: { value: ' sujo ' },
    })
    fireEvent.click(within(motivos).getByRole('button', { name: 'Melado' }))
    fireEvent.click(within(motivos).getByRole('button', { name: 'Melado' }))
    fireEvent.change(screen.getByPlaceholderText('Ex.: caixa com avaria'), {
      target: { value: ' amassada ' },
    })

    fireEvent.click(enviar)
    expect(await screen.findByText('Devolução registrada com sucesso')).toBeTruthy()
    const enviado = fake.feitas('POST', '/devolucoes')[0].data
    expect(enviado).toMatchObject({
      pedidoId: 'p1',
      observacao: 'amassada',
      itens: [
        { produtoId: 'a', quantidade: 2, motivos: ['OUTROS', 'MELADO'], motivoOutro: 'sujo' },
      ],
    })
    expect(enviado.fotos).toHaveLength(3)
    expect(enviado.fotos[0]).toMatch(/^data:image\/jpeg;base64,/)
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
    expect(screen.queryByText('Devolução registrada com sucesso')).toBeNull()
  })

  it('mesmo motivo para todos, item único e aviso some sozinho', async () => {
    fake.quando('POST /devolucoes', {})
    renderTela(<DevolucoesPage />)
    fireEvent.click(await screen.findByText('#000012'))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(campoQuantidade('Morango'), { target: { value: '1' } })
    fireEvent.change(campoQuantidade('Uva'), { target: { value: '1' } })
    expect(screen.getByText('Motivos (todos os itens)')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Refugo' }))
    fireEvent.change(document.querySelector('input[type=file]')!, {
      target: { files: [foto(1), foto(2), foto(3)] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar devolução' }))
    expect(await screen.findByText('Devolução registrada com sucesso')).toBeTruthy()
    expect(fake.feitas('POST', '/devolucoes')[0].data.itens).toEqual([
      { produtoId: 'a', quantidade: 1, motivos: ['REFUGO'] },
      { produtoId: 'b', quantidade: 1, motivos: ['REFUGO'] },
    ])
    await waitFor(() => expect(screen.queryByText('Devolução registrada com sucesso')).toBeNull(), {
      timeout: 4000,
    })

    // Pedido de um item: o seletor geral vale para ele
    fireEvent.click(screen.getByText('#000099'))
    expect(screen.getByText('Cliente')).toBeTruthy()
    fireEvent.change(campoQuantidade('Morango'), { target: { value: '1' } })
    expect(screen.getByText('Motivos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Trocar' }))
    expect(screen.getByPlaceholderText('Buscar por número ou cliente')).toBeTruthy()
  })

  it('erros ao enviar: sem item, sem fotos e erro da API', async () => {
    fake.quando('POST /devolucoes', new ErroApi(400, ['Pedido', 'já devolvido']))
    renderTela(<DevolucoesPage />)
    fireEvent.click(await screen.findByText('#000012'))
    fireEvent.change(document.querySelector('input[type=file]')!, {
      target: { files: [foto(1), foto(2), foto(3)] },
    })
    const enviar = screen.getByRole('button', { name: 'Registrar devolução' })
    fireEvent.click(enviar)
    expect(await screen.findByText('Informe ao menos um item devolvido')).toBeTruthy()

    fireEvent.change(campoQuantidade('Uva'), { target: { value: '' } })
    fireEvent.change(campoQuantidade('Uva'), { target: { value: '1' } })
    fireEvent.click(
      within(screen.getByText('Motivos').parentElement!).getByRole('button', { name: 'Estragado' }),
    )
    fireEvent.click(enviar)
    expect(await screen.findByText('Pedido já devolvido')).toBeTruthy()

    fake.quando('POST /devolucoes', new ErroApi(500, null))
    fireEvent.click(enviar)
    expect(await screen.findByText('Request failed with status code 500')).toBeTruthy()
  })

  it('foto que não dá para ler', async () => {
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.onerror?.(new ProgressEvent('error') as never)
    })
    renderTela(<DevolucoesPage />)
    fireEvent.click(await screen.findByText('#000099'))
    fireEvent.change(campoQuantidade('Morango'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Melado' }))
    fireEvent.change(document.querySelector('input[type=file]')!, {
      target: { files: [foto(1), foto(2), foto(3)] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Registrar devolução' }))
    expect(await screen.findByText('Falha ao ler imagem')).toBeTruthy()
    vi.restoreAllMocks()
  })

  it('busca pela etiqueta digitada', async () => {
    fake.quando('GET /devolucoes/etiqueta/:token', ({ url }) =>
      url.endsWith('ruim')
        ? new ErroApi(404, 'Etiqueta não encontrada')
        : url.endsWith('vazio')
          ? new ErroApi(500, null)
          : { ...PEDIDO, etiquetaToken: null },
    )
    renderTela(<DevolucoesPage />)
    const campo = await screen.findByPlaceholderText('Ex.: URL do QR ou token')
    const buscar = screen.getByRole('button', { name: 'Buscar' })
    fireEvent.click(buscar)
    expect(fake.chamadas.some((c) => c.url.startsWith('/devolucoes/etiqueta'))).toBe(false)

    fireEvent.change(campo, { target: { value: 'ruim' } })
    fireEvent.click(buscar)
    expect(await screen.findByText('Etiqueta não encontrada')).toBeTruthy()
    fireEvent.change(campo, { target: { value: 'vazio' } })
    fireEvent.click(buscar)
    expect(await screen.findByText('Request failed with status code 500')).toBeTruthy()

    fireEvent.change(campo, { target: { value: ' bom ' } })
    fireEvent.click(buscar)
    expect(await screen.findByText('Pedido #000012')).toBeTruthy()
  })

  it('escaneia a etiqueta com a câmera', async () => {
    fake.quando('GET /devolucoes/etiqueta/:token', PEDIDO)
    renderTela(<DevolucoesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear com câmera' }))
    await waitFor(() => expect(zxing.callback).toBeTruthy())
    act(() => zxing.callback!(null, { name: 'NotFoundException' }))
    act(() => zxing.callback!(null, null))
    act(() => zxing.callback!({ getText: () => '  ' }, null))
    act(() => zxing.callback!(null, { name: 'FormatException' }))
    expect(screen.getByText(/aproximar melhor a câmera/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar câmera' }))
    expect(zxing.stop).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Escanear com câmera' }))
    await waitFor(() => expect(zxing.callback).toBeTruthy())
    act(() => zxing.callback!({ getText: () => ' tok-1 ' }, null))
    expect(await screen.findByText('Pedido #000012')).toBeTruthy()
  })

  it('câmera sem permissão', async () => {
    zxing.falhar = true
    renderTela(<DevolucoesPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'Escanear com câmera' }))
    expect(await screen.findByText(/Não foi possível abrir a câmera/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Escanear com câmera' })).toBeTruthy()
  })

  it('minhas devoluções e o detalhe de cada uma', async () => {
    fake.quando('GET /devolucoes/minhas', [
      {
        id: 'd1',
        pedidoNumero: 12,
        status: 'CONCLUIDA',
        cliente: 'Mercado VV',
        etiquetaToken: 'tok',
        registradoPor: 'Zé',
        itensDevolvidos: '2x Morango (Melado)',
        quantidadeCaixas: 2,
        valorDevolucao: 60,
        itens: [
          { produtoId: 'a', nome: 'Morango', quantidade: 2, motivosTexto: 'Melado' },
          { nome: 'Sem id' },
        ],
        reembolso: { tipo: 'CAIXAS', quantidadeCaixas: 2, lote: '77', data: '2026-11-12' },
        observacao: 'amassada',
        resposta: 'ok',
        fotos: ['/uploads/1.jpg', '/uploads/2.jpg'],
        criadoEm: '2026-11-11T12:00:00Z',
      },
      {
        id: 'd2',
        pedidoNumero: null,
        status: 'NEGADA',
        cliente: null,
        resposta: 'fora do prazo',
        criadoEm: '2026-11-11',
        reembolso: { tipo: 'DINHEIRO', valor: 30, data: '2026-11-12' },
      },
      { id: 'd3', pedidoNumero: 3, status: 'PENDENTE', criadoEm: '2026-11-11', fotos: [] },
      {
        id: 'd4',
        pedidoNumero: 4,
        status: 'OUTRO',
        criadoEm: '2026-11-11',
        itens: [],
        valorDevolucao: null,
        quantidadeCaixas: 1,
      },
    ])
    renderTela(<DevolucoesPage />)
    fireEvent.click(await screen.findByText('Concluída'))
    const dialogo = screen
      .getByRole('button', { name: 'Fechar' })
      .closest('div[class*="fixed"]') as HTMLElement
    expect(within(dialogo).getByText('Motivos: Melado')).toBeTruthy()
    expect(within(dialogo).getByText(/2 caixa\(s\), lote 77/)).toBeTruthy()
    expect(within(dialogo).getAllByRole('img')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    fireEvent.click(screen.getAllByText('Cliente não identificado')[0])
    expect(screen.getByText(/R\$\s30,00/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByText('Aguardando aprovação'))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getAllByText('OUTRO')[0])
    expect(screen.getAllByText('Caixas devolvidas: 1').length).toBeGreaterThan(0)
  })
})
