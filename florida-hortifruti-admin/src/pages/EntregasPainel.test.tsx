import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { api } from '../lib/api'
import { apiFalsa, ErroApi } from '../test/api-falsa'
import { apiCompleta } from '../test/dados'
import { campo, janela, preencher } from '../test/campos'
import { logar, renderTela, USUARIO } from '../test/render'
import { AcompanhamentoEntregasPage } from './AcompanhamentoEntregasPage'
import { PainelEntregas } from '../components/PainelEntregas'

// Leaflet não desenha no jsdom: guarda o que a tela pôs no mapa
const mapa = vi.hoisted(() => ({
  marcadores: [] as { tooltip: string; html: string; clique?: () => void }[],
  linhas: 0,
  enquadrou: 0,
  removido: 0,
}))
vi.mock('leaflet/dist/leaflet.css', () => ({}))
vi.mock('leaflet', () => {
  const grupo = {
    addTo: () => grupo,
    clearLayers: () => {
      mapa.marcadores.length = 0
      mapa.linhas = 0
    },
  }
  const L = {
    map: () => {
      const m = {
        setView: () => m,
        fitBounds: () => {
          mapa.enquadrou++
        },
        remove: () => {
          mapa.removido++
        },
      }
      return m
    },
    tileLayer: () => ({ addTo: () => {} }),
    layerGroup: () => grupo,
    divIcon: (o: { html: string }) => o,
    latLngBounds: (p: unknown) => p,
    polyline: () => ({
      addTo: () => {
        mapa.linhas++
      },
    }),
    marker: (_pos: unknown, o: { icon: { html: string } }) => {
      const reg: { tooltip: string; html: string; clique?: () => void } = {
        tooltip: '',
        html: o.icon.html,
      }
      const mk = {
        bindTooltip: (t: string) => {
          reg.tooltip = t
          return mk
        },
        on: (_e: string, fn: () => void) => {
          reg.clique = fn
          return mk
        },
        addTo: () => {
          mapa.marcadores.push(reg)
          return mk
        },
      }
      return mk
    },
  }
  return { default: L }
})

let fake: ReturnType<typeof apiFalsa>
beforeEach(() => {
  logar()
  fake = apiCompleta(apiFalsa(api))
  mapa.enquadrou = 0
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const agoraMenos = (min: number) => new Date(Date.now() - min * 60_000).toISOString()
const parada = (id: string, extra: object = {}) => ({
  id,
  numero: Number(id.slice(1)),
  status: 'PRONTO_PARA_ENTREGA',
  cliente: `Cliente ${id}`,
  endereco: `Rua ${id}`,
  latitude: -23.5,
  longitude: -46.6,
  ordemRota: 1,
  entregueEm: null,
  ...extra,
})

describe('Acompanhar entregas', () => {
  it('rotas no mapa, seleção de motorista e reordenação', async () => {
    let n = 0
    fake.quando('PUT /entregas/ordem', () => (++n === 1 ? new ErroApi(500) : {}))
    fake.quando('GET /entregas/acompanhamento', [
      {
        motorista: { id: 'm1', nome: 'Zé <Motorista>' },
        localizacao: {
          latitude: -23.5,
          longitude: -46.8,
          precisao: 10,
          atualizadoEm: agoraMenos(0),
        },
        emEntrega: parada('p5', { status: 'EM_ENTREGA', endereco: '' }),
        proximos: [parada('p6'), parada('p7', { latitude: null, endereco: '' })],
        entregues: [parada('p8', { entregueEm: agoraMenos(30) }), parada('p9', { latitude: null })],
        total: 5,
        concluidas: 2,
      },
      {
        motorista: { id: 'm2', nome: 'Ana' },
        localizacao: {
          latitude: -23.4,
          longitude: -46.7,
          precisao: null,
          atualizadoEm: agoraMenos(130),
        },
        emEntrega: null,
        proximos: [parada('p10')],
        entregues: [parada('p11')],
        total: 2,
        concluidas: 1,
      },
      {
        motorista: { id: 'm3', nome: 'Bia' },
        localizacao: null,
        emEntrega: null,
        proximos: [],
        entregues: [],
        total: 0,
        concluidas: 0,
      },
    ])
    renderTela(<AcompanhamentoEntregasPage />)
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(await screen.findByText('Zé <Motorista>')).toBeTruthy()
    expect(screen.getByText('Posição agora')).toBeTruthy()
    expect(screen.getByText('Posição há 2h10')).toBeTruthy()
    expect(screen.getByText('Sem posição (app fechado ou sem permissão)')).toBeTruthy()
    expect(screen.getByText('Entregando agora')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText('Nenhum pedido a caminho agora.')).toBeTruthy()
    expect(screen.getByText('Sem endereço')).toBeTruthy()
    expect(screen.getByLabelText('Endereço sem ponto no mapa')).toBeTruthy()
    expect(screen.getByText(/2 entregue\(s\) hoje · última há 30 min/)).toBeTruthy()
    expect(
      screen.getByText(/1 motorista\(s\) sem posição.*1 parada\(s\) ainda sem ponto/),
    ).toBeTruthy()

    await waitFor(() => expect(mapa.marcadores.length).toBe(5))
    expect(mapa.marcadores[0].tooltip).toContain('Zé &#60;Motorista&#62;')
    expect(mapa.marcadores.some((m) => m.html.includes('>A<'))).toBe(true)
    expect(mapa.marcadores[1].tooltip).toContain('A caminho agora')
    expect(mapa.marcadores.find((m) => m.html.includes('opacity:0.5'))).toBeTruthy()
    expect(mapa.linhas).toBe(2)
    expect(mapa.enquadrou).toBe(1)

    // clicar no motorista no mapa mostra só a rota dele, com as entregas feitas
    mapa.marcadores[0].clique!()
    await waitFor(() =>
      expect(mapa.marcadores.some((m) => m.tooltip.includes('· entregue'))).toBe(true),
    )
    expect(mapa.enquadrou).toBe(2)
    fireEvent.click(screen.getByRole('button', { name: 'Ver todos os motoristas' }))
    expect(screen.queryByRole('button', { name: 'Ver todos os motoristas' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }))
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }))
    expect(screen.queryByRole('button', { name: 'Ver todos os motoristas' })).toBeNull()

    const descer = screen.getAllByRole('button', { name: 'Descer na rota' })
    const subir = screen.getAllByRole('button', { name: 'Subir na rota' })
    expect((subir[0] as HTMLButtonElement).disabled).toBe(true)
    expect((descer[1] as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(descer[0])
    await waitFor(() =>
      expect(fake.feitas('PUT', '/entregas/ordem')[0]?.data).toEqual({ pedidoIds: ['p7', 'p6'] }),
    )
    expect(await screen.findByText('Não foi possível salvar a nova ordem.')).toBeTruthy()
    await waitFor(() =>
      expect(
        (screen.getAllByRole('button', { name: 'Subir na rota' })[1] as HTMLButtonElement).disabled,
      ).toBe(false),
    )
    fireEvent.click(screen.getAllByRole('button', { name: 'Subir na rota' })[1])
    await waitFor(() => expect(fake.feitas('PUT', '/entregas/ordem')).toHaveLength(2))
  })

  it('sem rotas hoje', async () => {
    fake.quando('GET /entregas/acompanhamento', [])
    const { unmount } = renderTela(<AcompanhamentoEntregasPage />)
    expect(await screen.findByText('Nenhuma entrega atribuída hoje.')).toBeTruthy()
    expect(mapa.enquadrou).toBe(0)
    unmount()
    expect(mapa.removido).toBeGreaterThan(0)
  })
})

describe('Painel de entregas', () => {
  const ENTREGAS = [
    {
      id: 'p5',
      numero: 185,
      status: 'EM_ENTREGA',
      situacao: 'EM_ROTA',
      cliente: 'VV',
      endereco: 'Rua A',
      dataPrevista: '2026-11-20T00:00:00Z',
      responsavel: 'Zé',
      entregueEm: null,
      problema: null,
      problemaEm: null,
    },
    {
      id: 'p6',
      numero: 186,
      status: 'APROVADO',
      situacao: 'PROBLEMA',
      cliente: 'Padaria',
      endereco: '',
      dataPrevista: null,
      responsavel: null,
      entregueEm: null,
      problema: 'portão fechado',
      problemaEm: '2026-11-18T12:00:00Z',
    },
    {
      id: 'p7',
      numero: 187,
      status: 'ENTREGUE',
      situacao: 'ENTREGUE',
      cliente: 'Doceria',
      endereco: 'Rua C',
      dataPrevista: null,
      responsavel: 'Zé',
      entregueEm: '2026-11-18T12:00:00Z',
      problema: null,
      problemaEm: null,
    },
  ]
  const abrir = () => renderTela(<PainelEntregas dataInicio="2026-11-01" dataFim="2026-11-30" />)

  it('grupos e ações da entrega', async () => {
    fake.quando('GET /entregas/painel', ENTREGAS)
    let n = 0
    const resposta = () =>
      ++n === 1 ? new ErroApi(400, ['data', 'inválida']) : n === 2 ? new ErroApi(500, '') : {}
    for (const rota of [
      'PUT /entregas/:id/data-prevista',
      'POST /pedidos/:id/em-entrega',
      'POST /pedidos/:id/pronto-para-entrega',
      'POST /pedidos/:id/entregue',
      'PUT /entregas/:id/problema',
      'DELETE /entregas/:id/problema',
    ])
      fake.quando(rota, resposta)
    abrir()
    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(await screen.findByText('Nenhuma entrega.')).toBeTruthy()
    expect(fake.feitas('GET', '/entregas/painel')[0].params).toEqual({
      dataInicio: '2026-11-01',
      dataFim: '2026-11-30',
    })
    expect(screen.getByText('Previsão: 20/11/2026')).toBeTruthy()
    expect(screen.getByText('Previsão: Não definida')).toBeTruthy()
    expect(screen.getByText('Sem responsável')).toBeTruthy()
    expect(screen.getByText('Endereço não cadastrado')).toBeTruthy()
    expect(screen.getByText(/^Entregue em /)).toBeTruthy()

    // em rota: volta para pendente, data prevista com erros
    fireEvent.click(screen.getByRole('button', { name: /#000185/ }))
    let modal = janela('Entrega #000185')
    expect(campo('Data prevista', modal).value).toBe('2026-11-20')
    expect(within(modal).queryByText(/Problema resolvido/)).toBeNull()
    preencher('Data prevista', '2026-11-22', modal)
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    expect(await within(modal).findByText('data inválida')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: /Voltar para pendente/ }))
    expect(await within(modal).findByText('Não foi possível atualizar a entrega')).toBeTruthy()
    fireEvent.click(within(modal).getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(screen.queryByText('Entrega #000185')).toBeNull())
    expect(fake.feitas('PUT', '/entregas/p5/data-prevista')[1].data).toEqual({
      dataPrevista: '2026-11-22',
    })
    expect(fake.feitas('POST', '/pedidos/p5/pronto-para-entrega')).toHaveLength(1)

    // com problema: registrar, resolver, saiu para entrega, entregue
    const acaoProblema = async (botao: RegExp) => {
      fireEvent.click(screen.getByRole('button', { name: /#000186/ }))
      modal = janela('Entrega #000186')
      fireEvent.click(within(modal).getByRole('button', { name: botao }))
      await waitFor(() => expect(screen.queryByText('Entrega #000186')).toBeNull())
    }
    fireEvent.click(screen.getByRole('button', { name: /#000186/ }))
    modal = janela('Entrega #000186')
    expect(within(modal).getByText('Responsável: Não definido')).toBeTruthy()
    const textarea = modal.querySelector('textarea')!
    fireEvent.change(textarea, { target: { value: ' ' } })
    expect(
      (within(modal).getByRole('button', { name: /Registrar problema/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    fireEvent.change(textarea, { target: { value: 'chuva' } })
    fireEvent.click(within(modal).getByRole('button', { name: /Registrar problema/ }))
    await waitFor(() => expect(screen.queryByText('Entrega #000186')).toBeNull())
    expect(fake.feitas('PUT', '/entregas/p6/problema')[0].data).toEqual({ descricao: 'chuva' })
    await acaoProblema(/Problema resolvido/)
    await acaoProblema(/Saiu para entrega/)
    await acaoProblema(/Marcar como entregue/)
    expect(fake.feitas('POST', '/pedidos/p6/entregue')[0].data).toEqual({})

    // entregue: sem bloco de problema
    fireEvent.click(screen.getByRole('button', { name: /#000187/ }))
    modal = janela('Entrega #000187')
    expect(modal.querySelector('textarea')).toBeNull()
    fireEvent.click(within(modal).getByRole('button', { name: 'Fechar' }))
  })

  it('supervisor envia foto para marcar entregue', async () => {
    logar({ ...USUARIO, papel: 'SUPERVISOR' })
    fake.quando('GET /entregas/painel', ENTREGAS)
    fake.quando('POST /pedidos/:id/entregue', {})
    abrir()
    fireEvent.click(await screen.findByRole('button', { name: /#000185/ }))
    const modal = janela('Entrega #000185')
    const marcar = within(modal).getByRole('button', {
      name: /Marcar como entregue/,
    }) as HTMLButtonElement
    expect(marcar.disabled).toBe(true)
    const input = campo('Foto da entrega (obrigatória para marcar como entregue)', modal)
    fireEvent.change(input, { target: { files: [] } })
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'f.jpg', { type: 'image/jpeg' })] },
    })
    await waitFor(() => expect(marcar.disabled).toBe(false))
    fireEvent.click(marcar)
    await waitFor(() => expect(fake.feitas('POST', '/pedidos/p5/entregue')).toHaveLength(1))
    expect(fake.feitas('POST', '/pedidos/p5/entregue')[0].data.fotoEntrega).toMatch(
      /^data:image\/jpeg/,
    )
  })

  it('visão geral só olha e resposta inválida vira lista vazia', async () => {
    logar({ ...USUARIO, papel: 'VISAO_GERAL' })
    fake.quando('GET /entregas/painel', ENTREGAS)
    abrir()
    expect(
      ((await screen.findByRole('button', { name: /#000185/ })) as HTMLButtonElement).disabled,
    ).toBe(true)
    cleanup()
    fake.quando('GET /entregas/painel', { x: 1 })
    abrir()
    await waitFor(() => expect(screen.getAllByText('Nenhuma entrega.')).toHaveLength(4))
  })
})
